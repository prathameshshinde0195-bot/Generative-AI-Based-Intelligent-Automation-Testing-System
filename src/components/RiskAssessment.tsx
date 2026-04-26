import { motion } from 'framer-motion';
import { Shield, AlertTriangle, Zap, Bug, TrendingUp } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';

export default function RiskAssessment() {
  const { riskAssessment } = useAppStore();

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-red-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'from-red-500/20 to-red-500/5';
    if (score >= 40) return 'from-amber-500/20 to-amber-500/5';
    return 'from-emerald-500/20 to-emerald-500/5';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Critical';
    if (score >= 60) return 'High';
    if (score >= 40) return 'Medium';
    if (score >= 20) return 'Low';
    return 'Minimal';
  };

  const getScoreRingColor = (score: number) => {
    if (score >= 70) return '#ef4444';
    if (score >= 40) return '#f59e0b';
    return '#10b981';
  };

  if (!riskAssessment) {
    return (
      <div className="p-6 space-y-6 overflow-y-auto h-full">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-400" />
            AI-Powered Risk Assessment
          </h2>
        </motion.div>
        <div className="flex flex-col items-center justify-center py-20">
          <Shield className="w-16 h-16 text-border mb-4" />
          <p className="text-muted">Generate test cases first to run risk assessment.</p>
        </div>
      </div>
    );
  }

  const radarData = [
    { subject: 'Security', value: riskAssessment.securityRisk, fullMark: 100 },
    { subject: 'Performance', value: riskAssessment.performanceRisk, fullMark: 100 },
    { subject: 'Functional', value: riskAssessment.functionalRisk, fullMark: 100 },
  ];

  const riskCategories = [
    { label: 'Security Risk', score: riskAssessment.securityRisk, icon: Shield, description: 'Authentication, authorization, data protection, and vulnerability risks' },
    { label: 'Performance Risk', score: riskAssessment.performanceRisk, icon: Zap, description: 'Response time, throughput, scalability, and resource utilization risks' },
    { label: 'Functional Risk', score: riskAssessment.functionalRisk, icon: Bug, description: 'Business logic, integration, data integrity, and workflow risks' },
  ];

  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (riskAssessment.overallScore / 100) * circumference;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6 text-orange-400" />
          AI-Powered Risk Assessment
        </h2>
        <p className="text-sm text-muted mt-1">Comprehensive risk analysis across security, performance, and functional dimensions</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overall Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`bg-gradient-to-br ${getScoreBg(riskAssessment.overallScore)} border border-border rounded-xl p-6 flex flex-col items-center justify-center`}
        >
          <span className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Overall Risk Score</span>
          <div className="relative w-36 h-36">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="60" fill="none" stroke="#1e293b" strokeWidth="8" />
              <motion.circle
                cx="70" cy="70" r="60" fill="none"
                stroke={getScoreRingColor(riskAssessment.overallScore)}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold ${getScoreColor(riskAssessment.overallScore)}`}>{riskAssessment.overallScore}</span>
              <span className="text-[10px] text-muted">/100</span>
            </div>
          </div>
          <span className={`text-sm font-semibold mt-3 ${getScoreColor(riskAssessment.overallScore)}`}>
            {getScoreLabel(riskAssessment.overallScore)} Risk
          </span>
        </motion.div>

        {/* Radar Chart */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2">Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Radar dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.2} />
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
              className="bg-surface border border-border rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <cat.icon className={`w-4 h-4 ${getScoreColor(cat.score)}`} />
                <span className="text-xs font-semibold text-foreground">{cat.label}</span>
                <span className={`ml-auto text-lg font-bold font-mono ${getScoreColor(cat.score)}`}>{cat.score}</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${cat.score}%` }}
                  transition={{ duration: 1, delay: i * 0.1 }}
                  className={`h-full rounded-full ${cat.score >= 70 ? 'bg-red-500' : cat.score >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                />
              </div>
              <p className="text-[10px] text-muted">{cat.description}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Risk Factors */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-foreground">Identified Risk Factors ({riskAssessment.factors.length})</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {riskAssessment.factors.map((factor, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.03 }}
              className="flex items-start gap-2 bg-surface-alt rounded-lg p-3"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
              <span className="text-xs text-foreground/80">{factor}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
