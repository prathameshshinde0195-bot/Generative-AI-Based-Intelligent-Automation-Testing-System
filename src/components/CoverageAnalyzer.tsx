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
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#F0F9FF]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#E0F2FE] bg-white p-5 rounded-2xl shadow-sm border">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white shadow-md shadow-sky-500/10">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2 tracking-tight">
              Test Coverage Analyzer & Gap Detector
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-[#F0F9FF] text-[#0284C7] border border-[#E0F2FE]">
                Traceability Audit
              </span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5 font-medium">Verify requirement and execution test coverage with missing scenario gap alerts</p>
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Coverage Report</span>
          </button>
        </div>
      </motion.div>

      {/* KPI Cards in White, Sky Blue, Purple, and Light Pink */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-sky-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs text-[#0284C7] uppercase font-black tracking-wider">Total Requirements</p>
          <p className="text-3xl font-black text-[#0284C7] mt-1 tracking-tight">{activeCoverage.totalRequirements}</p>
        </div>
        <div className="bg-white border-2 border-emerald-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs text-[#16A34A] uppercase font-black tracking-wider">Covered Requirements</p>
          <p className="text-3xl font-black text-[#16A34A] mt-1 tracking-tight">{activeCoverage.coveredRequirements}</p>
        </div>
        <div className="bg-white border-2 border-purple-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs text-[#7C3AED] uppercase font-black tracking-wider">Requirement Coverage</p>
          <p className={`text-3xl font-black mt-1 tracking-tight ${activeCoverage.coveragePercentage >= 80 ? 'text-[#16A34A]' : activeCoverage.coveragePercentage >= 50 ? 'text-amber-500' : 'text-[#BE185D]'}`}>
            {activeCoverage.coveragePercentage}%
          </p>
        </div>
        <div className="bg-white border-2 border-pink-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs text-[#BE185D] uppercase font-black tracking-wider">Execution Coverage</p>
          <p className="text-3xl font-black text-[#BE185D] mt-1 tracking-tight">{executionCoveragePct}%</p>
        </div>
      </div>

      {/* Threshold Config Slider */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#8B5CF6]" />
          <span className="font-black text-[#0F172A] text-xs uppercase">Configure CI/CD Coverage Gate:</span>
          <span className="font-mono font-black text-[#7C3AED] bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200 text-sm">{coverageGate}%</span>
        </div>
        <div className="w-full sm:w-72">
          <input
            type="range"
            min="50"
            max="100"
            value={coverageGate}
            onChange={(e) => setCoverageGate(Number(e.target.value))}
            className="w-full accent-[#8B5CF6]"
          />
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coverage Overview Donut */}
        <div className="bg-white border-2 border-purple-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-black text-[#0F172A] uppercase tracking-wider mb-4 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-[#8B5CF6]" />
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
                <span className="text-xs text-slate-700 font-bold">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Test Category Distribution */}
        <div className="bg-white border-2 border-sky-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-black text-[#0F172A] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0EA5E9]" />
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
        <div className="bg-white border-2 border-pink-300 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#BE185D]" />
              <h3 className="text-sm font-black text-[#BE185D] uppercase tracking-wide">
                Coverage Gap Detected: {activeCoverage.missingRequirements.length} Uncovered Requirements
              </h3>
            </div>
            <span className="text-xs text-[#BE185D] font-bold">Click &ldquo;Generate Test Case&rdquo; to close gaps</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {activeCoverage.missingRequirements.map(reqId => (
              <div key={reqId} className="bg-[#FDF2F8] border border-[#FCE7F3] rounded-xl p-3.5 flex items-center justify-between text-xs gap-2">
                <div>
                  <span className="font-mono font-black text-sm text-[#BE185D]">{reqId}</span>
                  <p className="text-xs text-slate-600 font-medium truncate">No active test case mapped</p>
                </div>
                <button
                  onClick={() => handleGenerateMissingTest(reqId)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold text-xs transition-colors shrink-0 shadow-xs cursor-pointer"
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
