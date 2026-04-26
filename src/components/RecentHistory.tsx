import { motion } from 'framer-motion';
import { History, Trash2, Eye, Clock, FileText, ChevronRight } from 'lucide-react';
import { useAppStore, type SRSHistory } from '../lib/store';
import { toast } from 'sonner';
import { useState } from 'react';

export default function RecentHistory() {
  const { srsHistory, removeSrsHistory, loadSrsHistory } = useAppStore();
  const [selectedHistory, setSelectedHistory] = useState<SRSHistory | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const handleRemoveHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      removeSrsHistory(id);
      toast.success('SRS history removed');
      if (selectedHistory?.id === id) {
        setSelectedHistory(null);
      }
    } catch (error) {
      toast.error('Failed to remove history');
    }
  };

  const handleLoadHistory = (entry: SRSHistory) => {
    try {
      loadSrsHistory(entry);
      setSelectedHistory(entry);
      toast.success(`Loaded SRS: ${entry.title}`);
    } catch (error) {
      toast.error('Failed to load history');
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <History className="w-6 h-6 text-blue-400" />
          Recent SRS History
        </h2>
        <p className="text-sm text-muted mt-1">View, load, and manage your recent SRS documents</p>
      </motion.div>

      {srsHistory.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-8 text-center">
          <History className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-blue-400">No History Yet</h3>
          <p className="text-sm text-muted mt-1">Your SRS documents will appear here when you generate test cases</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* History List */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider px-2 py-1">History ({srsHistory.length})</h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {srsHistory.map((entry, idx) => (
                <motion.button
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => handleLoadHistory(entry)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedHistory?.id === entry.id
                      ? 'bg-blue-500/10 border-blue-500/50'
                      : 'bg-surface border-border hover:border-border-bright'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{entry.title}</p>
                      <p className="text-[10px] text-muted flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(entry.createdAt)}
                      </p>
                      <p className="text-[10px] text-muted mt-1">{entry.testCaseCount} test cases</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-muted flex-shrink-0 transition-transform ${selectedHistory?.id === entry.id ? 'rotate-90' : ''}`} />
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Details Panel */}
          {selectedHistory && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2 space-y-4"
            >
              <div className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{selectedHistory.title}</h3>
                    <p className="text-xs text-muted flex items-center gap-2 mt-2">
                      <Clock className="w-3 h-3" />
                      Created {formatDate(selectedHistory.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleRemoveHistory(selectedHistory.id, e)}
                    className="flex items-center gap-1 px-3 py-1.5 text-red-400 hover:bg-red-500/10 rounded border border-red-500/20 hover:border-red-500/50 transition-colors text-xs font-semibold"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">SRS Content</p>
                    <div className="bg-surface-alt border border-border rounded-lg p-3 max-h-[300px] overflow-y-auto">
                      <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {selectedHistory.srsText.substring(0, 500)}
                        {selectedHistory.srsText.length > 500 && '...'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface-alt border border-border rounded-lg p-3">
                      <p className="text-2xl font-bold text-blue-400">{selectedHistory.testCaseCount}</p>
                      <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Test Cases</p>
                    </div>
                    <div className="bg-surface-alt border border-border rounded-lg p-3">
                      <p className="text-2xl font-bold text-green-400">{(selectedHistory.srsText.length / 1000).toFixed(1)}</p>
                      <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">KB</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleLoadHistory(selectedHistory)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 hover:border-blue-500/50 transition-colors"
                  >
                    <Eye className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-blue-400">Load & Continue</span>
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface border border-border rounded-lg p-3">
                  <p className="text-[10px] font-mono text-primary mb-1">{selectedHistory.id.substring(0, 8)}...</p>
                  <p className="text-[10px] text-muted">ID</p>
                </div>
                <div className="bg-surface border border-border rounded-lg p-3">
                  <p className="text-xs font-semibold text-emerald-400">{selectedHistory.srsText.split('\n').length} Lines</p>
                  <p className="text-[10px] text-muted">Content</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      {srsHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-border"
        >
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-2xl font-bold text-blue-400">{srsHistory.length}</p>
            <p className="text-xs text-muted uppercase tracking-wider font-semibold mt-1">Total Documents</p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-2xl font-bold text-emerald-400">
              {srsHistory.reduce((sum, h) => sum + h.testCaseCount, 0)}
            </p>
            <p className="text-xs text-muted uppercase tracking-wider font-semibold mt-1">Total Test Cases</p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-2xl font-bold text-purple-400">
              {(srsHistory.reduce((sum, h) => sum + h.srsText.length, 0) / 1024).toFixed(1)} KB
            </p>
            <p className="text-xs text-muted uppercase tracking-wider font-semibold mt-1">Total Size</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
