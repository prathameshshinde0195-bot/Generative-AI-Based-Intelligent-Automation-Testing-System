import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpDown, AlertTriangle, Sliders, Download,
  Flame, History, Edit2, Info, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { TestCase } from '../lib/types';

export default function TestPrioritization() {
  const { updateTestCase } = useAppStore();
  const allCases = useAppStore((s) => [...s.testCases, ...s.negativeTestCases]);

  // Weights configuration
  const [showWeightConfig, setShowWeightConfig] = useState(false);
  const [businessWeight, setBusinessWeight] = useState(35);
  const [securityWeight, setSecurityWeight] = useState(25);
  const [frequencyWeight, setFrequencyWeight] = useState(20);
  const [regressionWeight, setRegressionWeight] = useState(20);

  // Filter suite
  const [suiteFilter, setSuiteFilter] = useState<'all' | 'smoke' | 'regression' | 'critical'>('all');
  const [expandedTcId, setExpandedTcId] = useState<string | null>(null);

  // Manual priority edit modal
  const [editingTc, setEditingTc] = useState<TestCase | null>(null);
  const [overridePriority, setOverridePriority] = useState<'Critical' | 'High' | 'Medium' | 'Low'>('High');

  // Dynamic priority calculation based on weights
  const prioritizedCases = useMemo(() => {
    return allCases.map(tc => {
      // Factors evaluation
      const hasSecurity = tc.category === 'security' || (tc.scenario || '').toLowerCase().includes('security') || (tc.scenario || '').toLowerCase().includes('auth');
      const hasBoundary = tc.category === 'boundary' || tc.category === 'negative';
      const isCriticalReq = (tc.requirementId || '').includes('1') || (tc.requirementId || '').includes('001');

      // 0-100 scores
      const businessScore = isCriticalReq ? 90 : 65;
      const securityScore = hasSecurity ? 95 : 30;
      const frequencyScore = tc.classification === 'Positive' ? 85 : 45;
      const regScore = hasBoundary ? 80 : 50;

      // Weighted score
      const totalWeight = businessWeight + securityWeight + frequencyWeight + regressionWeight || 100;
      const computedScore = Math.round(
        (businessScore * businessWeight +
         securityScore * securityWeight +
         frequencyScore * frequencyWeight +
         regScore * regressionWeight) / totalWeight
      );

      // Inferred suite
      const isSmoke = (computedScore >= 75 && tc.classification !== 'Negative') || tc.priority === 'Critical';
      const isRegression = computedScore >= 50 || hasBoundary;

      // Explanation
      const reasoning = [
        hasSecurity ? 'High security/authentication sensitivity' : 'Standard security profile',
        isCriticalReq ? 'Maps to primary business workflow' : 'Secondary functional path',
        hasBoundary ? 'Edge/boundary condition requiring regression verification' : 'Core execution path',
      ];

      return {
        ...tc,
        computedScore,
        isSmoke,
        isRegression,
        reasoning,
      };
    }).sort((a, b) => b.computedScore - a.computedScore);
  }, [allCases, businessWeight, securityWeight, frequencyWeight, regressionWeight]);

  // Apply suite filter
  const displayedCases = useMemo(() => {
    if (suiteFilter === 'smoke') return prioritizedCases.filter(tc => tc.isSmoke);
    if (suiteFilter === 'regression') return prioritizedCases.filter(tc => tc.isRegression);
    if (suiteFilter === 'critical') return prioritizedCases.filter(tc => tc.computedScore >= 75 || tc.priority === 'High' || tc.priority === 'Critical');
    return prioritizedCases;
  }, [prioritizedCases, suiteFilter]);

  const highCount = displayedCases.filter(tc => tc.priority === 'High' || tc.priority === 'Critical' || tc.computedScore >= 75).length;
  const medCount = displayedCases.filter(tc => (tc.priority === 'Medium' || (tc.computedScore >= 45 && tc.computedScore < 75))).length;
  const lowCount = displayedCases.filter(tc => tc.priority === 'Low' || tc.computedScore < 45).length;

  const getPriorityBadge = (p: string, score: number) => {
    if (p === 'Critical' || p === 'High' || score >= 75) {
      return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200';
    }
    if (p === 'Medium' || score >= 45) {
      return 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200';
    }
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200';
  };

  const handleSavePriorityOverride = () => {
    if (!editingTc) return;
    updateTestCase(editingTc.testCaseId, { priority: overridePriority });
    toast.success(`Priority for ${editingTc.testCaseId} updated to ${overridePriority}`);
    setEditingTc(null);
  };

  const handleExportPlan = () => {
    const data = displayedCases.map((tc, idx) => ({
      'Execution Order': idx + 1,
      'Test Case ID': tc.testCaseId,
      'Title / Scenario': tc.title || tc.scenario,
      'Priority': tc.priority,
      'Computed Score': tc.computedScore,
      'Suite': tc.isSmoke ? 'Smoke + Regression' : tc.isRegression ? 'Regression' : 'Extended',
      'Category': tc.category,
      'Requirement ID': tc.requirementId,
      'Reasoning': tc.reasoning.join('; '),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Prioritized Execution Plan');
    XLSX.writeFile(wb, `Prioritized-Test-Plan-${suiteFilter}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#f0f9ff] dark:bg-slate-900">
      {/* Header Bar */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0] dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/40 flex items-center justify-center text-[#0ea5e9]">
            <ArrowUpDown className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
              Intelligent Test Case Prioritization
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-sky-50 text-[#0ea5e9] dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200">
                Risk-Based Execution
              </span>
            </h2>
            <p className="text-xs text-[#64748b]">Compute optimal test execution order by business criticality, risk, and regression sensitivity</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowWeightConfig(!showWeightConfig)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-[#e2e8f0] dark:border-slate-700 text-[#0f172a] dark:text-white hover:border-[#0ea5e9] text-xs font-semibold shadow-xs transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-[#0ea5e9]" />
            <span>Config Weights</span>
          </button>

          <button
            onClick={handleExportPlan}
            disabled={displayedCases.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Execution Plan</span>
          </button>
        </div>
      </motion.div>

      {/* Configurable Prioritization Weights Drawer */}
      <AnimatePresence>
        {showWeightConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#7c3aed]" />
                <span>Adjust Priority Scoring Weights</span>
              </h4>
              <span className="text-[11px] text-muted">Total: {businessWeight + securityWeight + frequencyWeight + regressionWeight}%</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="flex justify-between mb-1 font-semibold text-slate-700 dark:text-slate-300">
                  <span>Business Impact:</span>
                  <span className="text-[#7c3aed]">{businessWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={businessWeight}
                  onChange={(e) => setBusinessWeight(Number(e.target.value))}
                  className="w-full accent-[#7c3aed]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 font-semibold text-slate-700 dark:text-slate-300">
                  <span>Security Risk:</span>
                  <span className="text-[#7c3aed]">{securityWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={securityWeight}
                  onChange={(e) => setSecurityWeight(Number(e.target.value))}
                  className="w-full accent-[#7c3aed]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 font-semibold text-slate-700 dark:text-slate-300">
                  <span>Execution Frequency:</span>
                  <span className="text-[#7c3aed]">{frequencyWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={frequencyWeight}
                  onChange={(e) => setFrequencyWeight(Number(e.target.value))}
                  className="w-full accent-[#7c3aed]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 font-semibold text-slate-700 dark:text-slate-300">
                  <span>Regression Sensitivity:</span>
                  <span className="text-[#7c3aed]">{regressionWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={regressionWeight}
                  onChange={(e) => setRegressionWeight(Number(e.target.value))}
                  className="w-full accent-[#7c3aed]"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suite Filters & Summary Cards */}
      <div className="space-y-3">
        {/* Suite Selection Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 border border-border rounded-xl">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold text-muted text-[11px] uppercase mr-1">Target Suite:</span>
            {[
              { id: 'all', label: 'All Prioritized Cases', icon: ArrowUpDown },
              { id: 'smoke', label: 'Suggested Smoke Suite', icon: Flame },
              { id: 'regression', label: 'Regression Suite', icon: History },
              { id: 'critical', label: 'Critical Risk Only', icon: AlertTriangle },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = suiteFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSuiteFilter(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#7c3aed] text-white shadow-xs'
                      : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-border hover:border-border-bright'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <span className="text-xs text-muted font-medium">
            Showing {displayedCases.length} of {allCases.length} test cases
          </span>
        </div>

        {/* Priority KPI breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'High Priority / Critical', count: highCount, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200' },
            { label: 'Medium Priority', count: medCount, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200' },
            { label: 'Low Priority', count: lowCount, color: 'text-[#16a34a]', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3 border shadow-xs flex items-center justify-between`}>
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wider font-bold">{s.label}</p>
                <p className={`text-2xl font-black ${s.color} mt-0.5`}>{s.count}</p>
              </div>
              <span className="text-xs text-muted font-medium">
                {displayedCases.length > 0 ? `${Math.round((s.count / displayedCases.length) * 100)}%` : '0%'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {displayedCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-border rounded-2xl">
          <ArrowUpDown className="w-16 h-16 text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-foreground">No Test Cases Available</h3>
          <p className="text-xs text-muted mt-1 max-w-md text-center">
            Generate test cases in the SRS Input module to compute intelligent execution priorities.
          </p>
        </div>
      ) : (
        /* Prioritized Test Execution Table */
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="grid grid-cols-[60px_100px_1fr_110px_130px_110px_90px_60px] gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-muted uppercase tracking-wider border-b border-border">
            <span>Rank</span>
            <span>Test ID</span>
            <span>Scenario / Title</span>
            <span>Priority</span>
            <span>Risk Score</span>
            <span>Suggested Suite</span>
            <span>Category</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-border/60 max-h-[560px] overflow-y-auto">
            {displayedCases.map((tc, idx) => {
              const isExpanded = expandedTcId === tc.testCaseId;
              return (
                <div key={tc.id || tc.testCaseId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="grid grid-cols-[60px_100px_1fr_110px_130px_110px_90px_60px] gap-2 px-4 py-3 items-center text-xs">
                    {/* Rank */}
                    <span className="font-mono font-bold text-[#7c3aed]">#{idx + 1}</span>

                    {/* Test ID */}
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{tc.testCaseId}</span>

                    {/* Scenario */}
                    <div className="min-w-0 pr-2">
                      <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{tc.title || tc.scenario}</p>
                      <p className="text-[10px] text-muted truncate">Req: {tc.requirementId}</p>
                    </div>

                    {/* Priority Badge */}
                    <div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getPriorityBadge(tc.priority, tc.computedScore)}`}>
                        {tc.priority}
                      </span>
                    </div>

                    {/* Risk / Priority Score Bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            tc.computedScore >= 75 ? 'bg-red-500' : tc.computedScore >= 45 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${tc.computedScore}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-xs">{tc.computedScore}</span>
                    </div>

                    {/* Suggested Suite */}
                    <div>
                      {tc.isSmoke ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200">
                          <Flame className="w-3 h-3" /> Smoke
                        </span>
                      ) : tc.isRegression ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200">
                          Regression
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted">Extended</span>
                      )}
                    </div>

                    {/* Category */}
                    <span className="text-muted capitalize text-[11px] truncate">{tc.category}</span>

                    {/* Action */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditingTc(tc);
                          setOverridePriority(tc.priority as any);
                        }}
                        className="p-1 rounded text-muted hover:text-[#7c3aed] transition-colors"
                        title="Override Priority"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setExpandedTcId(isExpanded ? null : tc.testCaseId)}
                        className="p-1 rounded text-muted hover:text-foreground transition-colors"
                        title="View Reasoning"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Reasoning Card */}
                  {isExpanded && (
                    <div className="px-4 py-3 bg-purple-50/40 dark:bg-purple-950/20 border-t border-border/50 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#7c3aed] uppercase">
                        <Info className="w-3.5 h-3.5" />
                        <span>Explainable Priority Factors:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-700 dark:text-slate-300 text-[11px]">
                        {tc.reasoning.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                        <li>Preconditions: {tc.preconditions || 'None specified'}</li>
                        <li>Expected Result: {tc.expectedResults}</li>
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual Priority Override Modal */}
      {editingTc && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#7c3aed]" />
                <span>Override Priority: {editingTc.testCaseId}</span>
              </h3>
              <button onClick={() => setEditingTc(null)} className="text-muted hover:text-foreground">
                ✕
              </button>
            </div>

            <p className="text-xs text-muted">
              Adjust priority classification for <span className="font-semibold text-foreground">{editingTc.scenario}</span>.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted uppercase">Select Priority</label>
              <div className="grid grid-cols-4 gap-2">
                {(['Critical', 'High', 'Medium', 'Low'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setOverridePriority(p)}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                      overridePriority === p
                        ? 'bg-[#7c3aed] text-white border-[#7c3aed]'
                        : 'bg-surface border-border text-foreground hover:border-[#7c3aed]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setEditingTc(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePriorityOverride}
                className="px-4 py-1.5 text-xs rounded-lg bg-[#7c3aed] text-white font-semibold hover:bg-[#6d28d9]"
              >
                Save Priority
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
