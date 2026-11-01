import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, ChevronDown, ChevronUp, Bug, Flame, Lock, CheckCircle2,
  Download, Plus, RefreshCw, Globe, Clock
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { generateNegativeTestCases } from '../lib/ai-engine';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { TestCase } from '../lib/types';

const scenarioCategories = [
  { id: 'all', label: 'All Edge Cases', icon: ShieldAlert },
  { id: 'boundary', label: 'Boundary Value', icon: Flame },
  { id: 'negative', label: 'Invalid & Null Inputs', icon: Bug },
  { id: 'security', label: 'Security & Auth', icon: Lock },
  { id: 'rate-limit', label: 'Rate-Limit & Concurrency', icon: Clock },
  { id: 'unicode', label: 'Unicode & Localization', icon: Globe },
];

export default function NegativeEdgeCases() {
  const { negativeTestCases, setNegativeTestCases, toggleTestCaseCoverage, srsText, addTestCases, testCases } = useAppStore();
  const [expandedTC, setExpandedTC] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);

  // Filter
  const filtered = useMemo(() => {
    if (filter === 'all') return negativeTestCases;
    return negativeTestCases.filter(tc => (tc.category || '').toLowerCase() === filter.toLowerCase());
  }, [negativeTestCases, filter]);

  // Generate on-demand
  const handleGenerateEdgeCases = async () => {
    if (!srsText.trim()) {
      toast.error('Enter SRS requirements first to synthesize context-grounded edge cases.');
      return;
    }
    setIsGenerating(true);
    try {
      const cases = await generateNegativeTestCases(srsText);
      setNegativeTestCases(cases);
      toast.success(`Generated ${cases.length} negative and edge test cases`);
    } catch {
      toast.error('Failed to generate negative edge cases');
    } finally {
      setIsGenerating(false);
    }
  };

  // Promote single case into project testCases
  const handlePromoteToSuite = (tc: TestCase) => {
    const exists = testCases.some(c => c.testCaseId === tc.testCaseId);
    if (exists) {
      toast.info(`${tc.testCaseId} is already in the main project test suite`);
      return;
    }
    addTestCases([{ ...tc, category: tc.category || 'negative' }]);
    toast.success(`Promoted ${tc.testCaseId} to project test suite (eligible for script codegen & test data)`);
  };

  // Promote all filtered cases
  const handlePromoteAll = () => {
    const existingIds = new Set(testCases.map(c => c.testCaseId));
    const toAdd = filtered.filter(tc => !existingIds.has(tc.testCaseId));
    if (toAdd.length === 0) {
      toast.info('All displayed edge cases are already in the main test suite');
      return;
    }
    addTestCases(toAdd);
    toast.success(`Promoted ${toAdd.length} edge cases into the project test suite`);
  };

  const handleExportExcel = () => {
    const data = filtered.map(tc => ({
      'Test Case ID': tc.testCaseId,
      'Scenario': tc.title || tc.scenario,
      'Category': tc.category,
      'Priority': tc.priority,
      'Risk Score': tc.riskScore,
      'Preconditions': tc.preconditions,
      'Steps': tc.steps.join(' | '),
      'Expected Results': tc.expectedResults,
      'Requirement ID': tc.requirementId,
      'Coverage Status': tc.isCovered ? 'Covered' : 'Pending',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Negative Edge Cases');
    XLSX.writeFile(wb, `Negative-Edge-Cases-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getCategoryBadge = (cat: string) => {
    const c = (cat || '').toLowerCase();
    if (c === 'boundary') return 'bg-[#F0F9FF] text-[#0284C7] border border-[#E0F2FE] font-bold';
    if (c === 'negative') return 'bg-[#FDF2F8] text-[#BE185D] border border-[#FCE7F3] font-bold';
    if (c === 'security') return 'bg-[#FAF5FF] text-[#7C3AED] border border-[#EDE9FE] font-bold';
    return 'bg-[#F0F9FF] text-[#0284C7] border border-[#E0F2FE] font-bold';
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#F0F9FF]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#E0F2FE] bg-white p-5 rounded-2xl shadow-sm border">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white shadow-md shadow-sky-500/10">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2 tracking-tight">
              Negative & Boundary Edge Cases
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-[#FDF2F8] text-[#BE185D] border border-[#FCE7F3]">
                Fault Injection
              </span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5 font-medium">Generate boundary limits, missing/null parameters, session timeout, role violations, and security payloads</p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateEdgeCases}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border-2 border-sky-300 text-[#0284C7] hover:border-[#0EA5E9] text-xs font-black shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin text-[#0EA5E9]' : ''}`} />
            <span>Generate Edge Cases</span>
          </button>

          {filtered.length > 0 && (
            <>
              <button
                type="button"
                onClick={handlePromoteAll}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#DCFCE7] border-2 border-emerald-300 text-[#16A34A] text-xs font-black hover:opacity-90 transition-all cursor-pointer shadow-xs"
                title="Promote all visible edge cases to main test suite"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add All to Test Suite</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] text-white text-xs font-black shadow-md shadow-sky-500/20 hover:opacity-95 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* KPI Cards in White, Sky Blue, Purple, and Light Pink */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs text-[#0F172A] uppercase font-black tracking-wider">Total Edge Scenarios</p>
          <p className="text-3xl font-black text-[#0F172A] mt-1 tracking-tight">{negativeTestCases.length}</p>
        </div>
        <div className="bg-white border-2 border-sky-300 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs text-[#0284C7] uppercase font-black tracking-wider">Boundary Cases</p>
          <p className="text-3xl font-black text-[#0284C7] mt-1 tracking-tight">
            {negativeTestCases.filter(c => c.category === 'boundary').length}
          </p>
        </div>
        <div className="bg-white border-2 border-pink-300 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs text-[#BE185D] uppercase font-black tracking-wider">Negative / Faults</p>
          <p className="text-3xl font-black text-[#BE185D] mt-1 tracking-tight">
            {negativeTestCases.filter(c => c.category === 'negative').length}
          </p>
        </div>
        <div className="bg-white border-2 border-purple-300 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs text-[#7C3AED] uppercase font-black tracking-wider">Security & Auth</p>
          <p className="text-3xl font-black text-[#7C3AED] mt-1 tracking-tight">
            {negativeTestCases.filter(c => c.category === 'security').length}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-2.5 bg-white border-2 border-slate-200 rounded-2xl text-xs shadow-xs">
        {scenarioCategories.map(cat => {
          const Icon = cat.icon;
          const isSelected = filter === cat.id;
          const count = cat.id === 'all'
            ? negativeTestCases.length
            : negativeTestCases.filter(tc => (tc.category || '').toLowerCase() === cat.id.toLowerCase()).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFilter(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-black transition-all cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-[#8B5CF6] to-[#0EA5E9] text-white shadow-xs'
                  : 'bg-[#F8FCFF] text-slate-700 border-2 border-slate-200 hover:border-purple-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/25 text-white' : 'bg-purple-100 text-[#7C3AED]'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border-2 border-dashed border-sky-300 rounded-2xl shadow-xs">
          <ShieldAlert className="w-16 h-16 text-sky-300 mb-3" />
          <h3 className="text-base font-black text-[#0F172A]">No Edge Cases in this Category</h3>
          <p className="text-xs font-bold text-[#64748B] mt-1 max-w-md text-center">
            Click &ldquo;Generate Edge Cases&rdquo; to analyze your SRS requirements and generate boundary and fault scenarios.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((tc, idx) => {
            const isExpanded = expandedTC === tc.id;
            const inMainSuite = testCases.some(c => c.testCaseId === tc.testCaseId);
            return (
              <motion.div
                key={tc.id || tc.testCaseId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:border-[#8B5CF6] hover:shadow-sm transition-all"
              >
                {/* Header row */}
                <div
                  onClick={() => setExpandedTC(isExpanded ? null : tc.id)}
                  className="flex items-center gap-3.5 p-4 cursor-pointer text-xs"
                >
                  <span className="font-mono font-black text-[#7C3AED] bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200">
                    {tc.testCaseId}
                  </span>

                  <span className="font-black text-sm text-[#0F172A] flex-1 truncate">
                    {tc.title || tc.scenario}
                  </span>

                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${getCategoryBadge(tc.category)}`}>
                    {tc.category}
                  </span>

                  {/* Coverage toggle */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleTestCaseCoverage(tc.testCaseId); }}
                    className={`px-3 py-1.5 text-xs font-black rounded-xl flex items-center gap-1.5 border-2 transition-colors cursor-pointer ${
                      tc.isCovered
                        ? 'bg-[#DCFCE7] text-[#16A34A] border-emerald-300'
                        : 'bg-[#F8FCFF] text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{tc.isCovered ? 'Covered' : 'Mark Covered'}</span>
                  </button>

                  {/* Promote button */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlePromoteToSuite(tc); }}
                    className={`px-3 py-1.5 text-xs font-black rounded-xl flex items-center gap-1.5 border-2 transition-colors cursor-pointer ${
                      inMainSuite
                        ? 'bg-[#E0F2FE] text-[#0284C7] border-sky-300 opacity-90'
                        : 'bg-[#FAF5FF] text-[#7C3AED] border-purple-300 hover:bg-purple-100'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{inMainSuite ? 'In Suite' : 'Add to Suite'}</span>
                  </button>

                  <div className="text-[#64748B]">
                    {isExpanded ? <ChevronUp className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
                  </div>
                </div>

                {/* Expanded Inspection */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t-2 border-slate-100 bg-[#F8FCFF] p-4.5 space-y-3.5 text-xs"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded-xl border-2 border-slate-200">
                          <p className="font-black text-[#64748B] text-[10px] uppercase mb-1">Preconditions & Context</p>
                          <p className="text-[#0F172A] font-bold">{tc.preconditions || 'None'}</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border-2 border-emerald-200">
                          <p className="font-black text-[#16A34A] text-[10px] uppercase mb-1">Expected System Defense</p>
                          <p className="text-[#16A34A] font-bold">{tc.expectedResults}</p>
                        </div>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border-2 border-slate-200">
                        <p className="font-black text-[#0F172A] text-xs uppercase mb-1.5">Execution Steps</p>
                        <ol className="list-decimal list-inside space-y-1 text-[#0F172A] font-medium">
                          {tc.steps.map((step, si) => (
                            <li key={si}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      <div className="flex items-center gap-3 pt-2 border-t-2 border-slate-200">
                        <span className="text-xs font-black text-[#0F172A]">Risk Score:</span>
                        <div className="flex-1 max-w-xs h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              tc.riskScore >= 70 ? 'bg-[#BE185D]' : tc.riskScore >= 40 ? 'bg-amber-500' : 'bg-[#16A34A]'
                            }`}
                            style={{ width: `${tc.riskScore}%` }}
                          />
                        </div>
                        <span className="font-mono font-black text-xs text-[#0F172A]">{tc.riskScore}/100</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
