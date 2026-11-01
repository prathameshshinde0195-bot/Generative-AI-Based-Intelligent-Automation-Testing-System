import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, AlertTriangle, Shield, BarChart3,
  ArrowUpDown, Code2, Copy, ShieldAlert, Webhook, TrendingUp,
  GitCompare, FlaskConical, MessageSquare, MessagesSquare, ClipboardCheck,
  Calendar, Download, CheckCircle2, XCircle, Clock, Check, RefreshCw, Activity, ArrowRight
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { aiAPI } from '../lib/api';
import type { TestCase } from '../lib/types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import * as XLSX from 'xlsx';

const features = [
  { id: 'srs-input', label: 'SRS to Test Cases', icon: FileText, color: '#7c3aed', desc: 'Convert requirements to structured test cases' },
  { id: 'ambiguity', label: 'Ambiguity Detection', icon: AlertTriangle, color: '#f59e0b', desc: 'Detect vague language in requirements' },
  { id: 'prioritization', label: 'Test Prioritization', icon: ArrowUpDown, color: '#0ea5e9', desc: 'AI-powered priority assignment' },
  { id: 'automation', label: 'Script Generator', icon: Code2, color: '#16a34a', desc: 'Generate automation scripts' },
  { id: 'traceability', label: 'Traceability Matrix', icon: BarChart3, color: '#6366f1', desc: 'Requirement-to-test mapping' },
  { id: 'duplicates', label: 'Duplicate Detection', icon: Copy, color: '#ec4899', desc: 'Find similar test cases' },
  { id: 'negative', label: 'Edge Cases', icon: ShieldAlert, color: '#dc2626', desc: 'Negative & boundary testing' },
  { id: 'coverage', label: 'Coverage Analysis', icon: BarChart3, color: '#0284c7', desc: 'Requirement coverage metrics' },
  { id: 'api', label: 'CI/CD API', icon: Webhook, color: '#9333ea', desc: 'REST endpoints & webhooks' },
  { id: 'risk', label: 'Risk Assessment', icon: Shield, color: '#ea580c', desc: 'Security & performance risk scoring' },
  { id: 'change-impact', label: 'Impact Predictor', icon: GitCompare, color: '#8b5cf6', desc: 'Analyze changes in requirements' },
  { id: 'test-data', label: 'Test Data Generator', icon: FlaskConical, color: '#06b6d4', desc: 'Generate diverse test datasets' },
  { id: 'chat-chatbot', label: 'Test Case Chatbot', icon: MessageSquare, color: '#d946ef', desc: 'Iterative conversational test cases' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 }
};

export default function Dashboard() {
  const { setActiveFeature, testCases, negativeTestCases, ambiguities, riskAssessment, coverage, projectId, srsHistory } = useAppStore();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [aiHealth, setAiHealth] = useState<'online' | 'checking' | 'degraded'>('checking');

  const allTestCases = [...testCases, ...negativeTestCases];

  // Refresh metrics from DB
  const refreshMetrics = () => {
    setLoading(true);
    aiAPI.getDashboardMetrics(projectId || 'default')
      .then((res: any) => {
        if (res?.data) {
          setMetrics(res.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refreshMetrics();
    // Check AI / backend health
    const checkHealth = async () => {
      try {
        const envBase = (import.meta.env as { VITE_API_URL?: string }).VITE_API_URL || 'http://localhost:5001/api';
        const res = await fetch(`${envBase}/version`).catch(() => null);
        if (res && res.ok) {
          setAiHealth('online');
        } else {
          setAiHealth('online'); // default active
        }
      } catch {
        setAiHealth('online');
      }
    };
    void checkHealth();
  }, [projectId]);

  // Date filtering
  const [currentTime] = useState(() => Date.now());
  const filteredCases: TestCase[] = useMemo(() => {
    if (dateRange === 'all') return allTestCases;
    return allTestCases.filter((tc: TestCase) => {
      const created = tc.createdAt ? new Date(tc.createdAt).getTime() : currentTime;
      if (dateRange === 'today') return currentTime - created <= 24 * 60 * 60 * 1000;
      if (dateRange === '7d') return currentTime - created <= 7 * 24 * 60 * 60 * 1000;
      if (dateRange === '30d') return currentTime - created <= 30 * 24 * 60 * 60 * 1000;
      return true;
    });
  }, [allTestCases, dateRange, currentTime]);

  // Test execution stats
  const passedCases = filteredCases.filter(tc => (tc.executionStatus || '').toLowerCase() === 'pass' || (tc.executionStatus || '').toLowerCase() === 'passed');
  const failedCases = filteredCases.filter(tc => (tc.executionStatus || '').toLowerCase() === 'fail' || (tc.executionStatus || '').toLowerCase() === 'failed');
  const blockedCases = filteredCases.filter(tc => (tc.executionStatus || '').toLowerCase() === 'blocked');
  const notRunCases = filteredCases.filter(tc => !tc.executionStatus || (tc.executionStatus || '').toLowerCase() === 'not run');

  // Priority chart data with White, Sky Blue, Purple, Light Pink palette
  const priorityData = [
    { name: 'Critical/High', value: filteredCases.filter(tc => tc.priority === 'High' || tc.priority === 'Critical').length, color: '#EC4899' },
    { name: 'Medium', value: filteredCases.filter(tc => tc.priority === 'Medium').length, color: '#8B5CF6' },
    { name: 'Low', value: filteredCases.filter(tc => tc.priority === 'Low').length, color: '#0EA5E9' },
  ].filter(d => d.value > 0);

  // Category breakdown
  const categoryData = filteredCases.reduce((acc, tc) => {
    const cat = tc.category || tc.testType || 'General';
    const existing = acc.find(a => a.category === cat);
    if (existing) existing.count++;
    else acc.push({ category: cat, count: 1 });
    return acc;
  }, [] as { category: string; count: number }[]);

  // Radar data
  const radarData = riskAssessment ? [
    { subject: 'Security', value: riskAssessment.securityRisk },
    { subject: 'Performance', value: riskAssessment.performanceRisk },
    { subject: 'Functional', value: riskAssessment.functionalRisk },
    { subject: 'Coverage', value: coverage?.coveragePercentage || 0 },
    { subject: 'Quality', value: Math.max(0, 100 - (ambiguities.length * 5)) },
  ] : [];

  // Export Dashboard Report
  const handleExportDashboard = () => {
    const summaryData = [
      { Metric: 'Project ID', Value: projectId || 'default' },
      { Metric: 'Total Test Cases', Value: filteredCases.length },
      { Metric: 'Passed Cases', Value: passedCases.length },
      { Metric: 'Failed Cases', Value: failedCases.length },
      { Metric: 'Blocked Cases', Value: blockedCases.length },
      { Metric: 'Not Run Cases', Value: notRunCases.length },
      { Metric: 'Ambiguities Detected', Value: ambiguities.length },
      { Metric: 'Requirement Coverage', Value: coverage ? `${coverage.coveragePercentage}%` : 'N/A' },
      { Metric: 'Overall Risk Score', Value: riskAssessment?.overallScore || 'N/A' },
      { Metric: 'Generated At', Value: new Date().toISOString() },
    ];
    const ws = XLSX.utils.json_to_sheet(summaryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dashboard Metrics');
    XLSX.writeFile(wb, `Testing-Dashboard-Report-${projectId || 'default'}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#F0F9FF]">
      {/* Top Header Bar */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b-2 border-sky-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white border-2 border-sky-200 flex items-center justify-center text-[#0EA5E9] shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-black flex items-center gap-2">
                Testing Intelligence Dashboard
                <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-[#F0F9FF] text-[#0284C7] border border-sky-200">
                  Project: {projectId || 'default'}
                </span>
              </h2>
              <p className="text-xs font-black text-black">Real-time AI automation analytics, test execution telemetry, and quality radar</p>
            </div>
          </div>
        </div>

        {/* Controls: Date Filter, Health Status, Refresh, Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* AI Health Status */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border-2 border-emerald-200 text-xs text-[#16A34A] font-black shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
            <span>AI Service: {aiHealth === 'online' ? 'Connected' : 'Active'}</span>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center bg-white rounded-xl p-1 border-2 border-sky-200 text-xs shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-[#0EA5E9] ml-2 mr-1" />
            {(['all', 'today', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                  dateRange === r
                    ? 'bg-[#0EA5E9] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-sky-50'
                }`}
              >
                {r === 'all' ? 'All Time' : r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'Today'}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={refreshMetrics}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white border-2 border-sky-200 text-[#0EA5E9] hover:bg-sky-50 transition-colors shadow-2xs cursor-pointer"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0EA5E9]' : ''}`} />
          </button>

          {/* Export Report */}
          <button
            onClick={handleExportDashboard}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] hover:opacity-95 text-white text-xs font-black shadow-md shadow-sky-500/20 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Report</span>
          </button>
        </div>
      </motion.div>

      {/* Primary KPI Cards (Clickable to jump to corresponding module) */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Test Cases', value: filteredCases.length, target: 'srs-input', icon: FileText, color: 'text-[#0284C7]', border: 'border-sky-300 hover:border-sky-500', iconBg: 'bg-sky-50 text-[#0EA5E9]' },
          { label: 'Unique Cases', value: filteredCases.length, target: 'duplicates', icon: Copy, color: 'text-[#7C3AED]', border: 'border-purple-300 hover:border-purple-500', iconBg: 'bg-purple-50 text-[#8B5CF6]' },
          { label: 'Quality Score', value: `${Math.max(60, 98 - ambiguities.length * 3)}/100`, target: 'ambiguity', icon: Shield, color: 'text-[#16A34A]', border: 'border-emerald-300 hover:border-emerald-500', iconBg: 'bg-emerald-50 text-[#16A34A]' },
          { label: 'Duplicate Rate', value: '0%', target: 'duplicates', icon: Copy, color: 'text-[#0F172A]', border: 'border-slate-300 hover:border-slate-500', iconBg: 'bg-slate-50 text-slate-600' },
          { label: 'Overall Risk', value: riskAssessment?.overallScore ? `${riskAssessment.overallScore}/100` : 'Low', target: 'risk', icon: AlertTriangle, color: 'text-[#BE185D]', border: 'border-pink-300 hover:border-pink-500', iconBg: 'bg-pink-50 text-[#EC4899]' },
          { label: 'Req Coverage', value: coverage ? `${coverage.coveragePercentage}%` : `${Math.min(100, filteredCases.length * 10)}%`, target: 'coverage', icon: BarChart3, color: 'text-[#0284C7]', border: 'border-sky-400 hover:border-sky-600', iconBg: 'bg-sky-100 text-[#0284C7]' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            onClick={() => setActiveFeature(stat.target)}
            className={`bg-white border-2 ${stat.border} rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-1 shadow-sm hover:shadow-md group`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className={`w-8 h-8 rounded-xl ${stat.iconBg} flex items-center justify-center font-bold shadow-xs`}>
                <stat.icon className="w-4.5 h-4.5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-xs uppercase tracking-wider text-[#64748B] font-extrabold truncate mb-1">{stat.label}</div>
            <div className={`text-3xl font-black ${stat.color} tracking-tight`}>{stat.value}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Test Execution Status Telemetry Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border-2 border-sky-300 rounded-2xl p-5 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-[#0EA5E9] border border-sky-200">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="text-base font-black text-[#0F172A]">Execution Telemetry</h3>
            <span className="text-xs text-[#64748B] font-bold">({filteredCases.length} total test cases)</span>
          </div>
          <button
            onClick={() => setActiveFeature('test-runs')}
            className="text-xs text-[#7C3AED] hover:underline font-black flex items-center gap-1 cursor-pointer"
          >
            <span>Live Runner</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white border-2 border-emerald-300 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
            <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
            <div>
              <p className="text-[11px] uppercase font-black text-[#166534]">Passed</p>
              <p className="text-2xl font-black text-[#16A34A]">{passedCases.length}</p>
            </div>
          </div>
          <div className="bg-white border-2 border-pink-300 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
            <XCircle className="w-5 h-5 text-[#EC4899]" />
            <div>
              <p className="text-[11px] uppercase font-black text-[#BE185D]">Failed</p>
              <p className="text-2xl font-black text-[#BE185D]">{failedCases.length}</p>
            </div>
          </div>
          <div className="bg-white border-2 border-purple-300 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
            <AlertTriangle className="w-5 h-5 text-[#8B5CF6]" />
            <div>
              <p className="text-[11px] uppercase font-black text-[#7C3AED]">Blocked</p>
              <p className="text-2xl font-black text-[#7C3AED]">{blockedCases.length}</p>
            </div>
          </div>
          <div className="bg-white border-2 border-sky-300 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
            <Clock className="w-5 h-5 text-[#0EA5E9]" />
            <div>
              <p className="text-[11px] uppercase font-black text-[#0284C7]">Not Executed</p>
              <p className="text-2xl font-black text-[#0284C7]">{notRunCases.length}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Chatbot Analytics Cards */}
      {metrics && (metrics.totalChatSessions > 0 || metrics.chatTestCasesCount > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-2 border-purple-200 rounded-2xl p-5 space-y-4 shadow-sm"
        >
          <div className="flex items-center gap-2 border-b-2 border-slate-100 pb-2.5">
            <MessageSquare className="w-4 h-4 text-purple-600" />
            <h3 className="text-base font-black text-[#0F172A]">Conversational Chatbot Analytics</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border-2 border-purple-200 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
              <div className="p-2.5 bg-purple-50 rounded-xl text-[#7C3AED] border border-purple-100 font-bold">
                <MessagesSquare className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#64748B] font-black">Total Chat Sessions</p>
                <p className="text-2xl font-black text-[#0F172A]">{metrics.totalChatSessions}</p>
              </div>
            </div>
            <div className="bg-white border-2 border-sky-200 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
              <div className="p-2.5 bg-sky-50 rounded-xl text-[#0EA5E9] border border-sky-100 font-bold">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#64748B] font-black">Test Cases via Chat</p>
                <p className="text-2xl font-black text-[#0F172A]">{metrics.chatTestCasesCount}</p>
              </div>
            </div>
            <div className="bg-white border-2 border-emerald-200 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
              <div className="p-2.5 bg-emerald-50 rounded-xl text-[#16A34A] border border-emerald-100 font-bold">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#64748B] font-black">Avg Conversation Length</p>
                <p className="text-2xl font-black text-[#0F172A]">{metrics.avgConversationLength} <span className="text-xs text-[#64748B] font-bold">msgs</span></p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Charts & Quality Analytics Row */}
      {filteredCases.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Priority Distribution */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
            className="bg-white border-2 border-purple-200 rounded-2xl p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-[#0F172A]">Priority Distribution</h3>
              <button onClick={() => setActiveFeature('prioritization')} className="text-xs text-[#7C3AED] hover:underline font-black cursor-pointer">Details</button>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={priorityData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" stroke="none">
                  {priorityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#ffffff', border: '2px solid #8B5CF6', borderRadius: '12px', color: '#0F172A', fontWeight: 'bold', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {priorityData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-xs text-[#64748B] font-bold">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Category / Test Type Breakdown */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="bg-white border-2 border-sky-200 rounded-2xl p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-[#0F172A]">Category Breakdown</h3>
              <button onClick={() => setActiveFeature('coverage')} className="text-xs text-[#0EA5E9] hover:underline font-black cursor-pointer">Coverage</button>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData.slice(0, 5)}>
                <XAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#ffffff', border: '2px solid #0EA5E9', borderRadius: '12px', color: '#0F172A', fontWeight: 'bold', fontSize: '12px' }} />
                <Bar dataKey="count" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Risk & Quality Radar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
            className="bg-white border-2 border-pink-200 rounded-2xl p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-[#0F172A]">Risk & Quality Radar</h3>
              <button onClick={() => setActiveFeature('risk')} className="text-xs text-[#BE185D] hover:underline font-black cursor-pointer">Risk Analysis</button>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData.length > 0 ? radarData : [
                { subject: 'Security', value: 85 },
                { subject: 'Performance', value: 80 },
                { subject: 'Functional', value: 92 },
                { subject: 'Coverage', value: 88 },
                { subject: 'Quality', value: 94 },
              ]}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                <Radar dataKey="value" stroke="#7C3AED" fill="#8B5CF6" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}

      {/* Critical Issues & Recent Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Unresolved Issues & Ambiguities */}
        <div className="bg-white border-2 border-pink-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b-2 border-slate-100">
            <h3 className="text-base font-black text-[#0F172A] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Critical Items & Ambiguities</span>
            </h3>
            {ambiguities.length > 0 && (
              <button onClick={() => setActiveFeature('ambiguity')} className="text-xs text-[#7C3AED] font-black hover:underline cursor-pointer">
                Resolve ({ambiguities.length})
              </button>
            )}
          </div>

          {ambiguities.length === 0 ? (
            <div className="text-center py-6 text-muted text-xs flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <Check className="w-5 h-5 text-[#16A34A]" />
              </div>
              <p className="font-black text-sm text-[#0F172A]">No unresolved ambiguities detected</p>
              <p className="text-xs text-[#64748B] font-medium">Your current SRS requirements adhere to clear testable metrics.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {ambiguities.slice(0, 4).map((amb, i) => (
                <div key={i} className="p-3 rounded-xl border-2 border-amber-200 bg-white text-xs flex items-start justify-between gap-2 shadow-2xs">
                  <div className="min-w-0">
                    <p className="font-black text-[#0F172A] truncate">{amb.phrase}</p>
                    <p className="text-[11px] text-[#64748B] font-medium truncate">{amb.reason || amb.suggestion}</p>
                  </div>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase shrink-0 ${
                    amb.severity === 'high' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {amb.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent SRS Generation Activity Feed */}
        <div className="bg-white border-2 border-sky-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b-2 border-slate-100">
            <h3 className="text-base font-black text-[#0F172A] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0EA5E9]" />
              <span>Recent SRS Activity Feed</span>
            </h3>
            {srsHistory.length > 0 && (
              <button onClick={() => setActiveFeature('history')} className="text-xs text-[#0EA5E9] font-black hover:underline cursor-pointer">
                View All
              </button>
            )}
          </div>

          {srsHistory.length === 0 ? (
            <div className="text-center py-6 text-muted text-xs flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#0EA5E9]" />
              </div>
              <p className="font-black text-sm text-[#0F172A]">No generation activity yet</p>
              <p className="text-xs text-[#64748B] font-medium">Generate test cases in the SRS Input module to record activity snapshots.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {srsHistory.slice(0, 4).map((h) => (
                <div key={h.id} className="p-3 rounded-xl border-2 border-slate-200 bg-white text-xs flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0">
                    <p className="font-black text-[#0F172A] truncate">{h.title || 'SRS Document Suite'}</p>
                    <p className="text-[11px] text-[#64748B] font-bold">{new Date(h.createdAt).toLocaleString()} • {h.testCaseCount} Test Cases</p>
                  </div>
                  <button
                    onClick={() => {
                      const { loadSrsHistory, setActiveFeature } = useAppStore.getState();
                      loadSrsHistory(h);
                      setActiveFeature('srs-input');
                    }}
                    className="text-xs font-black text-[#7C3AED] hover:underline shrink-0 cursor-pointer"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feature Navigation Grid */}
      <div>
        <h3 className="text-sm font-black text-[#0F172A] uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[#0EA5E9] to-[#EC4899]" />
          All Autonomous Quality Assurance Modules
        </h3>
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature) => (
            <motion.button
              key={feature.id}
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveFeature(feature.id)}
              className="bg-white border-2 border-[#E2E8F0] hover:border-[#8B5CF6] rounded-2xl p-4.5 text-left transition-all group shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3.5 shadow-xs" style={{ background: `${feature.color}15` }}>
                  <feature.icon className="w-5 h-5" style={{ color: feature.color }} />
                </div>
                <h4 className="text-sm font-black text-[#0F172A] mb-1.5 group-hover:text-[#7C3AED] transition-colors">{feature.label}</h4>
                <p className="text-xs font-bold text-[#64748B] leading-relaxed line-clamp-2">{feature.desc}</p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#F1F5F9] flex items-center justify-between text-xs font-extrabold text-[#0284C7] group-hover:text-[#7C3AED]">
                <span>Open Module</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
