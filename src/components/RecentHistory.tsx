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
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#F0F9FF]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#E0F2FE] bg-white p-5 rounded-2xl shadow-sm border">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white shadow-md shadow-sky-500/10">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2 tracking-tight">
              Execution & Audit History
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-[#FDF2F8] text-[#BE185D] border border-[#FCE7F3]">
                Snapshots & Audit Log
              </span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5 font-medium">Immutable historical versions of SRS requirements and generated test suites</p>
          </div>
        </div>

        {srsHistory.length > 0 && (
          <button
            onClick={handleExportHistory}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] hover:opacity-95 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export History Excel</span>
          </button>
        )}
      </motion.div>

      {/* Search Bar */}
      {srsHistory.length > 0 && (
        <div className="flex items-center gap-2 max-w-md p-2 bg-white rounded-2xl border-2 border-slate-200 shadow-xs">
          <Search className="w-4 h-4 text-slate-400 ml-2" />
          <input
            type="text"
            placeholder="Search saved SRS suites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-[#0F172A] font-bold outline-none w-full placeholder-slate-400"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" />
          <span className="text-sm font-bold">Retrieving audit history snapshots...</span>
        </div>
      ) : srsHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border-2 border-dashed border-sky-200 rounded-2xl shadow-sm">
          <History className="w-16 h-16 text-sky-300 mb-3" />
          <h3 className="text-base font-black text-[#0F172A]">No History Snapshots Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md text-center font-medium">
            Your SRS inputs and generated test cases will be saved automatically as immutable snapshots.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Snapshots List */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-black text-[#0F172A] uppercase tracking-wider px-1">
              Historical Records ({filteredHistory.length})
            </h3>
            <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
              {filteredHistory.map((entry, idx) => {
                const isSelected = selectedHistory?.id === entry.id;
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => setSelectedHistory(entry)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer shadow-xs ${
                      isSelected
                        ? 'bg-[#FAF5FF] border-[#8B5CF6]'
                        : 'bg-white border-slate-200 hover:border-[#8B5CF6]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <FileText className={`w-5 h-5 mt-0.5 shrink-0 ${isSelected ? 'text-[#8B5CF6]' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-[#0F172A] truncate">{entry.title}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatDate(entry.createdAt)}</span>
                        </p>
                        <span className="inline-block text-xs font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-[#7C3AED] border border-purple-200 mt-2">
                          {entry.testCaseCount} Test Cases
                        </span>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isSelected ? 'rotate-90 text-[#8B5CF6]' : ''}`} />
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
                className="bg-white border-2 border-purple-200 rounded-2xl p-6 space-y-5 shadow-sm"
              >
                <div className="flex items-start justify-between pb-4 border-b border-purple-100">
                  <div>
                    <h3 className="text-lg font-black text-[#0F172A]">{selectedHistory.title}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 font-bold">
                      <Clock className="w-4 h-4 text-[#8B5CF6]" />
                      <span>Recorded on {new Date(selectedHistory.createdAt).toLocaleString()}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLoadHistory(selectedHistory)}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:opacity-95 text-white rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Restore to Editor</span>
                    </button>
                    <button
                      onClick={(e) => handleRemoveHistory(selectedHistory.id, e)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-xl border-2 border-slate-200 hover:border-red-300 transition-colors cursor-pointer"
                      title="Delete Snapshot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#FAF5FF] border-2 border-purple-100 rounded-2xl p-4">
                    <p className="text-xs text-[#7C3AED] uppercase font-black tracking-wider">Total Test Cases in Snapshot</p>
                    <p className="text-3xl font-black text-[#7C3AED] mt-1">{selectedHistory.testCaseCount}</p>
                  </div>
                  <div className="bg-[#F0FDF4] border-2 border-emerald-100 rounded-2xl p-4">
                    <p className="text-xs text-[#166534] uppercase font-black tracking-wider">Specification Payload Size</p>
                    <p className="text-3xl font-black text-[#16A34A] mt-1">{(selectedHistory.srsText.length / 1024).toFixed(1)} KB</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-black text-[#0F172A] uppercase tracking-wider mb-2">Original SRS Excerpt</h4>
                  <div className="bg-[#F8FCFF] border-2 border-sky-100 rounded-2xl p-4 max-h-80 overflow-y-auto">
                    <pre className="text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed font-bold">
                      {selectedHistory.srsText}
                    </pre>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full min-h-[300px] flex items-center justify-center border-2 border-dashed border-sky-200 rounded-2xl text-center p-6 text-slate-500 font-bold text-sm bg-white">
                Select an audit snapshot from the list to preview details or restore to workspace.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
