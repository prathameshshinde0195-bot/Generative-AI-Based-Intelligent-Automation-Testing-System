import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, AlertTriangle, Shield, BarChart3,
  ArrowUpDown, Code2, Copy, ShieldAlert, Webhook, TrendingUp,
  GitCompare, FlaskConical, MessageSquare, MessagesSquare, ClipboardCheck
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { aiAPI } from '../lib/api';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';

const features = [
  { id: 'srs-input', label: 'SRS to Test Cases', icon: FileText, color: '#06b6d4', desc: 'Convert requirements to structured test cases' },
  { id: 'ambiguity', label: 'Ambiguity Detection', icon: AlertTriangle, color: '#f59e0b', desc: 'Detect vague language in requirements' },
  { id: 'prioritization', label: 'Test Prioritization', icon: ArrowUpDown, color: '#8b5cf6', desc: 'AI-powered priority assignment' },
  { id: 'automation', label: 'Script Generator', icon: Code2, color: '#10b981', desc: 'Generate automation scripts' },
  { id: 'traceability', label: 'Traceability Matrix', icon: BarChart3, color: '#3b82f6', desc: 'Requirement-to-test mapping' },
  { id: 'duplicates', label: 'Duplicate Detection', icon: Copy, color: '#ec4899', desc: 'Find similar test cases' },
  { id: 'negative', label: 'Edge Cases', icon: ShieldAlert, color: '#ef4444', desc: 'Negative & boundary testing' },
  { id: 'coverage', label: 'Coverage Analysis', icon: BarChart3, color: '#14b8a6', desc: 'Requirement coverage metrics' },
  { id: 'api', label: 'CI/CD API', icon: Webhook, color: '#a855f7', desc: 'REST endpoints & webhooks' },
  { id: 'risk', label: 'Risk Assessment', icon: Shield, color: '#f97316', desc: 'Security & performance risk scoring' },
  { id: 'change-impact', label: 'Impact Predictor', icon: GitCompare, color: '#a78bfa', desc: 'Analyze changes in requirements' },
  { id: 'test-data', label: 'Test Data Generator', icon: FlaskConical, color: '#22d3ee', desc: 'Generate diverse test datasets' },
  { id: 'chat-chatbot', label: 'Test Case Chatbot', icon: MessageSquare, color: '#ec4899', desc: 'Iterative conversational test cases' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0 }
};

export default function Dashboard() {
  const { setActiveFeature, testCases, ambiguities, riskAssessment, coverage, projectId } = useAppStore();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    aiAPI.getDashboardMetrics(projectId || 'default')
      .then((res: any) => {
        if (res?.data) {
          setMetrics(res.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const priorityData = [
    { name: 'High', value: testCases.filter(tc => tc.priority === 'High').length, color: '#ef4444' },
    { name: 'Medium', value: testCases.filter(tc => tc.priority === 'Medium').length, color: '#f59e0b' },
    { name: 'Low', value: testCases.filter(tc => tc.priority === 'Low').length, color: '#10b981' },
  ].filter(d => d.value > 0);

  const categoryData = testCases.reduce((acc, tc) => {
    const existing = acc.find(a => a.category === tc.category);
    if (existing) existing.count++;
    else acc.push({ category: tc.category, count: 1 });
    return acc;
  }, [] as { category: string; count: number }[]);

  const radarData = riskAssessment ? [
    { subject: 'Security', value: riskAssessment.securityRisk },
    { subject: 'Performance', value: riskAssessment.performanceRisk },
    { subject: 'Functional', value: riskAssessment.functionalRisk },
    { subject: 'Coverage', value: coverage?.coveragePercentage || 0 },
    { subject: 'Quality', value: Math.max(0, 100 - (ambiguities.length * 5)) },
  ] : [];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Testing Intelligence Dashboard
          </h2>
          <p className="text-sm text-muted">AI-powered test automation and quality analysis</p>
        </div>
        {loading && <div className="text-xs text-muted">Refreshing metrics…</div>}
      </motion.div>

      {/* Stats Cards */}
      {/* Stats Cards matching Page 2 of yukti_photos */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Test Cases', value: testCases.length, icon: FileText, color: 'text-blue-500' },
          { label: 'Unique Cases', value: testCases.length, icon: Copy, color: 'text-blue-400' },
          { label: 'Avg Quality Score', value: '92/100', icon: Shield, color: 'text-[#10b981]', badge: 'bg-[#ecfdf5] text-[#10b981] dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 rounded-md' },
          { label: 'Duplicate Rate', value: '0%', icon: Copy, color: 'text-slate-400' },
          { label: 'Risk Score', value: riskAssessment?.overallScore ? `${riskAssessment.overallScore}` : '—', icon: AlertTriangle, color: 'text-amber-500' },
          { label: 'Req Coverage', value: coverage ? `${coverage.coveragePercentage}%` : '—', icon: BarChart3, color: 'text-[#10b981]' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            className="bg-surface border border-border rounded-xl p-3.5 hover:border-border-bright transition-colors"
          >
            <div className="flex items-center justify-between mb-1.5">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-[9px] uppercase tracking-wider text-muted font-bold truncate">{stat.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Chatbot Analytics Cards */}
      {metrics && (metrics.totalChatSessions > 0 || metrics.chatTestCasesCount > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface border border-border/80 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-border/50 pb-2">
            <MessageSquare className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-semibold text-foreground">Conversational Chatbot Analytics</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-alt border border-border/40 rounded-lg p-3.5 flex items-center gap-3">
              <div className="p-2 bg-pink-500/10 rounded-lg text-pink-400">
                <MessagesSquare className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">Total Chat Sessions</p>
                <p className="text-2xl font-bold text-foreground">{metrics.totalChatSessions}</p>
              </div>
            </div>
            <div className="bg-surface-alt border border-border/40 rounded-lg p-3.5 flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">Test Cases via Chat</p>
                <p className="text-2xl font-bold text-foreground">{metrics.chatTestCasesCount}</p>
              </div>
            </div>
            <div className="bg-surface-alt border border-border/40 rounded-lg p-3.5 flex items-center gap-3">
              <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">Avg Conversation Length</p>
                <p className="text-2xl font-bold text-foreground">{metrics.avgConversationLength} <span className="text-xs text-muted font-normal">msgs</span></p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Charts Row */}
      {testCases.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Priority Distribution */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
            className="bg-surface border border-border rounded-xl p-5"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4">Priority Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={priorityData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" stroke="none">
                  {priorityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a2236', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {priorityData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-xs text-muted">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Category Breakdown */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="bg-surface border border-border rounded-xl p-5"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4">Category Breakdown</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData}>
                <XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a2236', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }} />
                <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Risk Radar */}
          {riskAssessment && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
              className="bg-surface border border-border rounded-xl p-5"
            >
              <h3 className="text-sm font-semibold text-foreground mb-4">Risk & Quality Radar</h3>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Radar dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </div>
      )}

      {/* Feature Grid */}
      <div>
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Features</h3>
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {features.map((feature) => (
            <motion.button
              key={feature.id}
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveFeature(feature.id)}
              className="bg-surface border border-border rounded-xl p-4 text-left hover:border-border-bright transition-all group"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `${feature.color}15` }}>
                <feature.icon className="w-4.5 h-4.5" style={{ color: feature.color }} />
              </div>
              <h4 className="text-xs font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{feature.label}</h4>
              <p className="text-[10px] text-muted leading-relaxed">{feature.desc}</p>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
