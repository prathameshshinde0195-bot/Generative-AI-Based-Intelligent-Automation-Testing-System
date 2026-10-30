import { motion } from 'framer-motion';
import { History, Trash2, Eye, Clock, FileText, ChevronRight, Loader2, Search, Download } from 'lucide-react';
import { useAppStore, type SRSHistory } from '../lib/store';
import { historyAPI } from '../lib/api';
import { toast } from 'sonner';
import { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';

export default function RecentHistory() {
  const { srsHistory, setSrsHistory, removeSrsHistory, loadSrsHistory, projectId, setActiveFeature } = useAppStore();
  const [selectedHistory, setSelectedHistory] = useState<SRSHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await historyAPI.listSrs(projectId || 'default') as { data?: SRSHistory[] };
        if (!cancelled) {
          setSrsHistory(res?.data || []);
        }
      } catch {
        if (!cancelled) {
          toast.error('Could not load your SRS history');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [projectId, setSrsHistory]);

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

  const filteredHistory = useMemo(() => {
    if (!search.trim()) return srsHistory;
    const q = search.toLowerCase();
    return srsHistory.filter(h => (h.title || '').toLowerCase().includes(q) || (h.srsText || '').toLowerCase().includes(q));
  }, [srsHistory, search]);

  const handleRemoveHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await historyAPI.deleteSrs(id);
      removeSrsHistory(id);
      toast.success('SRS history record removed');
      if (selectedHistory?.id === id) {
        setSelectedHistory(null);
      }
    } catch {
      toast.error('Failed to remove history');
    }
  };

  const handleLoadHistory = (entry: SRSHistory) => {
    try {
      loadSrsHistory(entry);
      setSelectedHistory(entry);
      setActiveFeature('srs-input');
      toast.success(`Loaded SRS suite: ${entry.title}`);
    } catch {
      toast.error('Failed to load history snapshot');
    }
  };

  const handleExportHistory = () => {
    const data = srsHistory.map(h => ({
      'Title': h.title,
      'Created At': new Date(h.createdAt).toLocaleString(),
      'Test Case Count': h.testCaseCount,
      'Document Size': `${(h.srsText.length / 1024).toFixed(1)} KB`,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit History');
    XLSX.writeFile(wb, `SRS-Audit-History-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Audit history exported to Excel');
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#f0f9ff] dark:bg-slate-900">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0] dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/40 flex items-center justify-center text-[#0ea5e9]">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
              Execution & Audit History
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-sky-50 text-[#0ea5e9] dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200">
                Snapshots & Audit Log
              </span>
            </h2>
            <p className="text-xs text-[#64748b]">Immutable historical versions of SRS requirements and generated test suites</p>
          </div>
        </div>

        {srsHistory.length > 0 && (
          <button
            onClick={handleExportHistory}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export History Excel</span>
          </button>
        )}
      </motion.div>

      {/* Search Bar */}
      {srsHistory.length > 0 && (
        <div className="flex items-center gap-2 max-w-sm p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-border">
          <Search className="w-4 h-4 text-muted ml-2" />
          <input
            type="text"
            placeholder="Search saved SRS suites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-foreground outline-none w-full"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#7c3aed]" />
          <span className="text-xs font-medium">Retrieving audit history snapshots...</span>
        </div>
      ) : srsHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-border rounded-2xl">
          <History className="w-16 h-16 text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-foreground">No History Snapshots Yet</h3>
          <p className="text-xs text-muted mt-1 max-w-md text-center">
            Your SRS inputs and generated test cases will be saved automatically as immutable snapshots.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Snapshots List */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1">
              Historical Records ({filteredHistory.length})
            </h3>
            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
              {filteredHistory.map((entry, idx) => {
                const isSelected = selectedHistory?.id === entry.id;
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => setSelectedHistory(entry)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
                      isSelected
                        ? 'bg-purple-50 dark:bg-purple-950/40 border-[#7c3aed]'
                        : 'bg-white dark:bg-slate-800 border-border hover:border-border-bright'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-[#7c3aed]' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{entry.title}</p>
                        <p className="text-[10px] text-muted flex items-center gap-1 mt-1 font-medium">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(entry.createdAt)}</span>
                        </p>
                        <span className="inline-block text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-[#7c3aed] mt-1.5">
                          {entry.testCaseCount} Test Cases
                        </span>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-muted transition-transform ${isSelected ? 'rotate-90 text-[#7c3aed]' : ''}`} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right: Snapshot Detail Inspection */}
          <div className="lg:col-span-2">
            {selectedHistory ? (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-slate-800 border border-border rounded-xl p-5 space-y-4 shadow-xs"
              >
                <div className="flex items-start justify-between pb-3 border-b border-border">
                  <div>
                    <h3 className="text-base font-bold text-foreground">{selectedHistory.title}</h3>
                    <p className="text-xs text-muted flex items-center gap-1.5 mt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Recorded on {new Date(selectedHistory.createdAt).toLocaleString()}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLoadHistory(selectedHistory)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Restore to Editor</span>
                    </button>
                    <button
                      onClick={(e) => handleRemoveHistory(selectedHistory.id, e)}
                      className="p-1.5 text-muted hover:text-red-600 rounded-lg border border-border hover:border-red-300 transition-colors"
                      title="Delete Snapshot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-850 border border-border rounded-lg p-3">
                    <p className="text-[10px] text-muted uppercase font-bold">Total Test Cases in Snapshot</p>
                    <p className="text-2xl font-black text-[#7c3aed] mt-0.5">{selectedHistory.testCaseCount}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-850 border border-border rounded-lg p-3">
                    <p className="text-[10px] text-muted uppercase font-bold">Specification Payload Size</p>
                    <p className="text-2xl font-black text-[#16a34a] mt-0.5">{(selectedHistory.srsText.length / 1024).toFixed(1)} KB</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Original SRS Excerpt</h4>
                  <div className="bg-slate-50 dark:bg-slate-850 border border-border rounded-xl p-3.5 max-h-80 overflow-y-auto">
                    <pre className="text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                      {selectedHistory.srsText}
                    </pre>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full min-h-[300px] flex items-center justify-center border border-dashed border-border rounded-xl text-center p-6 text-muted text-xs">
                Select an audit snapshot from the list to preview details or restore to workspace.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
