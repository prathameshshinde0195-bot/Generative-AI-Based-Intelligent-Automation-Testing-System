import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ChevronDown, ChevronUp, Bug, Flame, Lock, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../lib/store';

export default function NegativeEdgeCases() {
  const { negativeTestCases, toggleTestCaseCoverage } = useAppStore();
  const [expandedTC, setExpandedTC] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? negativeTestCases : negativeTestCases.filter(tc => tc.category === filter);

  const getCategoryIcon = (cat: string) => {
    if (cat === 'boundary') return Flame;
    if (cat === 'negative') return Bug;
    if (cat === 'security') return Lock;
    return ShieldAlert;
  };

  const getCategoryColor = (cat: string) => {
    if (cat === 'boundary') return 'text-amber-400';
    if (cat === 'negative') return 'text-red-400';
    if (cat === 'security') return 'text-purple-400';
    return 'text-foreground';
  };

  const getCategoryBadge = (cat: string) => {
    if (cat === 'boundary') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    if (cat === 'negative') return 'bg-red-500/15 text-red-400 border-red-500/30';
    if (cat === 'security') return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-danger" />
          Negative & Edge Case Generator
        </h2>
        <p className="text-sm text-muted mt-1">AI-generated boundary, invalid input, and security edge cases</p>
      </motion.div>

      {negativeTestCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <ShieldAlert className="w-16 h-16 text-border mb-4" />
          <p className="text-muted">Generate test cases from SRS to auto-generate edge cases.</p>
        </div>
      ) : (
        <>
          {/* Filter Tabs */}
          <div className="flex gap-2">
            {['all', 'boundary', 'negative', 'security'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${filter === f
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'bg-surface border border-border text-muted hover:text-foreground'
                  }`}
              >
                {f === 'all' ? `All (${negativeTestCases.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${negativeTestCases.filter(tc => tc.category === f).length})`}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filtered.map((tc, i) => {
              const Icon = getCategoryIcon(tc.category);
              return (
                <motion.div
                  key={tc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-surface border border-border rounded-lg overflow-hidden hover:border-border-bright transition-colors"
                >
                  <button
                    onClick={() => setExpandedTC(expandedTC === tc.id ? null : tc.id)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${getCategoryColor(tc.category)}`} />
                    <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{tc.testCaseId}</span>
                    <span className="text-xs text-foreground flex-1 truncate">{tc.scenario}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleTestCaseCoverage(tc.testCaseId); }}
                      className={`px-2 py-1 text-[10px] rounded-full flex items-center gap-1 border transition-colors ${tc.isCovered ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-surface border-border hover:bg-surface-alt text-muted'}`}
                    >
                      <CheckCircle2 className="w-3 h-3" /> {tc.isCovered ? 'Covered' : 'Mark Covered'}
                    </button>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getCategoryBadge(tc.category)}`}>
                      {tc.category}
                    </span>
                    {expandedTC === tc.id ? <ChevronUp className="w-3.5 h-3.5 text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-muted" />}
                  </button>
                  <AnimatePresence>
                    {expandedTC === tc.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border"
                      >
                        <div className="p-3 space-y-3 text-xs">
                          <div>
                            <span className="text-muted font-semibold">Preconditions:</span>
                            <p className="mt-1 text-foreground/80">{tc.preconditions}</p>
                          </div>
                          <div>
                            <span className="text-muted font-semibold">Steps:</span>
                            <ol className="mt-1 space-y-1">
                              {tc.steps.map((step, si) => (
                                <li key={si} className="flex gap-2 text-foreground/80">
                                  <span className="text-primary font-mono shrink-0">{si + 1}.</span>
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </div>
                          <div>
                            <span className="text-muted font-semibold">Expected Result:</span>
                            <p className="mt-1 text-foreground/80">{tc.expectedResults}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted">Risk Score:</span>
                            <div className="flex-1 max-w-[200px] h-2 bg-border rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${tc.riskScore >= 70 ? 'bg-red-500' : tc.riskScore >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${tc.riskScore}%` }} />
                            </div>
                            <span className="font-mono font-bold text-foreground">{tc.riskScore}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
