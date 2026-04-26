import { motion } from 'framer-motion';
import { ArrowUpDown, Shield, Zap, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../lib/store';

export default function TestPrioritization() {
  const { testCases, negativeTestCases } = useAppStore();
  const allCases = [...testCases, ...negativeTestCases];

  const sorted = [...allCases].sort((a, b) => {
    const priorityOrder = { High: 0, Medium: 1, Low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[a.priority] - priorityOrder[b.priority];
    return b.riskScore - a.riskScore;
  });

  const getPriorityBadge = (p: string) => {
    if (p === 'High') return 'bg-red-500/15 text-red-400 border border-red-500/30';
    if (p === 'Medium') return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getRiskBg = (score: number) => {
    if (score >= 70) return 'bg-red-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ArrowUpDown className="w-6 h-6 text-accent" />
          Intelligent Test Case Prioritization
        </h2>
        <p className="text-sm text-muted mt-1">AI-analyzed priority based on business criticality, security keywords, and frequency indicators</p>
      </motion.div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <ArrowUpDown className="w-16 h-16 text-border mb-4" />
          <p className="text-muted">No test cases to prioritize yet.</p>
        </div>
      ) : (
        <>
          {/* Priority Summary */}
          <div className="flex gap-4">
            {(['High', 'Medium', 'Low'] as const).map(p => {
              const count = sorted.filter(tc => tc.priority === p).length;
              const icons = { High: Shield, Medium: Zap, Low: AlertTriangle };
              const colors = { High: 'text-red-400', Medium: 'text-amber-400', Low: 'text-emerald-400' };
              const Icon = icons[p];
              return (
                <motion.div
                  key={p}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-surface border border-border rounded-xl px-5 py-4 flex-1"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${colors[p]}`} />
                    <span className="text-xs font-semibold text-muted uppercase">{p} Priority</span>
                  </div>
                  <p className={`text-3xl font-bold ${colors[p]}`}>{count}</p>
                  <p className="text-[10px] text-muted mt-1">{Math.round((count / sorted.length) * 100)}% of total</p>
                </motion.div>
              );
            })}
          </div>

          {/* Prioritized Table */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[80px_1fr_100px_100px_120px_80px] gap-2 px-4 py-3 bg-surface-alt text-[10px] font-semibold text-muted uppercase tracking-wider border-b border-border">
              <span>ID</span>
              <span>Scenario</span>
              <span>Priority</span>
              <span>Risk Score</span>
              <span>Category</span>
              <span>Req</span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {sorted.map((tc, i) => (
                <motion.div
                  key={tc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[80px_1fr_100px_100px_120px_80px] gap-2 px-4 py-3 border-b border-border/50 hover:bg-surface-alt/50 transition-colors items-center text-xs"
                >
                  <span className="font-mono text-primary font-bold text-[10px]">{tc.testCaseId}</span>
                  <span className="text-foreground/80 truncate">{tc.scenario}</span>
                  <span>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${getPriorityBadge(tc.priority)}`}>
                      {tc.priority}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${getRiskBg(tc.riskScore)}`} style={{ width: `${tc.riskScore}%` }} />
                    </div>
                    <span className={`font-mono font-bold ${getRiskColor(tc.riskScore)}`}>{tc.riskScore}</span>
                  </span>
                  <span className="text-muted capitalize">{tc.category}</span>
                  <span className="font-mono text-muted text-[10px]">{tc.requirementId}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
