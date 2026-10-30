import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Grid3X3, Download, CheckCircle2, XCircle, AlertCircle,
  Plus, Search, Link2, Network, List
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';

export default function TraceabilityMatrix() {
  const { traceability, setTraceability, testCases, negativeTestCases, extractedRequirements } = useAppStore();
  const allCases = useMemo(() => [...testCases, ...negativeTestCases], [testCases, negativeTestCases]);

  // Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [coverageFilter, setCoverageFilter] = useState<'all' | 'covered' | 'uncovered' | 'partial'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'matrix'>('table');

  // Manual link dialog state
  const [linkingReqId, setLinkingReqId] = useState<string | null>(null);
  const [selectedTcToLink, setSelectedTcToLink] = useState('');

  // Synchronize or derive entries from active requirements and test cases if traceability is empty
  const activeEntries = useMemo(() => {
    if (traceability.length > 0) return traceability;

    // Build dynamic mapping from extractedRequirements and test cases
    const reqMap = new Map<string, { requirementId: string; requirementText: string; testCaseIds: string[]; coverage: number }>();

    extractedRequirements.forEach(req => {
      reqMap.set(req.requirementId, {
        requirementId: req.requirementId,
        requirementText: req.title || req.description,
        testCaseIds: [],
        coverage: 0,
      });
    });

    allCases.forEach(tc => {
      const rid = tc.requirementId || 'REQ-GEN';
      if (!reqMap.has(rid)) {
        reqMap.set(rid, {
          requirementId: rid,
          requirementText: tc.requirementDescription || tc.scenario,
          testCaseIds: [],
          coverage: 0,
        });
      }
      const entry = reqMap.get(rid)!;
      if (!entry.testCaseIds.includes(tc.testCaseId)) {
        entry.testCaseIds.push(tc.testCaseId);
      }
      entry.coverage = Math.min(100, entry.testCaseIds.length * 50);
    });

    return Array.from(reqMap.values());
  }, [traceability, extractedRequirements, allCases]);

  // Orphan analysis
  const orphanRequirements = activeEntries.filter(e => e.testCaseIds.length === 0);
  const mappedTcIds = new Set(activeEntries.flatMap(e => e.testCaseIds));
  const orphanTestCases = allCases.filter(tc => !mappedTcIds.has(tc.testCaseId));

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return activeEntries.filter(e => {
      if (coverageFilter === 'covered' && e.coverage < 100) return false;
      if (coverageFilter === 'uncovered' && e.testCaseIds.length > 0) return false;
      if (coverageFilter === 'partial' && (e.coverage >= 100 || e.testCaseIds.length === 0)) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchId = e.requirementId.toLowerCase().includes(q);
        const matchText = e.requirementText.toLowerCase().includes(q);
        const matchTcs = e.testCaseIds.some(id => id.toLowerCase().includes(q));
        if (!matchId && !matchText && !matchTcs) return false;
      }
      return true;
    });
  }, [activeEntries, coverageFilter, searchTerm]);

  // Add a link
  const handleAddLink = () => {
    if (!linkingReqId || !selectedTcToLink) return;
    const updated = activeEntries.map(e => {
      if (e.requirementId === linkingReqId) {
        const nextIds = e.testCaseIds.includes(selectedTcToLink) ? e.testCaseIds : [...e.testCaseIds, selectedTcToLink];
        return {
          ...e,
          testCaseIds: nextIds,
          coverage: Math.min(100, nextIds.length * 50),
        };
      }
      return e;
    });
    setTraceability(updated);
    toast.success(`Linked ${selectedTcToLink} to ${linkingReqId}`);
    setLinkingReqId(null);
    setSelectedTcToLink('');
  };

  // Remove a link
  const handleRemoveLink = (reqId: string, tcId: string) => {
    const updated = activeEntries.map(e => {
      if (e.requirementId === reqId) {
        const nextIds = e.testCaseIds.filter(id => id !== tcId);
        return {
          ...e,
          testCaseIds: nextIds,
          coverage: Math.min(100, nextIds.length * 50),
        };
      }
      return e;
    });
    setTraceability(updated);
    toast.info(`Unlinked ${tcId} from ${reqId}`);
  };

  const exportToExcel = () => {
    const data = filteredEntries.map(entry => ({
      'Requirement ID': entry.requirementId,
      'Requirement Text': entry.requirementText,
      'Mapped Test Cases': entry.testCaseIds.join(', ') || 'NONE',
      'Test Count': entry.testCaseIds.length,
      'Coverage %': `${entry.coverage}%`,
      'Status': entry.coverage >= 100 ? 'Full' : entry.testCaseIds.length > 0 ? 'Partial' : 'Uncovered',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Traceability Matrix');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `Traceability-Matrix-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Traceability Matrix exported to Excel');
  };

  const getCoverageColor = (cov: number) => {
    if (cov >= 80) return 'text-[#16a34a]';
    if (cov >= 40) return 'text-amber-500';
    return 'text-[#dc2626]';
  };

  const getCoverageBg = (cov: number) => {
    if (cov >= 80) return 'bg-[#16a34a]';
    if (cov >= 40) return 'bg-amber-500';
    return 'bg-[#dc2626]';
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#f0f9ff] dark:bg-slate-900">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0] dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/40 flex items-center justify-center text-[#0ea5e9]">
            <Grid3X3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
              Requirement Traceability Matrix (RTM)
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-sky-50 text-[#0ea5e9] dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200">
                Bidirectional
              </span>
            </h2>
            <p className="text-xs text-[#64748b]">Map SRS requirements directly to test cases, verify full coverage, and detect orphan assets</p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg p-1 border border-[#e2e8f0] dark:border-slate-700 text-xs shadow-2xs">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'table' ? 'bg-[#0ea5e9] text-white shadow-xs' : 'text-[#64748b]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table View</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'matrix' ? 'bg-[#0ea5e9] text-white shadow-xs' : 'text-[#64748b]'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Grid Matrix</span>
            </button>
          </div>

          <button
            onClick={exportToExcel}
            disabled={activeEntries.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export RTM Excel</span>
          </button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-3.5 shadow-xs">
          <p className="text-[10px] text-muted uppercase font-bold">Total Requirements</p>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{activeEntries.length}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3.5 shadow-xs">
          <p className="text-[10px] text-emerald-800 dark:text-emerald-400 uppercase font-bold">Fully Covered</p>
          <p className="text-2xl font-black text-[#16a34a] mt-1">
            {activeEntries.filter(e => e.coverage >= 100).length}
          </p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3.5 shadow-xs">
          <p className="text-[10px] text-amber-800 dark:text-amber-400 uppercase font-bold">Partially Covered</p>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {activeEntries.filter(e => e.coverage < 100 && e.testCaseIds.length > 0).length}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl p-3.5 shadow-xs">
          <p className="text-[10px] text-red-800 dark:text-red-400 uppercase font-bold">Orphan Reqs</p>
          <p className="text-2xl font-black text-[#dc2626] mt-1">{orphanRequirements.length}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl p-3.5 shadow-xs">
          <p className="text-[10px] text-[#7c3aed] uppercase font-bold">Orphan Cases</p>
          <p className="text-2xl font-black text-[#7c3aed] mt-1">{orphanTestCases.length}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 border border-border rounded-xl">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search requirement ID, text, or test case..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-700 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-semibold text-muted text-[11px] uppercase mr-1">Coverage:</span>
          {(['all', 'covered', 'partial', 'uncovered'] as const).map(f => (
            <button
              key={f}
              onClick={() => setCoverageFilter(f)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                coverageFilter === f
                  ? 'bg-[#7c3aed] text-white shadow-xs'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-border'
              }`}
            >
              {f === 'covered' ? '100% Full' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Main Views */}
      {activeEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-border rounded-2xl">
          <Grid3X3 className="w-16 h-16 text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-foreground">No Requirements Mapped</h3>
          <p className="text-xs text-muted mt-1 max-w-md text-center">
            Upload an SRS in SRS Input or generate test cases to populate the bidirectional traceability matrix.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="grid grid-cols-[110px_1fr_1fr_90px_130px_70px] gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-muted uppercase tracking-wider border-b border-border">
            <span>Req ID</span>
            <span>Requirement Description</span>
            <span>Mapped Test Cases</span>
            <span>Tests</span>
            <span>Coverage</span>
            <span className="text-right">Link</span>
          </div>

          <div className="divide-y divide-border/60 max-h-[560px] overflow-y-auto">
            {filteredEntries.map((entry, idx) => (
              <motion.div
                key={entry.requirementId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.02 }}
                className="grid grid-cols-[110px_1fr_1fr_90px_130px_70px] gap-2 px-4 py-3 items-center hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors text-xs"
              >
                {/* Req ID */}
                <span className="font-mono font-bold text-[#7c3aed]">{entry.requirementId}</span>

                {/* Text */}
                <span className="text-slate-800 dark:text-slate-200 font-medium truncate pr-2">
                  {entry.requirementText}
                </span>

                {/* Mapped Test Cases Chips with Unlink Action */}
                <div className="flex flex-wrap gap-1.5">
                  {entry.testCaseIds.length > 0 ? (
                    entry.testCaseIds.map(id => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-purple-50 text-[#7c3aed] dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 group"
                      >
                        <span>{id}</span>
                        <button
                          onClick={() => handleRemoveLink(entry.requirementId, id)}
                          className="text-muted hover:text-red-500 ml-0.5"
                          title="Unlink test case"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-red-500 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> No Test Cases Mapped
                    </span>
                  )}
                </div>

                {/* Test count badge */}
                <div className="flex items-center gap-1 font-semibold text-xs">
                  {entry.testCaseIds.length > 0 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-[#dc2626]" />
                  )}
                  <span>{entry.testCaseIds.length} tests</span>
                </div>

                {/* Coverage bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getCoverageBg(entry.coverage)}`}
                      style={{ width: `${entry.coverage}%` }}
                    />
                  </div>
                  <span className={`font-mono font-bold text-xs ${getCoverageColor(entry.coverage)}`}>
                    {entry.coverage}%
                  </span>
                </div>

                {/* Add Link Action */}
                <div className="text-right">
                  <button
                    onClick={() => setLinkingReqId(entry.requirementId)}
                    className="p-1 rounded text-muted hover:text-[#7c3aed] transition-colors"
                    title="Link Test Case"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        /* Matrix Grid View (Visual cross-product matrix) */
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-4 overflow-x-auto shadow-xs">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2 text-left font-bold text-muted uppercase bg-slate-50 dark:bg-slate-800/80 sticky left-0 z-10">
                  Requirement
                </th>
                {allCases.slice(0, 15).map(tc => (
                  <th key={tc.testCaseId} className="p-2 text-center font-mono text-[11px] text-slate-700 dark:text-slate-300 font-bold whitespace-nowrap">
                    {tc.testCaseId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredEntries.map(entry => (
                <tr key={entry.requirementId} className="hover:bg-slate-50/50">
                  <td className="p-2 font-mono font-bold text-[#7c3aed] bg-white dark:bg-slate-800 sticky left-0 z-10 whitespace-nowrap">
                    {entry.requirementId}
                  </td>
                  {allCases.slice(0, 15).map(tc => {
                    const isMapped = entry.testCaseIds.includes(tc.testCaseId);
                    return (
                      <td key={tc.testCaseId} className="p-2 text-center">
                        {isMapped ? (
                          <span className="inline-block w-4 h-4 rounded-full bg-emerald-100 text-[#16a34a] font-bold leading-4">
                            ✓
                          </span>
                        ) : (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Link Test Case Modal */}
      {linkingReqId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#7c3aed]" />
                <span>Link Test Case to {linkingReqId}</span>
              </h3>
              <button onClick={() => setLinkingReqId(null)} className="text-muted hover:text-foreground">
                ✕
              </button>
            </div>

            <p className="text-xs text-muted">
              Select an available test case from your project test suite to associate with requirement{' '}
              <span className="font-semibold text-foreground">{linkingReqId}</span>.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted uppercase">Available Test Cases</label>
              <select
                value={selectedTcToLink}
                onChange={(e) => setSelectedTcToLink(e.target.value)}
                className="w-full bg-white dark:bg-slate-700 border border-border rounded-lg p-2 text-xs text-foreground"
              >
                <option value="">-- Choose a test case --</option>
                {allCases.map(tc => (
                  <option key={tc.testCaseId} value={tc.testCaseId}>
                    {tc.testCaseId}: {tc.title || tc.scenario}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setLinkingReqId(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLink}
                disabled={!selectedTcToLink}
                className="px-4 py-1.5 text-xs rounded-lg bg-[#7c3aed] text-white font-semibold hover:bg-[#6d28d9] disabled:opacity-50"
              >
                Confirm Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
