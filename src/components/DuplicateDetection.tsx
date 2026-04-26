import { motion } from 'framer-motion';
import { Copy, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { toast } from 'sonner';

export default function DuplicateDetection() {
  const { duplicates, testCases, removeTestCase } = useAppStore();

  const getSimilarityBg = (sim: number) => {
    if (sim >= 85) return 'bg-red-500';
    if (sim >= 70) return 'bg-amber-500';
    return 'bg-yellow-500';
  };

  const getSimilarityBadge = (sim: number) => {
    if (sim >= 85) return 'bg-red-500/15 text-red-400 border-red-500/30';
    if (sim >= 70) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
  };

  const handleRemoveDuplicate = (testCaseId: string) => {
    try {
      removeTestCase(testCaseId);
      toast.success(`Test case ${testCaseId} removed successfully!`);
    } catch (error) {
      toast.error(`Failed to remove test case: ${testCaseId}`);
    }
  };

  const handleRemoveAllDuplicates = () => {
    if (duplicates.length === 0) {
      toast.info('No duplicates to remove');
      return;
    }
    
    const removed = new Set<string>();
    duplicates.forEach((dup) => {
      if (!removed.has(dup.testCase2Id)) {
        removeTestCase(dup.testCase2Id);
        removed.add(dup.testCase2Id);
      }
    });
    
    toast.success(`Removed ${removed.size} duplicate test case(s)`);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Copy className="w-6 h-6 text-pink-400" />
          Duplicate Test Case Detection
        </h2>
        <p className="text-sm text-muted mt-1">AI-powered similarity analysis to identify and remove redundant test cases</p>
      </motion.div>

      {duplicates.length === 0 && testCases.length > 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-emerald-400">No Duplicates Found</h3>
          <p className="text-sm text-muted mt-1">All test cases are unique with sufficient differentiation.</p>
        </motion.div>
      ) : duplicates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Copy className="w-16 h-16 text-border mb-4" />
          <p className="text-muted">Generate test cases first to check for duplicates.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-4">
            <div className="bg-surface border border-border rounded-xl px-5 py-3">
              <p className="text-2xl font-bold text-pink-400">{duplicates.length}</p>
              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Duplicate Pairs</p>
            </div>
            <div className="bg-surface border border-border rounded-xl px-5 py-3">
              <p className="text-2xl font-bold text-foreground">
                {Math.round(duplicates.reduce((acc, d) => acc + d.similarity, 0) / duplicates.length)}%
              </p>
              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Avg Similarity</p>
            </div>
            <div className="flex-1"></div>
            <button
              onClick={handleRemoveAllDuplicates}
              disabled={duplicates.length === 0}
              className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 hover:border-red-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              <span className="text-xs font-semibold text-red-400">Remove All Duplicates</span>
            </button>
          </div>

          <div className="space-y-3">
            {duplicates.map((dup, i) => {
              const tc1 = testCases.find(tc => tc.testCaseId === dup.testCase1Id);
              const tc2 = testCases.find(tc => tc.testCaseId === dup.testCase2Id);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-surface border border-border rounded-xl p-4 hover:border-border-bright transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-pink-400" />
                      <span className="text-xs font-semibold text-foreground">Potential Duplicate</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getSimilarityBadge(dup.similarity)}`}>
                        {dup.similarity}% Similar
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleRemoveDuplicate(dup.testCase2Id)}
                        className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors px-2 py-1 hover:bg-red-500/10 rounded"
                        title={`Remove ${dup.testCase2Id}`}
                      >
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface-alt rounded-lg p-3">
                      <span className="text-[10px] font-mono font-bold text-primary">{dup.testCase1Id}</span>
                      <p className="text-xs text-foreground/80 mt-1">{tc1?.scenario || 'Test case details'}</p>
                    </div>
                    <div className="bg-surface-alt rounded-lg p-3">
                      <span className="text-[10px] font-mono font-bold text-primary">{dup.testCase2Id}</span>
                      <p className="text-xs text-foreground/80 mt-1">{tc2?.scenario || 'Test case details'}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${getSimilarityBg(dup.similarity)}`} style={{ width: `${dup.similarity}%` }} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
