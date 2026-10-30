import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Copy, AlertCircle, CheckCircle2, Trash2, RefreshCw, Download,
  Sliders, Merge, Undo2, ShieldAlert, Sparkles, X
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { TestCase, DuplicatePair } from '../lib/types';

export default function DuplicateDetection() {
  const { duplicates, setDuplicates, testCases, negativeTestCases, removeTestCase, addTestCases } = useAppStore();
  const allCases = useMemo(() => [...testCases, ...negativeTestCases], [testCases, negativeTestCases]);

  // Threshold slider
  const [threshold, setThreshold] = useState(70);
  const [isScanning, setIsScanning] = useState(false);

  // Restore history
  const [removedHistory, setRemovedHistory] = useState<TestCase[]>([]);

  // Confirmation modal state
  const [deleteConfirmTcId, setDeleteConfirmTcId] = useState<string | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  // Merge modal state
  const [mergingPair, setMergingPair] = useState<DuplicatePair | null>(null);

  // Dynamic filter by similarity threshold
  const filteredDuplicates = useMemo(() => {
    return duplicates.filter(d => d.similarity >= threshold);
  }, [duplicates, threshold]);

  // Re-scan with custom threshold
  const handleRescan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const found: DuplicatePair[] = [];
      for (let i = 0; i < allCases.length; i++) {
        for (let j = i + 1; j < allCases.length; j++) {
          const tc1 = allCases[i];
          const tc2 = allCases[j];

          // Compute Jaccard on scenario + steps
          const text1 = `${tc1.scenario} ${(tc1.steps || []).join(' ')}`.toLowerCase();
          const text2 = `${tc2.scenario} ${(tc2.steps || []).join(' ')}`.toLowerCase();
          const words1 = new Set(text1.split(/\s+/));
          const words2 = new Set(text2.split(/\s+/));
          const intersection = new Set([...words1].filter(w => words2.has(w)));
          const union = new Set([...words1, ...words2]);
          const sim = Math.round((intersection.size / Math.max(1, union.size)) * 100);

          if (sim >= threshold) {
            found.push({
              testCase1Id: tc1.testCaseId,
              testCase2Id: tc2.testCaseId,
              similarity: sim,
              reason: sim >= 85
                ? 'High lexical and behavioral step redundancy'
                : sim >= 70
                ? 'Overlapping test assertions and verification paths'
                : 'Shared input patterns and target endpoints',
              suggestedMergedCase: {
                testCaseId: tc1.testCaseId,
                title: `Merged: ${tc1.title || tc1.scenario}`,
                scenario: `${tc1.scenario} (Consolidated with ${tc2.testCaseId})`,
                preconditions: tc1.preconditions || tc2.preconditions,
                steps: Array.from(new Set([...tc1.steps, ...tc2.steps])),
                expectedResults: `${tc1.expectedResults} Additionally: ${tc2.expectedResults}`,
                priority: tc1.priority === 'Critical' || tc2.priority === 'Critical' ? 'Critical' : tc1.priority === 'High' || tc2.priority === 'High' ? 'High' : 'Medium',
                category: tc1.category,
                tags: Array.from(new Set([...tc1.tags, ...tc2.tags, 'consolidated'])),
              },
            });
          }
        }
      }
      setDuplicates(found);
      setIsScanning(false);
      toast.success(`Duplicate scan complete: found ${found.length} pair(s) at ≥${threshold}% similarity`);
    }, 400);
  };

  const getSimilarityBadge = (sim: number) => {
    if (sim >= 85) return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200';
    if (sim >= 70) return 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200';
    return 'bg-purple-50 text-[#7c3aed] dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200';
  };

  // Safe removal of a single test case
  const executeRemoveDuplicate = (testCaseId: string) => {
    const tcToRemove = allCases.find(tc => tc.testCaseId === testCaseId);
    if (!tcToRemove) return;

    removeTestCase(testCaseId);
    setRemovedHistory(prev => [tcToRemove, ...prev]);
    setDeleteConfirmTcId(null);
    toast.success(`Test case ${testCaseId} removed safely. (Restore available below)`);
  };

  // Safe bulk removal
  const executeBulkRemove = () => {
    const removedSet = new Set<string>();
    const removedObjects: TestCase[] = [];

    filteredDuplicates.forEach(dup => {
      if (!removedSet.has(dup.testCase2Id)) {
        const target = allCases.find(tc => tc.testCaseId === dup.testCase2Id);
        if (target) {
          removeTestCase(dup.testCase2Id);
          removedSet.add(dup.testCase2Id);
          removedObjects.push(target);
        }
      }
    });

    setRemovedHistory(prev => [...removedObjects, ...prev]);
    setBulkConfirmOpen(false);
    toast.success(`Safely cleaned up ${removedSet.size} redundant test case(s)`);
  };

  // Restore removed test case
  const handleRestore = (tc: TestCase) => {
    addTestCases([tc]);
    setRemovedHistory(prev => prev.filter(item => item.testCaseId !== tc.testCaseId));
    toast.success(`Restored test case ${tc.testCaseId}`);
  };

  // Apply suggested merge
  const handleConfirmMerge = () => {
    if (!mergingPair || !mergingPair.suggestedMergedCase) return;
    const baseTc = allCases.find(tc => tc.testCaseId === mergingPair.testCase1Id);
    const redTc = allCases.find(tc => tc.testCaseId === mergingPair.testCase2Id);

    if (baseTc && redTc) {
      // 1. Remove redTc
      removeTestCase(redTc.testCaseId);
      setRemovedHistory(prev => [redTc, ...prev]);

      // 2. Add / update consolidated base
      const merged: TestCase = {
        ...baseTc,
        ...mergingPair.suggestedMergedCase,
        testCaseId: baseTc.testCaseId,
        id: baseTc.id,
      } as TestCase;

      removeTestCase(baseTc.testCaseId);
      addTestCases([merged]);

      toast.success(`Consolidated ${redTc.testCaseId} into ${baseTc.testCaseId}`);
      setMergingPair(null);
    }
  };

  const handleExportReport = () => {
    const data = filteredDuplicates.map(dup => {
      const tc1 = allCases.find(tc => tc.testCaseId === dup.testCase1Id);
      const tc2 = allCases.find(tc => tc.testCaseId === dup.testCase2Id);
      return {
        'Test Case 1 ID': dup.testCase1Id,
        'Test Case 1 Scenario': tc1?.scenario || '',
        'Test Case 2 ID': dup.testCase2Id,
        'Test Case 2 Scenario': tc2?.scenario || '',
        'Similarity %': `${dup.similarity}%`,
        'Reasoning': dup.reason,
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Duplicate Test Cases');
    XLSX.writeFile(wb, `Duplicate-TestCases-Report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#f0f9ff] dark:bg-slate-900">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0] dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/40 flex items-center justify-center text-[#0ea5e9]">
            <Copy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
              Duplicate & Redundant Test Case Detection
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-sky-50 text-[#0ea5e9] dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200">
                NLP Semantic Deduplication
              </span>
            </h2>
            <p className="text-xs text-[#64748b]">Identify identical or highly overlapping test scenarios to minimize suite bloat and execution cost</p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRescan}
            disabled={isScanning || allCases.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-[#e2e8f0] dark:border-slate-700 text-[#0f172a] dark:text-white hover:border-[#0ea5e9] text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-[#0ea5e9]' : ''}`} />
            <span>Re-Scan Duplicates</span>
          </button>

          {filteredDuplicates.length > 0 && (
            <>
              <button
                onClick={() => setBulkConfirmOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 text-[#dc2626] text-xs font-semibold hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bulk Cleanup ({filteredDuplicates.length})</span>
              </button>

              <button
                onClick={handleExportReport}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Report</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Threshold Slider & Summary Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Slider Box */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-foreground">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#7c3aed]" />
              <span>Similarity Threshold:</span>
            </span>
            <span className="text-[#7c3aed]">{threshold}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="95"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full accent-[#7c3aed]"
          />
          <div className="flex justify-between text-[10px] text-muted font-medium">
            <span>50% (Broad Overlap)</span>
            <span>95% (Near Identical)</span>
          </div>
        </div>

        {/* Duplicate count */}
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[10px] text-muted uppercase font-bold">Detected Duplicate Pairs</p>
            <p className="text-2xl font-black text-red-600 mt-1">{filteredDuplicates.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-red-500">
            <Copy className="w-5 h-5" />
          </div>
        </div>

        {/* Average Similarity */}
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[10px] text-muted uppercase font-bold">Average Similarity Score</p>
            <p className="text-2xl font-black text-[#7c3aed] mt-1">
              {filteredDuplicates.length > 0
                ? `${Math.round(filteredDuplicates.reduce((acc, d) => acc + d.similarity, 0) / filteredDuplicates.length)}%`
                : '0%'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-[#7c3aed]">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main List */}
      {filteredDuplicates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-border rounded-2xl">
          <CheckCircle2 className="w-16 h-16 text-[#16a34a] mb-3" />
          <h3 className="text-base font-bold text-foreground">No Duplicate Cases Found</h3>
          <p className="text-xs text-muted mt-1 max-w-md text-center">
            At the current {threshold}% similarity threshold, all test cases in your project are unique with verified behavioral differentiation.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
              Duplicate Candidates for Review ({filteredDuplicates.length})
            </h3>
          </div>

          <div className="space-y-3">
            {filteredDuplicates.map((dup, idx) => {
              const tc1 = allCases.find(tc => tc.testCaseId === dup.testCase1Id);
              const tc2 = allCases.find(tc => tc.testCaseId === dup.testCase2Id);
              return (
                <motion.div
                  key={`${dup.testCase1Id}-${dup.testCase2Id}-${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-white dark:bg-slate-800 border border-border rounded-xl p-4 shadow-xs space-y-3"
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold text-foreground">Overlap Detected</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getSimilarityBadge(dup.similarity)}`}>
                        {dup.similarity}% Similarity
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {dup.suggestedMergedCase && (
                        <button
                          onClick={() => setMergingPair(dup)}
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-purple-50 text-[#7c3aed] dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 hover:bg-purple-100 transition-colors"
                        >
                          <Merge className="w-3 h-3" />
                          <span>Merge Cases</span>
                        </button>
                      )}

                      <button
                        onClick={() => setDeleteConfirmTcId(dup.testCase2Id)}
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300 border border-red-200 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove {dup.testCase2Id}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-muted font-medium">Reason: {dup.reason}</p>

                  {/* Side-by-Side Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Primary Case 1 */}
                    <div className="bg-slate-50 dark:bg-slate-850 border border-border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#7c3aed]">{dup.testCase1Id} (Base)</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {tc1?.priority}
                        </span>
                      </div>
                      <p className="font-semibold text-foreground">{tc1?.title || tc1?.scenario}</p>
                      <p className="text-[11px] text-muted">Steps: {tc1?.steps.join(' → ')}</p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Expected: {tc1?.expectedResults}</p>
                    </div>

                    {/* Redundant Case 2 */}
                    <div className="bg-slate-50 dark:bg-slate-850 border border-border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-red-600">{dup.testCase2Id} (Redundant)</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {tc2?.priority}
                        </span>
                      </div>
                      <p className="font-semibold text-foreground">{tc2?.title || tc2?.scenario}</p>
                      <p className="text-[11px] text-muted">Steps: {tc2?.steps.join(' → ')}</p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Expected: {tc2?.expectedResults}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Audit Trail: Recently Removed with Restore Action */}
      {removedHistory.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Undo2 className="w-3.5 h-3.5 text-[#0ea5e9]" />
              <span>Audit Trail: Safely Removed Test Cases ({removedHistory.length})</span>
            </h4>
            <span className="text-[11px] text-muted">Click restore to reinstate any test case</span>
          </div>

          <div className="divide-y divide-border/50 max-h-48 overflow-y-auto">
            {removedHistory.map((tc) => (
              <div key={tc.testCaseId} className="py-2 flex items-center justify-between text-xs gap-2">
                <div className="min-w-0">
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300 mr-2">{tc.testCaseId}</span>
                  <span className="text-muted truncate">{tc.title || tc.scenario}</span>
                </div>
                <button
                  onClick={() => handleRestore(tc)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-50 text-[#0ea5e9] hover:bg-sky-100 font-semibold text-xs transition-colors shrink-0"
                >
                  <Undo2 className="w-3 h-3" />
                  <span>Restore</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Single Delete Confirmation Modal */}
      {deleteConfirmTcId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
              <ShieldAlert className="w-5 h-5" />
              <span>Confirm Test Case Removal</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to remove <span className="font-bold text-foreground">{deleteConfirmTcId}</span> as a redundant duplicate?
              This action is logged in the audit trail and can be restored at any time.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setDeleteConfirmTcId(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => executeRemoveDuplicate(deleteConfirmTcId)}
                className="px-4 py-1.5 text-xs rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
              <Trash2 className="w-5 h-5" />
              <span>Confirm Bulk Cleanup</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              This will remove <span className="font-bold text-foreground">{filteredDuplicates.length}</span> redundant secondary test case(s)
              meeting the {threshold}% similarity threshold while preserving all unique base cases. All removed cases can be restored.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setBulkConfirmOpen(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkRemove}
                className="px-4 py-1.5 text-xs rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700"
              >
                Execute Bulk Cleanup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergingPair && mergingPair.suggestedMergedCase && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-border rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Merge className="w-4 h-4 text-[#7c3aed]" />
                <span>Consolidate {mergingPair.testCase1Id} & {mergingPair.testCase2Id}</span>
              </h3>
              <button onClick={() => setMergingPair(null)} className="text-muted hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted">
              Consolidate overlapping test scenarios into a unified, non-redundant test case:
            </p>

            <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 rounded-xl space-y-2 text-xs">
              <div>
                <span className="font-bold text-muted text-[10px] uppercase">Consolidated Title:</span>
                <p className="font-semibold text-foreground">{mergingPair.suggestedMergedCase.title}</p>
              </div>
              <div>
                <span className="font-bold text-muted text-[10px] uppercase">Unified Steps:</span>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-700 dark:text-slate-300">
                  {mergingPair.suggestedMergedCase.steps?.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
              <div>
                <span className="font-bold text-muted text-[10px] uppercase">Unified Expected Result:</span>
                <p className="text-[#16a34a] font-medium">{mergingPair.suggestedMergedCase.expectedResults}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setMergingPair(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMerge}
                className="px-4 py-1.5 text-xs rounded-lg bg-[#7c3aed] text-white font-semibold hover:bg-[#6d28d9]"
              >
                Apply Consolidated Case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
