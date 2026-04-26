import { motion } from 'framer-motion';
import { BarChart3, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export default function CoverageAnalyzer() {
  const { coverage, traceability } = useAppStore();

  if (!coverage) {
    return (
      <div className="p-6 space-y-6 overflow-y-auto h-full">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-teal-400" />
            Test Coverage Analyzer
          </h2>
        </motion.div>
        <div className="flex flex-col items-center justify-center py-20">
          <BarChart3 className="w-16 h-16 text-border mb-4" />
          <p className="text-muted">Generate test cases first to analyze coverage.</p>
        </div>
      </div>
    );
  }

  const coveragePie = [
    { name: 'Covered', value: coverage.coveredRequirements, color: '#10b981' },
    { name: 'Uncovered', value: coverage.totalRequirements - coverage.coveredRequirements, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const categoryColors = ['#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-teal-400" />
          Test Coverage Analyzer
        </h2>
        <p className="text-sm text-muted mt-1">Requirement coverage metrics and gap analysis</p>
      </motion.div>

      {/* Coverage Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-surface border border-border rounded-xl p-4">
          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Total Requirements</p>
          <p className="text-3xl font-bold text-foreground mt-1">{coverage.totalRequirements}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-xl p-4">
          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Covered</p>
          <p className="text-3xl font-bold text-success mt-1">{coverage.coveredRequirements}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-surface border border-border rounded-xl p-4">
          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Coverage %</p>
          <p className={`text-3xl font-bold mt-1 ${coverage.coveragePercentage >= 80 ? 'text-success' : coverage.coveragePercentage >= 50 ? 'text-warning' : 'text-danger'}`}>
            {coverage.coveragePercentage}%
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="bg-surface border border-border rounded-xl p-4">
          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Missing</p>
          <p className="text-3xl font-bold text-danger mt-1">{coverage.missingRequirements.length}</p>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Coverage Overview</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={coveragePie} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" stroke="none">
                {coveragePie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a2236', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            {coveragePie.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                <span className="text-xs text-muted">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Test Category Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={coverage.categoryBreakdown}>
              <XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1a2236', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              <Bar dataKey="count" name="Test Cases" fill="#06b6d4" radius={[4, 4, 0, 0]}>
                {coverage.categoryBreakdown.map((_, i) => <Cell key={i} fill={categoryColors[i % categoryColors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Missing Requirements Alert */}
      {coverage.missingRequirements.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <h3 className="text-sm font-semibold text-red-400">Missing Requirement Coverage</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {coverage.missingRequirements.map(req => (
              <span key={req} className="text-xs font-mono bg-red-500/10 text-red-400 px-3 py-1 rounded-lg border border-red-500/20">{req}</span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Per-requirement coverage */}
      {traceability.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Per-Requirement Coverage</h3>
          <div className="space-y-2">
            {traceability.map(entry => (
              <div key={entry.requirementId} className="flex items-center gap-3">
                <span className="text-[10px] font-mono font-bold text-primary w-20 shrink-0">{entry.requirementId}</span>
                <div className="flex-1 h-3 bg-border rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${entry.coverage}%` }}
                    transition={{ duration: 0.8, delay: 0.1 }}
                    className={`h-full rounded-full ${entry.coverage >= 80 ? 'bg-emerald-500' : entry.coverage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  />
                </div>
                <span className={`text-xs font-mono font-bold w-12 text-right ${entry.coverage >= 80 ? 'text-emerald-400' : entry.coverage >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {entry.coverage}%
                </span>
                {entry.coverage >= 80 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
