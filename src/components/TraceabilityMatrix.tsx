import { motion } from 'framer-motion';
import { Grid3X3, Download, CheckCircle2, XCircle } from 'lucide-react';
import { useAppStore } from '../lib/store';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export default function TraceabilityMatrix() {
  const { traceability } = useAppStore();

  const exportToExcel = () => {
    const data = traceability.map(entry => ({
      'Requirement ID': entry.requirementId,
      'Requirement Text': entry.requirementText,
      'Test Case IDs': entry.testCaseIds.join(', '),
      'Number of Tests': entry.testCaseIds.length,
      'Coverage %': entry.coverage,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Traceability Matrix');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), 'traceability-matrix.xlsx');
  };

  const getCoverageColor = (cov: number) => {
    if (cov >= 80) return 'text-emerald-400';
    if (cov >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getCoverageBg = (cov: number) => {
    if (cov >= 80) return 'bg-emerald-500';
    if (cov >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Grid3X3 className="w-6 h-6 text-info" />
            Requirement Traceability Matrix
          </h2>
          <p className="text-sm text-muted mt-1">Automatic mapping of Requirements to Test Cases</p>
        </div>
        {traceability.length > 0 && (
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-surface border border-border rounded-lg px-4 py-2 text-xs font-semibold text-foreground hover:border-primary/50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel
          </button>
        )}
      </motion.div>

      {traceability.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Grid3X3 className="w-16 h-16 text-border mb-4" />
          <p className="text-muted">No traceability data yet. Generate test cases first.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[120px_1fr_1fr_100px_120px] gap-2 px-4 py-3 bg-surface-alt text-[10px] font-semibold text-muted uppercase tracking-wider border-b border-border">
            <span>Req ID</span>
            <span>Requirement</span>
            <span>Mapped Test Cases</span>
            <span>Tests</span>
            <span>Coverage</span>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {traceability.map((entry, i) => (
              <motion.div
                key={entry.requirementId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="grid grid-cols-[120px_1fr_1fr_100px_120px] gap-2 px-4 py-3 border-b border-border/50 hover:bg-surface-alt/50 transition-colors items-center"
              >
                <span className="text-xs font-mono font-bold text-primary">{entry.requirementId}</span>
                <span className="text-xs text-foreground/80 truncate">{entry.requirementText}</span>
                <div className="flex flex-wrap gap-1">
                  {entry.testCaseIds.length > 0 ? (
                    entry.testCaseIds.map(id => (
                      <span key={id} className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">{id}</span>
                    ))
                  ) : (
                    <span className="text-[10px] text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> No tests mapped</span>
                  )}
                </div>
                <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                  {entry.testCaseIds.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <XCircle className="w-3.5 h-3.5 text-danger" />}
                  {entry.testCaseIds.length}
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${getCoverageBg(entry.coverage)}`} style={{ width: `${entry.coverage}%` }} />
                  </div>
                  <span className={`text-xs font-mono font-bold ${getCoverageColor(entry.coverage)}`}>{entry.coverage}%</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
