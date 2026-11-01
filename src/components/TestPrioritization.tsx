import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpDown, AlertTriangle, Sliders, Download,
  Flame, History, Edit2, Info, ChevronDown, ChevronUp, Sparkles,
  ShieldCheck, Zap
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { TestCase } from '../lib/types';

export default function TestPrioritization() {
  const { updateTestCase, setActiveFeature } = useAppStore();
  const testCases = useAppStore((s) => s.testCases) || [];
  const negativeCases = useAppStore((s) => s.negativeTestCases) || [];

  // Filter out any null or malformed items safely
  const allCases: TestCase[] = useMemo(() => {
    return [...testCases, ...negativeCases].filter(
      (tc): tc is TestCase => Boolean(tc && typeof tc === 'object')
    );
  }, [testCases, negativeCases]);

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
    return allCases.map((tc, index) => {
      const tcId = tc.testCaseId || tc.id || `TC-${index + 1}`;
      const category = (tc.category || '').toLowerCase();
      const scenario = (tc.scenario || tc.title || '').toLowerCase();
      const reqId = String(tc.requirementId || '');

      // Factors evaluation
      const hasSecurity =
        category === 'security' ||
        scenario.includes('security') ||
        scenario.includes('auth') ||
        scenario.includes('token') ||
        scenario.includes('encrypt');
      const hasBoundary =
        category === 'boundary' ||
        category === 'negative' ||
        scenario.includes('boundary') ||
        scenario.includes('edge') ||
        scenario.includes('invalid');
      const isCriticalReq =
        reqId.includes('1') ||
        reqId.includes('001') ||
        reqId.toLowerCase().includes('crit') ||
        scenario.includes('payment') ||
        scenario.includes('checkout') ||
        scenario.includes('login');

      // 0-100 scores
      const businessScore = isCriticalReq ? 92 : 65;
      const securityScore = hasSecurity ? 96 : 35;
      const frequencyScore = (tc.classification || 'Positive') === 'Positive' ? 85 : 45;
      const regScore = hasBoundary ? 85 : 50;

      // Weighted score
      const totalWeight = businessWeight + securityWeight + frequencyWeight + regressionWeight || 100;
      const computedScore = Math.min(
        100,
        Math.max(
          10,
          Math.round(
            (businessScore * businessWeight +
              securityScore * securityWeight +
              frequencyScore * frequencyWeight +
              regScore * regressionWeight) /
              totalWeight
          )
        )
      );

      // Inferred suite
      const isSmoke =
        (computedScore >= 75 && tc.classification !== 'Negative') ||
        tc.priority === 'Critical' ||
        isCriticalReq;
      const isRegression = computedScore >= 45 || hasBoundary;

      // Explainable Reasoning
      const reasoning = [
        hasSecurity
          ? 'High security & authentication sensitivity (Weight: ' + securityWeight + '%)'
          : 'Standard operational security profile',
        isCriticalReq
          ? 'Maps directly to primary business workflow (Weight: ' + businessWeight + '%)'
          : 'Secondary or auxiliary functional pathway',
        hasBoundary
          ? 'Edge/boundary condition critical for regression stability'
          : 'Nominal happy-path execution flow',
      ];

      return {
        ...tc,
        testCaseId: tcId,
        computedScore,
        isSmoke,
        isRegression,
        reasoning,
      };
    }).sort((a, b) => b.computedScore - a.computedScore);
  }, [allCases, businessWeight, securityWeight, frequencyWeight, regressionWeight]);

  // Apply suite filter
  const displayedCases = useMemo(() => {
    if (suiteFilter === 'smoke') return prioritizedCases.filter((tc) => tc.isSmoke);
    if (suiteFilter === 'regression') return prioritizedCases.filter((tc) => tc.isRegression);
    if (suiteFilter === 'critical')
      return prioritizedCases.filter(
        (tc) => tc.computedScore >= 75 || tc.priority === 'High' || tc.priority === 'Critical'
      );
    return prioritizedCases;
  }, [prioritizedCases, suiteFilter]);

  const highCount = displayedCases.filter(
    (tc) => tc.priority === 'High' || tc.priority === 'Critical' || tc.computedScore >= 75
  ).length;
  const medCount = displayedCases.filter(
    (tc) => tc.priority === 'Medium' || (tc.computedScore >= 45 && tc.computedScore < 75)
  ).length;
  const lowCount = displayedCases.filter(
    (tc) => tc.priority === 'Low' || tc.computedScore < 45
  ).length;

  const getPriorityBadge = (p: string, score: number) => {
    if (p === 'Critical' || p === 'High' || score >= 75) {
      return 'bg-[#FDF2F8] text-[#BE185D] border border-[#FCE7F3] font-bold';
    }
    if (p === 'Medium' || score >= 45) {
      return 'bg-[#FAF5FF] text-[#7C3AED] border border-[#EDE9FE] font-bold';
    }
    return 'bg-[#F0F9FF] text-[#0284C7] border border-[#E0F2FE] font-bold';
  };

  const handleSavePriorityOverride = () => {
    if (!editingTc) return;
    const targetId = editingTc.testCaseId || editingTc.id;
    if (targetId) {
      updateTestCase(targetId, { priority: overridePriority });
      toast.success(`Priority for ${targetId} updated to ${overridePriority}`);
    }
    setEditingTc(null);
  };

  const handleExportPlan = () => {
    try {
      const data = displayedCases.map((tc, idx) => ({
        'Execution Order': idx + 1,
        'Test Case ID': tc.testCaseId || tc.id || `TC-${idx + 1}`,
        'Title / Scenario': tc.title || tc.scenario || 'Untitled',
        'Priority': tc.priority || 'Medium',
        'Risk & Priority Score': tc.computedScore,
        'Recommended Suite': tc.isSmoke ? 'Smoke + Regression' : tc.isRegression ? 'Regression' : 'Extended',
        'Category': tc.category || 'Functional',
        'Requirement ID': tc.requirementId || 'N/A',
        'Explainable Factors': (tc.reasoning || []).join('; '),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Prioritized Test Plan');
      XLSX.writeFile(wb, `Prioritized-Test-Plan-${suiteFilter}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Prioritized test plan exported to Excel successfully!');
    } catch (err: any) {
      toast.error('Failed to export Excel plan: ' + (err?.message || 'Unknown error'));
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#F0F9FF]">
      {/* Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#E0F2FE] bg-white p-5 rounded-2xl shadow-sm border"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white shadow-md shadow-sky-500/10">
            <ArrowUpDown className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2 tracking-tight">
              Intelligent Test Prioritization
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-[#FDF2F8] text-[#BE185D] border border-[#FCE7F3]">
                AI Risk-Ranked
              </span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5 font-medium">
              Dynamically computes the highest-ROI test execution sequence based on business criticality, regression risk, and security surface.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowWeightConfig(!showWeightConfig)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] hover:border-[#8B5CF6] hover:text-[#7C3AED] text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-[#8B5CF6]" />
            <span>{showWeightConfig ? 'Hide Weights' : 'Adjust Weights'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportPlan}
            disabled={displayedCases.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] hover:opacity-95 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Plan (.xlsx)</span>
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
            className="bg-white border border-[#EDE9FE] rounded-2xl p-5 space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-[#F3E8FF] pb-3">
              <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
                <span>Fine-Tune Prioritization Weighting Matrix</span>
              </h4>
              <span className="text-xs font-bold text-[#8B5CF6] bg-[#FAF5FF] px-2.5 py-1 rounded-lg border border-[#EDE9FE]">
                Total Weight: {businessWeight + securityWeight + frequencyWeight + regressionWeight}%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-[#F0F9FF] border border-[#E0F2FE] rounded-xl">
                <div className="flex justify-between mb-1.5 font-bold text-[#0F172A]">
                  <span className="text-[#0284C7]">Business Impact:</span>
                  <span className="text-[#0284C7] font-mono">{businessWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={businessWeight}
                  onChange={(e) => setBusinessWeight(Number(e.target.value))}
                  className="w-full accent-[#0EA5E9]"
                />
                <p className="text-[10px] text-[#64748B] mt-1">Core workflows & mission-critical revenue paths</p>
              </div>

              <div className="p-3 bg-[#FAF5FF] border border-[#EDE9FE] rounded-xl">
                <div className="flex justify-between mb-1.5 font-bold text-[#0F172A]">
                  <span className="text-[#7C3AED]">Security & Auth Risk:</span>
                  <span className="text-[#7C3AED] font-mono">{securityWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={securityWeight}
                  onChange={(e) => setSecurityWeight(Number(e.target.value))}
                  className="w-full accent-[#8B5CF6]"
                />
                <p className="text-[10px] text-[#64748B] mt-1">Authentication, token, data sensitivity</p>
              </div>

              <div className="p-3 bg-[#FDF2F8] border border-[#FCE7F3] rounded-xl">
                <div className="flex justify-between mb-1.5 font-bold text-[#0F172A]">
                  <span className="text-[#BE185D]">Execution Frequency:</span>
                  <span className="text-[#BE185D] font-mono">{frequencyWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={frequencyWeight}
                  onChange={(e) => setFrequencyWeight(Number(e.target.value))}
                  className="w-full accent-[#EC4899]"
                />
                <p className="text-[10px] text-[#64748B] mt-1">How often users trigger this functional path</p>
              </div>

              <div className="p-3 bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl">
                <div className="flex justify-between mb-1.5 font-bold text-[#0F172A]">
                  <span className="text-[#16A34A]">Regression Sensitivity:</span>
                  <span className="text-[#16A34A] font-mono">{regressionWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={regressionWeight}
                  onChange={(e) => setRegressionWeight(Number(e.target.value))}
                  className="w-full accent-[#16A34A]"
                />
                <p className="text-[10px] text-[#64748B] mt-1">Boundary, negative, & change-prone areas</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suite Filters & Summary KPI Cards */}
      <div className="space-y-4">
        {/* Suite Selection Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-[#E2E8F0] rounded-2xl shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-[#64748B] text-[11px] uppercase mr-1">Target Suite:</span>
            {[
              { id: 'all', label: 'All Prioritized Cases', icon: ArrowUpDown },
              { id: 'smoke', label: 'Suggested Smoke Suite', icon: Flame },
              { id: 'regression', label: 'Regression Suite', icon: History },
              { id: 'critical', label: 'Critical Risk Only', icon: AlertTriangle },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = suiteFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSuiteFilter(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] text-white shadow-md shadow-sky-500/20'
                      : 'bg-white hover:bg-slate-50 text-[#64748B] hover:text-[#0F172A] border border-[#CBD5E1]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <span className="text-xs text-[#64748B] font-semibold bg-[#F0F9FF] px-3 py-1.5 rounded-xl border border-sky-100">
            Showing <strong className="text-[#0284C7]">{displayedCases.length}</strong> of {allCases.length} test cases
          </span>
        </div>

        {/* Priority KPI breakdown Cards in White, Sky Blue, Purple, and Light Pink */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-[#FCE7F3] rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FDF2F8] text-[#BE185D] flex items-center justify-center font-bold">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">High / Critical Priority</p>
                <p className="text-2xl font-black text-[#BE185D] mt-0.5">{highCount}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-[#BE185D] bg-[#FDF2F8] px-2.5 py-1 rounded-lg border border-[#FCE7F3]">
              {displayedCases.length > 0 ? `${Math.round((highCount / displayedCases.length) * 100)}%` : '0%'}
            </span>
          </div>

          <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FAF5FF] text-[#7C3AED] flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Medium Priority</p>
                <p className="text-2xl font-black text-[#7C3AED] mt-0.5">{medCount}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-[#7C3AED] bg-[#FAF5FF] px-2.5 py-1 rounded-lg border border-[#EDE9FE]">
              {displayedCases.length > 0 ? `${Math.round((medCount / displayedCases.length) * 100)}%` : '0%'}
            </span>
          </div>

          <div className="bg-white border border-[#E0F2FE] rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F0F9FF] text-[#0284C7] flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Low Priority</p>
                <p className="text-2xl font-black text-[#0284C7] mt-0.5">{lowCount}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-[#0284C7] bg-[#F0F9FF] px-2.5 py-1 rounded-lg border border-sky-100">
              {displayedCases.length > 0 ? `${Math.round((lowCount / displayedCases.length) * 100)}%` : '0%'}
            </span>
          </div>
        </div>
      </div>

      {displayedCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-[#CBD5E1] rounded-3xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E0F2FE] via-[#FAF5FF] to-[#FDF2F8] text-[#0EA5E9] flex items-center justify-center mb-4">
            <ArrowUpDown className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#0F172A]">No Prioritized Test Cases Yet</h3>
          <p className="text-xs text-[#64748B] mt-1 max-w-md">
            Generate test cases in the SRS Input & Generator module to automatically compute risk scores, smoke test tags, and regression ranking.
          </p>
          <button
            type="button"
            onClick={() => setActiveFeature('srs-input')}
            className="mt-5 px-5 py-2.5 bg-gradient-to-r from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] text-white font-bold text-xs rounded-xl shadow-md transition-all hover:opacity-95 cursor-pointer"
          >
            Go to SRS Input & Generator
          </button>
        </div>
      ) : (
        /* Prioritized Test Execution Table */
        <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-[60px_110px_1fr_110px_140px_120px_100px_70px] gap-2 px-4 py-3 bg-[#F8FAFC] text-[10px] font-bold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">
            <span>Rank</span>
            <span>Test ID</span>
            <span>Scenario / Title</span>
            <span>Priority</span>
            <span>Risk Score</span>
            <span>Suggested Suite</span>
            <span>Category</span>
            <span className="text-right">Action</span>
          </div>

          <div className="divide-y divide-[#F1F5F9] max-h-[580px] overflow-y-auto">
            {displayedCases.map((tc, idx) => {
              const isExpanded = expandedTcId === tc.testCaseId;
              const score = tc.computedScore;

              return (
                <div key={tc.testCaseId || idx} className="hover:bg-slate-50/70 transition-colors">
                  <div className="grid grid-cols-[60px_110px_1fr_110px_140px_120px_100px_70px] gap-2 px-4 py-3.5 items-center text-xs">
                    {/* Rank */}
                    <span className="font-mono font-bold text-[#8B5CF6] bg-[#FAF5FF] w-7 h-7 rounded-lg flex items-center justify-center border border-[#EDE9FE]">
                      #{idx + 1}
                    </span>

                    {/* Test ID */}
                    <span className="font-mono font-bold text-[#0F172A]">{tc.testCaseId}</span>

                    {/* Scenario */}
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-[#0F172A] truncate">{tc.title || tc.scenario || 'Untitled Case'}</p>
                      <p className="text-[10px] text-[#64748B] truncate">Req: {tc.requirementId || 'Unlinked'}</p>
                    </div>

                    {/* Priority Badge */}
                    <div>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full ${getPriorityBadge(tc.priority, score)}`}>
                        {tc.priority}
                      </span>
                    </div>

                    {/* Risk / Priority Score Bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-[#F1F5F9] rounded-full overflow-hidden border border-[#E2E8F0]">
                        <div
                          className={`h-full rounded-full ${
                            score >= 75
                              ? 'bg-gradient-to-r from-[#EC4899] to-[#BE185D]'
                              : score >= 45
                              ? 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED]'
                              : 'bg-gradient-to-r from-[#0EA5E9] to-[#0284C7]'
                          }`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-xs text-[#0F172A]">{score}</span>
                    </div>

                    {/* Suggested Suite */}
                    <div>
                      {tc.isSmoke ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#FDF2F8] text-[#BE185D] border border-[#FCE7F3]">
                          <Flame className="w-3 h-3 text-[#BE185D]" /> Smoke
                        </span>
                      ) : tc.isRegression ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#F0F9FF] text-[#0284C7] border border-[#E0F2FE]">
                          Regression
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-lg">
                          Extended
                        </span>
                      )}
                    </div>

                    {/* Category */}
                    <span className="text-[#64748B] capitalize text-[11px] font-medium truncate">{tc.category || 'Functional'}</span>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTc(tc);
                          setOverridePriority(tc.priority as any);
                        }}
                        className="p-1.5 rounded-lg text-[#64748B] hover:text-[#8B5CF6] hover:bg-[#FAF5FF] transition-all cursor-pointer"
                        title="Override Priority"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedTcId(isExpanded ? null : tc.testCaseId)}
                        className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0EA5E9] hover:bg-[#F0F9FF] transition-all cursor-pointer"
                        title="View Explainable Factors"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Reasoning Card */}
                  {isExpanded && (
                    <div className="px-5 py-3.5 bg-[#FAF5FF] border-t border-[#EDE9FE] text-xs space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#7C3AED] uppercase tracking-wider">
                        <Info className="w-3.5 h-3.5 text-[#8B5CF6]" />
                        <span>Explainable AI Risk Factors:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-[#0F172A] text-xs">
                        {(tc.reasoning || []).map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                        <li>
                          <strong>Preconditions:</strong> {tc.preconditions || 'Standard environment setup'}
                        </li>
                        <li>
                          <strong>Expected Result:</strong> {tc.expectedResults || 'System behaves according to specification'}
                        </li>
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
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#8B5CF6]" />
                <span>Adjust Priority: {editingTc.testCaseId}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingTc(null)}
                className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#64748B]">
              Override priority ranking for{' '}
              <strong className="text-[#0F172A]">{editingTc.scenario || editingTc.title}</strong>:
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                Select New Priority
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['Critical', 'High', 'Medium', 'Low'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setOverridePriority(p)}
                    className={`py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      overridePriority === p
                        ? p === 'Critical' || p === 'High'
                          ? 'bg-[#FDF2F8] text-[#BE185D] border-[#FCE7F3] shadow-xs'
                          : p === 'Medium'
                          ? 'bg-[#FAF5FF] text-[#7C3AED] border-[#EDE9FE] shadow-xs'
                          : 'bg-[#F0F9FF] text-[#0284C7] border-[#E0F2FE] shadow-xs'
                        : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#8B5CF6]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setEditingTc(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-[#CBD5E1] text-[#64748B] hover:text-[#0F172A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePriorityOverride}
                className="px-5 py-2 text-xs rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:opacity-95 text-white font-bold shadow-md cursor-pointer"
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
