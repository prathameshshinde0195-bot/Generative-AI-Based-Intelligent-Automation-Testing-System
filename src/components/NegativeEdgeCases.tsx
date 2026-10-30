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
    if (c === 'boundary') return 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200';
    if (c === 'negative') return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200';
    if (c === 'security') return 'bg-purple-50 text-[#7c3aed] dark:bg-purple-950/40 dark:text-purple-300 border-purple-200';
    return 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200';
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-white dark:bg-slate-900">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center text-red-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              Negative & Boundary Edge Case Generator
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200">
                Adversarial & Fault Injection
              </span>
            </h2>
            <p className="text-xs text-muted">Generate boundary limits, missing/null parameters, session timeout, role violations, and security payloads</p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleGenerateEdgeCases}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border text-foreground hover:border-[#7c3aed] text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin text-[#7c3aed]' : ''}`} />
            <span>Generate Edge Cases</span>
          </button>

          {filtered.length > 0 && (
            <>
              <button
                onClick={handlePromoteAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-[#16a34a] text-xs font-semibold hover:bg-emerald-100 transition-colors"
                title="Promote all visible edge cases to main test suite"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add All to Test Suite</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-3.5 shadow-xs">
          <p className="text-[10px] text-muted uppercase font-bold">Total Edge Scenarios</p>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{negativeTestCases.length}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-xl p-3.5 shadow-xs">
          <p className="text-[10px] text-amber-800 dark:text-amber-400 uppercase font-bold">Boundary Cases</p>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {negativeTestCases.filter(c => c.category === 'boundary').length}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-xl p-3.5 shadow-xs">
          <p className="text-[10px] text-red-800 dark:text-red-400 uppercase font-bold">Negative / Faults</p>
          <p className="text-2xl font-black text-[#dc2626] mt-1">
            {negativeTestCases.filter(c => c.category === 'negative').length}
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 rounded-xl p-3.5 shadow-xs">
          <p className="text-[10px] text-purple-800 dark:text-purple-400 uppercase font-bold">Security & Auth</p>
          <p className="text-2xl font-black text-[#7c3aed] mt-1">
            {negativeTestCases.filter(c => c.category === 'security').length}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/60 border border-border rounded-xl text-xs">
        {scenarioCategories.map(cat => {
          const Icon = cat.icon;
          const isSelected = filter === cat.id;
          const count = cat.id === 'all'
            ? negativeTestCases.length
            : negativeTestCases.filter(tc => (tc.category || '').toLowerCase() === cat.id.toLowerCase()).length;
          return (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                isSelected
                  ? 'bg-[#7c3aed] text-white shadow-xs'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-border hover:border-border-bright'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-border rounded-2xl">
          <ShieldAlert className="w-16 h-16 text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-foreground">No Edge Cases in this Category</h3>
          <p className="text-xs text-muted mt-1 max-w-md text-center">
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
                className="bg-white dark:bg-slate-800 border border-border rounded-xl overflow-hidden shadow-xs hover:border-border-bright transition-colors"
              >
                {/* Header row */}
                <div
                  onClick={() => setExpandedTC(isExpanded ? null : tc.id)}
                  className="flex items-center gap-3 p-3.5 cursor-pointer text-xs"
                >
                  <span className="font-mono font-bold text-[#7c3aed] bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200">
                    {tc.testCaseId}
                  </span>

                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex-1 truncate">
                    {tc.title || tc.scenario}
                  </span>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCategoryBadge(tc.category)}`}>
                    {tc.category}
                  </span>

                  {/* Coverage toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTestCaseCoverage(tc.testCaseId); }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg flex items-center gap-1 border transition-colors ${
                      tc.isCovered
                        ? 'bg-emerald-50 text-[#16a34a] border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-border hover:bg-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{tc.isCovered ? 'Covered' : 'Mark Covered'}</span>
                  </button>

                  {/* Promote button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePromoteToSuite(tc); }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg flex items-center gap-1 border transition-colors ${
                      inMainSuite
                        ? 'bg-sky-50 text-[#0ea5e9] border-sky-200 opacity-80'
                        : 'bg-emerald-50 text-[#16a34a] border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{inMainSuite ? 'In Suite' : 'Add to Suite'}</span>
                  </button>

                  <div className="text-muted">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded Inspection */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border bg-slate-50/50 dark:bg-slate-850 p-4 space-y-3 text-xs"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="font-bold text-muted text-[10px] uppercase mb-0.5">Preconditions & Context</p>
                          <p className="text-slate-700 dark:text-slate-300">{tc.preconditions || 'None'}</p>
                        </div>
                        <div>
                          <p className="font-bold text-muted text-[10px] uppercase mb-0.5">Expected System Defense</p>
                          <p className="text-[#16a34a] font-medium">{tc.expectedResults}</p>
                        </div>
                      </div>

                      <div>
                        <p className="font-bold text-muted text-[10px] uppercase mb-1">Execution Steps</p>
                        <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300">
                          {tc.steps.map((step, si) => (
                            <li key={si}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                        <span className="text-[11px] font-bold text-muted">Risk Score:</span>
                        <div className="flex-1 max-w-xs h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              tc.riskScore >= 70 ? 'bg-red-500' : tc.riskScore >= 40 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${tc.riskScore}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-xs">{tc.riskScore}/100</span>
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
