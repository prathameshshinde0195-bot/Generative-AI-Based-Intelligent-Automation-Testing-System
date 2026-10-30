import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, AlertCircle, CheckCircle2, Sliders, Download,
  Plus, ArrowRight, PieChart as PieIcon, Activity
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export default function CoverageAnalyzer() {
  const { coverage, traceability, testCases, negativeTestCases, extractedRequirements, setActiveFeature, addTestCases } = useAppStore();
  const allCases = useMemo(() => [...testCases, ...negativeTestCases], [testCases, negativeTestCases]);

  // CI/CD Coverage Gate threshold
  const [coverageGate, setCoverageGate] = useState(80);

  // Compute live coverage if not set in store
  const activeCoverage = useMemo(() => {
    if (coverage && coverage.totalRequirements > 0) return coverage;

    const totalReqs = extractedRequirements.length > 0 ? extractedRequirements.length : Math.max(1, Math.ceil(allCases.length / 2));
    const coveredReqIds = new Set(allCases.map(tc => tc.requirementId));
    const coveredCount = Math.min(totalReqs, coveredReqIds.size || allCases.length);
    const missing = extractedRequirements
      .filter(r => !coveredReqIds.has(r.requirementId))
      .map(r => r.requirementId);

    const categories = ['functional', 'negative', 'security', 'boundary', 'performance'];
    const categoryBreakdown = categories.map(cat => {
      const count = allCases.filter(tc => (tc.category || '').toLowerCase() === cat).length;
      return {
        category: cat.charAt(0).toUpperCase() + cat.slice(1),
        count,
        percentage: allCases.length > 0 ? Math.round((count / allCases.length) * 100) : 0,
      };
    }).filter(c => c.count > 0);

    return {
      totalRequirements: totalReqs,
      coveredRequirements: coveredCount,
      coveragePercentage: Math.round((coveredCount / Math.max(1, totalReqs)) * 100),
      missingRequirements: missing,
      categoryBreakdown,
    };
  }, [coverage, extractedRequirements, allCases]);

  // Execution coverage vs Requirement coverage
  const executedCases = allCases.filter(tc => tc.executionStatus === 'Pass' || tc.executionStatus === 'Fail');
  const executionCoveragePct = allCases.length > 0 ? Math.round((executedCases.length / allCases.length) * 100) : 0;

  const coveragePie = [
    { name: 'Covered Requirements', value: activeCoverage.coveredRequirements, color: '#16a34a' },
    { name: 'Uncovered Requirements', value: Math.max(0, activeCoverage.totalRequirements - activeCoverage.coveredRequirements), color: '#dc2626' },
  ].filter(d => d.value > 0);

  const categoryColors = ['#7c3aed', '#0ea5e9', '#16a34a', '#f59e0b', '#dc2626', '#ec4899'];

  // 1-Click Generate Missing Test Case
  const handleGenerateMissingTest = (reqId: string) => {
    const missingReq = extractedRequirements.find(r => r.requirementId === reqId);
    const newCase = {
      id: `tc-auto-${Date.now()}`,
      testCaseId: `TC-${reqId}-01`,
      title: `Verify ${missingReq?.title || reqId} under normal and boundary conditions`,
      scenario: `Verify core functional workflow for ${missingReq?.title || reqId}`,
      requirementId: reqId,
      requirementDescription: missingReq?.description || `Specification for ${reqId}`,
      preconditions: 'System configured with verified user role and active state.',
      steps: [
        '1. Access system module corresponding to requirement',
        '2. Provide valid input parameters complying with schema',
        '3. Trigger execution workflow and observe system response',
      ],
      expectedResults: 'System executes operation successfully without errors and logs audit telemetry.',
      priority: 'High' as const,
      category: 'functional' as const,
      riskScore: 60,
      tags: ['gap-filler', 'functional'],
      createdAt: new Date().toISOString(),
      isCovered: true,
    };

    addTestCases([newCase]);
    toast.success(`Generated and added gap test case ${newCase.testCaseId} for ${reqId}`);
  };

  const handleExportCoverageReport = () => {
    const summary = [
      { Metric: 'Total Requirements', Value: activeCoverage.totalRequirements },
      { Metric: 'Covered Requirements', Value: activeCoverage.coveredRequirements },
      { Metric: 'Requirement Coverage %', Value: `${activeCoverage.coveragePercentage}%` },
      { Metric: 'Execution Coverage %', Value: `${executionCoveragePct}%` },
      { Metric: 'CI/CD Quality Gate Threshold', Value: `${coverageGate}%` },
      { Metric: 'Gate Status', Value: activeCoverage.coveragePercentage >= coverageGate ? 'PASSED' : 'FAILED' },
      { Metric: 'Missing Requirements', Value: activeCoverage.missingRequirements.join(', ') || 'None' },
    ];

    const ws = XLSX.utils.json_to_sheet(summary);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Coverage Summary');
    XLSX.writeFile(wb, `Coverage-Analyzer-Report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Coverage report exported to Excel');
  };

  const passesGate = activeCoverage.coveragePercentage >= coverageGate;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-white dark:bg-slate-900">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/40 flex items-center justify-center text-[#0ea5e9]">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              Test Coverage Analyzer & Gap Detector
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200">
                Quality Gate
              </span>
            </h2>
            <p className="text-xs text-muted">Verify requirement and execution test coverage with missing scenario gap alerts</p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* CI/CD Gate Indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${
            passesGate
              ? 'bg-emerald-50 text-[#16a34a] border-emerald-200'
              : 'bg-red-50 text-[#dc2626] border-red-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${passesGate ? 'bg-[#16a34a]' : 'bg-[#dc2626]'}`} />
            <span>CI Gate (≥{coverageGate}%): {passesGate ? 'PASSED' : 'BLOCKED'}</span>
          </div>

          <button
            onClick={handleExportCoverageReport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Coverage Report</span>
          </button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-4 shadow-xs">
          <p className="text-[10px] text-muted uppercase font-bold">Total Requirements</p>
          <p className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-1">{activeCoverage.totalRequirements}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 rounded-xl p-4 shadow-xs">
          <p className="text-[10px] text-emerald-800 dark:text-emerald-400 uppercase font-bold">Covered Requirements</p>
          <p className="text-3xl font-black text-[#16a34a] mt-1">{activeCoverage.coveredRequirements}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-4 shadow-xs">
          <p className="text-[10px] text-muted uppercase font-bold">Requirement Coverage %</p>
          <p className={`text-3xl font-black mt-1 ${activeCoverage.coveragePercentage >= 80 ? 'text-[#16a34a]' : activeCoverage.coveragePercentage >= 50 ? 'text-amber-500' : 'text-[#dc2626]'}`}>
            {activeCoverage.coveragePercentage}%
          </p>
        </div>
        <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 rounded-xl p-4 shadow-xs">
          <p className="text-[10px] text-sky-800 dark:text-sky-400 uppercase font-bold">Execution Coverage %</p>
          <p className="text-3xl font-black text-[#0ea5e9] mt-1">{executionCoveragePct}%</p>
        </div>
      </div>

      {/* Threshold Config Slider */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-border rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#7c3aed]" />
          <span className="font-bold text-foreground">Configure CI/CD Coverage Gate:</span>
          <span className="font-mono font-bold text-[#7c3aed] bg-purple-50 px-2 py-0.5 rounded border border-purple-200">{coverageGate}%</span>
        </div>
        <div className="w-full sm:w-64">
          <input
            type="range"
            min="50"
            max="100"
            value={coverageGate}
            onChange={(e) => setCoverageGate(Number(e.target.value))}
            className="w-full accent-[#7c3aed]"
          />
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coverage Overview Donut */}
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-[#7c3aed]" />
            <span>Requirement Coverage Ratio</span>
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={coveragePie} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" stroke="none">
                {coveragePie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#172033', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            {coveragePie.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                <span className="text-xs text-muted font-medium">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Test Category Distribution */}
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0ea5e9]" />
            <span>Test Type & Category Distribution</span>
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={activeCoverage.categoryBreakdown}>
              <XAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#172033', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
              <Bar dataKey="count" name="Test Cases" fill="#0ea5e9" radius={[4, 4, 0, 0]}>
                {activeCoverage.categoryBreakdown.map((_, i) => <Cell key={i} fill={categoryColors[i % categoryColors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Missing Requirements Alert & 1-Click Gap Remediation */}
      {activeCoverage.missingRequirements.length > 0 && (
        <div className="bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h3 className="text-sm font-bold text-red-700 dark:text-red-300">
                Coverage Gap Detected: {activeCoverage.missingRequirements.length} Uncovered Requirements
              </h3>
            </div>
            <span className="text-xs text-red-600 font-medium">Click &ldquo;Generate Test Case&rdquo; to close gaps</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeCoverage.missingRequirements.map(reqId => (
              <div key={reqId} className="bg-white dark:bg-slate-800 border border-red-200 rounded-lg p-3 flex items-center justify-between text-xs gap-2">
                <div>
                  <span className="font-mono font-bold text-red-600">{reqId}</span>
                  <p className="text-[11px] text-muted truncate">No active test case mapped</p>
                </div>
                <button
                  onClick={() => handleGenerateMissingTest(reqId)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 font-semibold text-xs transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Generate Test</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Requirement Coverage Progress List */}
      {traceability.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Per-Requirement Traceability Progress</h3>
            <button
              onClick={() => setActiveFeature('traceability')}
              className="text-xs text-[#7c3aed] font-semibold hover:underline flex items-center gap-1"
            >
              <span>View Full RTM</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {traceability.map(entry => (
              <div key={entry.requirementId} className="flex items-center gap-3 text-xs">
                <span className="font-mono font-bold text-[#7c3aed] w-24 shrink-0">{entry.requirementId}</span>
                <span className="text-slate-700 dark:text-slate-300 truncate w-64 shrink-0">{entry.requirementText}</span>
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${entry.coverage >= 80 ? 'bg-[#16a34a]' : entry.coverage >= 50 ? 'bg-amber-500' : 'bg-[#dc2626]'}`}
                    style={{ width: `${entry.coverage}%` }}
                  />
                </div>
                <span className="font-mono font-bold w-12 text-right">{entry.coverage}%</span>
                {entry.coverage >= 80 ? (
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
