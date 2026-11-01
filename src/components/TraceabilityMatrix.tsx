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
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#F0F9FF]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#E0F2FE] bg-white p-5 rounded-2xl shadow-sm border">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white shadow-md shadow-sky-500/10">
            <Grid3X3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2 tracking-tight">
              Requirement Traceability Matrix (RTM)
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-[#FDF2F8] text-[#BE185D] border border-[#FCE7F3]">
                Bidirectional
              </span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5 font-medium">Map SRS requirements directly to test cases, verify full coverage, and detect orphan assets</p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Toggle */}
          <div className="flex items-center bg-white rounded-xl p-1 border-2 border-[#CBD5E1] text-xs shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-[#0EA5E9] text-white shadow-xs' : 'text-[#64748B]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black transition-colors cursor-pointer ${
                viewMode === 'matrix' ? 'bg-[#0EA5E9] text-white shadow-xs' : 'text-[#64748B]'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Grid Matrix</span>
            </button>
          </div>

          <button
            type="button"
            onClick={exportToExcel}
            disabled={activeEntries.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] hover:opacity-95 text-white text-xs font-black shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export RTM Excel</span>
          </button>
        </div>
      </motion.div>

      {/* KPI Cards in White, Sky Blue, Purple, and Light Pink */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border-2 border-sky-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs text-[#0284C7] uppercase font-black tracking-wider">Total Requirements</p>
          <p className="text-3xl font-black text-[#0284C7] mt-1 tracking-tight">{activeEntries.length}</p>
        </div>
        <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs text-[#16A34A] uppercase font-black tracking-wider">Fully Covered</p>
          <p className="text-3xl font-black text-[#16A34A] mt-1 tracking-tight">
            {activeEntries.filter(e => e.coverage >= 100).length}
          </p>
        </div>
        <div className="bg-white border-2 border-purple-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs text-[#7C3AED] uppercase font-black tracking-wider">Partially Covered</p>
          <p className="text-3xl font-black text-[#7C3AED] mt-1 tracking-tight">
            {activeEntries.filter(e => e.coverage < 100 && e.testCaseIds.length > 0).length}
          </p>
        </div>
        <div className="bg-white border-2 border-pink-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs text-[#BE185D] uppercase font-black tracking-wider">Orphan Reqs</p>
          <p className="text-3xl font-black text-[#BE185D] mt-1 tracking-tight">{orphanRequirements.length}</p>
        </div>
        <div className="bg-white border-2 border-purple-300 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs text-[#8B5CF6] uppercase font-black tracking-wider">Orphan Cases</p>
          <p className="text-3xl font-black text-[#8B5CF6] mt-1 tracking-tight">{orphanTestCases.length}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white border-2 border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-[#64748B] shrink-0" />
          <input
            type="text"
            placeholder="Search requirement ID, text, or test case..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#F8FCFF] border-2 border-slate-200 focus:border-[#0EA5E9] rounded-xl px-3.5 py-2 text-xs font-bold text-[#0F172A] outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-black text-[#64748B] text-xs uppercase mr-1">Coverage:</span>
          {(['all', 'covered', 'partial', 'uncovered'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setCoverageFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black capitalize transition-colors cursor-pointer ${
                coverageFilter === f
                  ? 'bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] text-white shadow-xs'
                  : 'bg-[#F8FCFF] text-slate-700 border-2 border-slate-200 hover:border-sky-300'
              }`}
            >
              {f === 'covered' ? '100% Full' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Main Views */}
      {activeEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border-2 border-dashed border-sky-300 rounded-2xl shadow-xs">
          <Grid3X3 className="w-16 h-16 text-sky-300 mb-3" />
          <h3 className="text-base font-black text-[#0F172A]">No Requirements Mapped</h3>
          <p className="text-xs font-bold text-[#64748B] mt-1 max-w-md text-center">
            Upload an SRS in SRS Input or generate test cases to populate the bidirectional traceability matrix.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="grid grid-cols-[110px_1fr_1fr_90px_130px_70px] gap-2 px-4 py-3 bg-[#F8FCFF] text-xs font-black text-[#0F172A] uppercase tracking-wider border-b-2 border-slate-200">
            <span>Req ID</span>
            <span>Requirement Description</span>
            <span>Mapped Test Cases</span>
            <span>Tests</span>
            <span>Coverage</span>
            <span className="text-right">Link</span>
          </div>

          <div className="divide-y-2 divide-slate-100 max-h-[580px] overflow-y-auto">
            {filteredEntries.map((entry, idx) => (
              <motion.div
                key={entry.requirementId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.02 }}
                className="grid grid-cols-[110px_1fr_1fr_90px_130px_70px] gap-2 px-4 py-3.5 items-center hover:bg-[#F0F9FF] transition-colors text-xs"
              >
                {/* Req ID */}
                <span className="font-mono font-black text-[#7C3AED] bg-purple-50 px-2 py-0.5 rounded border border-purple-200 w-fit">{entry.requirementId}</span>

                {/* Text */}
                <span className="text-[#0F172A] font-bold truncate pr-2">
                  {entry.requirementText}
                </span>

                {/* Mapped Test Cases Chips with Unlink Action */}
                <div className="flex flex-wrap gap-1.5">
                  {entry.testCaseIds.length > 0 ? (
                    entry.testCaseIds.map(id => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 text-[11px] font-mono font-black px-2.5 py-0.5 rounded-lg bg-purple-50 text-[#7C3AED] border-2 border-purple-200 group"
                      >
                        <span>{id}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(entry.requirementId, id)}
                          className="text-[#64748B] hover:text-[#BE185D] ml-0.5 cursor-pointer font-black"
                          title="Unlink test case"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#BE185D] font-black flex items-center gap-1 bg-[#FDF2F8] px-2 py-0.5 rounded-lg border border-pink-200">
                      <AlertCircle className="w-3.5 h-3.5" /> No Test Cases Mapped
                    </span>
                  )}
                </div>

                {/* Test count badge */}
                <div className="flex items-center gap-1 font-black text-xs text-[#0F172A]">
                  {entry.testCaseIds.length > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[#BE185D]" />
                  )}
                  <span>{entry.testCaseIds.length} tests</span>
                </div>

                {/* Coverage bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getCoverageBg(entry.coverage)}`}
                      style={{ width: `${entry.coverage}%` }}
                    />
                  </div>
                  <span className={`font-mono font-black text-xs ${getCoverageColor(entry.coverage)}`}>
                    {entry.coverage}%
                  </span>
                </div>

                {/* Add Link Action */}
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setLinkingReqId(entry.requirementId)}
                    className="p-1.5 rounded-lg text-[#64748B] hover:text-[#7C3AED] hover:bg-purple-50 transition-colors cursor-pointer"
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
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 overflow-x-auto shadow-xs">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="p-2.5 text-left font-black text-[#0F172A] uppercase bg-[#F8FCFF] sticky left-0 z-10">
                  Requirement
                </th>
                {allCases.slice(0, 15).map(tc => (
                  <th key={tc.testCaseId} className="p-2.5 text-center font-mono text-xs text-[#0F172A] font-black whitespace-nowrap">
                    {tc.testCaseId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.map(entry => (
                <tr key={entry.requirementId} className="hover:bg-[#F0F9FF]">
                  <td className="p-2.5 font-mono font-black text-[#7C3AED] bg-white sticky left-0 z-10 whitespace-nowrap">
                    {entry.requirementId}
                  </td>
                  {allCases.slice(0, 15).map(tc => {
                    const isMapped = entry.testCaseIds.includes(tc.testCaseId);
                    return (
                      <td key={tc.testCaseId} className="p-2.5 text-center">
                        {isMapped ? (
                          <span className="inline-block w-5 h-5 rounded-full bg-[#DCFCE7] text-[#16A34A] border border-emerald-300 font-black leading-5 text-center">
                            ✓
                          </span>
                        ) : (
                          <span className="inline-block w-2 h-2 rounded-full bg-slate-300" />
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
          <div className="bg-white border-2 border-purple-200 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b-2 border-purple-100">
              <h3 className="text-base font-black text-[#0F172A] flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#8B5CF6]" />
                <span>Link Test Case to {linkingReqId}</span>
              </h3>
              <button type="button" onClick={() => setLinkingReqId(null)} className="text-[#64748B] hover:text-[#0F172A] cursor-pointer">
                ✕
              </button>
            </div>

            <p className="text-xs font-bold text-[#64748B]">
              Select an available test case from your project test suite to associate with requirement{' '}
              <span className="font-black text-[#7C3AED]">{linkingReqId}</span>.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-black text-[#0F172A] uppercase">Available Test Cases</label>
              <select
                value={selectedTcToLink}
                onChange={(e) => setSelectedTcToLink(e.target.value)}
                className="w-full bg-[#F8FCFF] border-2 border-slate-200 focus:border-[#0EA5E9] rounded-xl p-2.5 text-xs font-bold text-[#0F172A] outline-none"
              >
                <option value="">-- Choose a test case --</option>
                {allCases.map(tc => (
                  <option key={tc.testCaseId} value={tc.testCaseId}>
                    {tc.testCaseId}: {tc.title || tc.scenario}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t-2 border-slate-100">
              <button
                type="button"
                onClick={() => setLinkingReqId(null)}
                className="px-4 py-2 text-xs font-black rounded-xl border-2 border-slate-200 text-[#64748B] hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddLink}
                disabled={!selectedTcToLink}
                className="px-5 py-2 text-xs rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#8B5CF6] text-white font-black hover:opacity-95 shadow-md shadow-sky-500/20 disabled:opacity-50 cursor-pointer"
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
