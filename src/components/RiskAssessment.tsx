import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, AlertTriangle, Zap, Bug, TrendingUp, Download,
  RefreshCw, Lightbulb
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import { assessRisk } from '../lib/ai-engine';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function RiskAssessment() {
  const { riskAssessment, setRiskAssessment, srsText, testCases, negativeTestCases } = useAppStore();
  const allCases = useMemo(() => [...testCases, ...negativeTestCases], [testCases, negativeTestCases]);
  const [isReassessing, setIsReassessing] = useState(false);

  // Fallback or dynamic risk assessment if null
  const activeRisk = useMemo(() => {
    if (riskAssessment) return riskAssessment;
    const secCount = allCases.filter(c => c.category === 'security').length;
    const failCount = allCases.filter(c => c.executionStatus === 'Fail').length;
    return {
      securityRisk: Math.min(100, 30 + secCount * 12),
      performanceRisk: 45,
      functionalRisk: Math.min(100, 35 + failCount * 10),
      overallScore: Math.min(100, 40 + secCount * 6 + failCount * 5),
      factors: [
        'Authentication and session token handling in API endpoints',
        'Database query response under concurrent user load',
        'Input payload validation across boundary states',
      ],
      mitigations: [
        { factor: 'Authentication Token Vulnerability', recommendation: 'Enforce JWT expiration under 15m and rotate signing keys regularly.', priority: 'High' as const },
        { factor: 'Concurrent Request Latency', recommendation: 'Implement connection pooling and redis caching on query endpoints.', priority: 'Medium' as const },
        { factor: 'Input Injection Risk', recommendation: 'Use strict Pydantic/Zod schema validators on all request bodies.', priority: 'Critical' as const },
      ],
    };
  }, [riskAssessment, allCases]);

  const handleReassess = async () => {
    if (!srsText.trim() && allCases.length === 0) {
      toast.error('Add SRS requirements or test cases to compute risk profile.');
      return;
    }
    setIsReassessing(true);
    try {
      const res = await assessRisk(srsText, allCases);
      setRiskAssessment(res);
      toast.success('Risk assessment successfully recalculated');
    } catch {
      toast.error('Failed to reassess risk factors');
    } finally {
      setIsReassessing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-[#dc2626]';
    if (score >= 40) return 'text-amber-500';
    return 'text-[#16a34a]';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Critical Risk';
    if (score >= 60) return 'High Risk';
    if (score >= 40) return 'Medium Risk';
    if (score >= 20) return 'Low Risk';
    return 'Minimal Risk';
  };

  const getScoreRingColor = (score: number) => {
    if (score >= 70) return '#dc2626';
    if (score >= 40) return '#f59e0b';
    return '#16a34a';
  };

  const radarData = [
    { subject: 'Security', value: activeRisk.securityRisk, fullMark: 100 },
    { subject: 'Performance', value: activeRisk.performanceRisk, fullMark: 100 },
    { subject: 'Functional', value: activeRisk.functionalRisk, fullMark: 100 },
  ];

  const riskCategories = [
    { label: 'Security Risk', score: activeRisk.securityRisk, icon: Shield, description: 'Authentication, role authorizations, encryption, and injection safeguards' },
    { label: 'Performance Risk', score: activeRisk.performanceRisk, icon: Zap, description: 'Response latency, throughput, connection limits, and resource utilization' },
    { label: 'Functional Risk', score: activeRisk.functionalRisk, icon: Bug, description: 'Business logic paths, data model constraints, and edge boundary scenarios' },
  ];

  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (activeRisk.overallScore / 100) * circumference;

  const handleExportRiskReport = () => {
    const summary = [
      { Metric: 'Overall Risk Score', Value: `${activeRisk.overallScore}/100` },
      { Metric: 'Security Risk', Value: `${activeRisk.securityRisk}/100` },
      { Metric: 'Performance Risk', Value: `${activeRisk.performanceRisk}/100` },
      { Metric: 'Functional Risk', Value: `${activeRisk.functionalRisk}/100` },
      { Metric: 'Identified Factors', Value: activeRisk.factors.join('; ') },
    ];
    const ws = XLSX.utils.json_to_sheet(summary);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Risk Assessment');
    XLSX.writeFile(wb, `Risk-Assessment-Report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Risk assessment report exported to Excel');
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#f0f9ff] dark:bg-slate-900">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0] dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center text-orange-600">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
              AI-Powered Risk Assessment
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200">
                Multi-Vector Analysis
              </span>
            </h2>
            <p className="text-xs text-[#64748b]">Comprehensive risk scoring, 3x3 risk matrix, and actionable mitigations</p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleReassess}
            disabled={isReassessing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-[#e2e8f0] dark:border-slate-700 text-[#0f172a] dark:text-white hover:border-[#0ea5e9] text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReassessing ? 'animate-spin text-[#0ea5e9]' : ''}`} />
            <span>Recalculate Risk</span>
          </button>

          <button
            onClick={handleExportRiskReport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Risk Report</span>
          </button>
        </div>
      </motion.div>

      {/* Top 3 Column Analytics Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overall Score Dial */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-800 border border-border rounded-xl p-6 flex flex-col items-center justify-center shadow-xs"
        >
          <span className="text-xs font-bold text-muted uppercase tracking-wider mb-4">Composite Quality Risk Index</span>
          <div className="relative w-36 h-36">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="60" fill="none" stroke="#e2e8f0" strokeWidth="8" />
              <motion.circle
                cx="70" cy="70" r="60" fill="none"
                stroke={getScoreRingColor(activeRisk.overallScore)}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-black ${getScoreColor(activeRisk.overallScore)}`}>{activeRisk.overallScore}</span>
              <span className="text-[10px] text-muted font-bold">/ 100</span>
            </div>
          </div>
          <span className={`text-sm font-bold mt-3 ${getScoreColor(activeRisk.overallScore)}`}>
            {getScoreLabel(activeRisk.overallScore)}
          </span>
        </motion.div>

        {/* Radar Chart */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-slate-800 border border-border rounded-xl p-5 shadow-xs">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Vector Radar Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
              <Radar dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Category Scores */}
        <div className="space-y-3">
          {riskCategories.map((cat, i) => (
            <motion.div
              key={cat.label}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-slate-800 border border-border rounded-xl p-4 shadow-xs"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <cat.icon className={`w-4 h-4 ${getScoreColor(cat.score)}`} />
                <span className="text-xs font-bold text-foreground">{cat.label}</span>
                <span className={`ml-auto text-base font-black font-mono ${getScoreColor(cat.score)}`}>{cat.score}/100</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${cat.score}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                  className={`h-full rounded-full ${cat.score >= 70 ? 'bg-[#dc2626]' : cat.score >= 40 ? 'bg-amber-500' : 'bg-[#16a34a]'}`}
                />
              </div>
              <p className="text-[10px] text-muted leading-relaxed">{cat.description}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 3x3 Likelihood vs Impact Risk Matrix */}
      <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#7c3aed]" />
          <span>Likelihood vs. Impact Risk Matrix</span>
        </h3>
        <p className="text-xs text-muted">
          Categorization of system failure probability versus operational and security impact.
        </p>

        <div className="grid grid-cols-4 gap-2 text-xs text-center font-medium">
          <div className="p-2 font-bold text-muted uppercase text-[10px] flex items-center justify-center">
            Likelihood \ Impact
          </div>
          <div className="p-2 font-bold text-muted uppercase text-[10px] bg-slate-50 dark:bg-slate-800 rounded">
            Low Impact
          </div>
          <div className="p-2 font-bold text-muted uppercase text-[10px] bg-slate-50 dark:bg-slate-800 rounded">
            Medium Impact
          </div>
          <div className="p-2 font-bold text-muted uppercase text-[10px] bg-slate-50 dark:bg-slate-800 rounded">
            High Impact
          </div>

          {/* High Likelihood row */}
          <div className="p-2 font-bold text-muted uppercase text-[10px] bg-slate-50 dark:bg-slate-800 rounded flex items-center justify-center">
            High Likelihood
          </div>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-800 font-semibold">
            Medium Risk (Input formatting)
          </div>
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 text-red-700 font-bold">
            High Risk (Concurrent latency)
          </div>
          <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/40 border border-red-300 text-red-900 font-black">
            CRITICAL (Auth bypass)
          </div>

          {/* Medium Likelihood row */}
          <div className="p-2 font-bold text-muted uppercase text-[10px] bg-slate-50 dark:bg-slate-800 rounded flex items-center justify-center">
            Medium Likelihood
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-800 font-semibold">
            Low Risk (UI rendering glitch)
          </div>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-800 font-semibold">
            Medium Risk (API pagination)
          </div>
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 text-red-700 font-bold">
            High Risk (Data corruption)
          </div>

          {/* Low Likelihood row */}
          <div className="p-2 font-bold text-muted uppercase text-[10px] bg-slate-50 dark:bg-slate-800 rounded flex items-center justify-center">
            Low Likelihood
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-800 font-semibold">
            Minimal (Localization edge)
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-800 font-semibold">
            Low Risk (Network jitter)
          </div>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-800 font-semibold">
            Medium Risk (Server restart)
          </div>
        </div>
      </div>

      {/* Identified Risk Factors Registry & Mitigations */}
      <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span>Identified Risk Factors & Actionable Mitigations ({activeRisk.factors.length})</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeRisk.factors.map((factor, i) => (
            <div key={i} className="flex items-start gap-2.5 bg-slate-50 dark:bg-slate-850 border border-border rounded-xl p-3.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">{factor}</p>
                <p className="text-[11px] text-muted mt-1">Recommended Action: Add targeted automated boundary and load assertions in test suite.</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
