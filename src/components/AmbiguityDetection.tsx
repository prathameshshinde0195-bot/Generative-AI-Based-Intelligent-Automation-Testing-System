import { motion } from 'framer-motion';
import { AlertTriangle, HelpCircle, Lightbulb, AlertCircle } from 'lucide-react';
import { useAppStore } from '../lib/store';

export default function AmbiguityDetection() {
  const { ambiguities, srsText } = useAppStore();
  const lines = srsText.split('\n');

  const getSeverityStyle = (s: string) => {
    if (s === 'high') return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', badge: 'bg-red-500/20 text-red-400' };
    if (s === 'medium') return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-400' };
    return { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-400' };
  };

  const highCount = ambiguities.filter(a => a.severity === 'high').length;
  const medCount = ambiguities.filter(a => a.severity === 'medium').length;
  const lowCount = ambiguities.filter(a => a.severity === 'low').length;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-warning" />
          Requirement Ambiguity Detection
        </h2>
        <p className="text-sm text-muted mt-1">NLP-powered analysis of vague and ambiguous language in your requirements</p>
      </motion.div>

      {ambiguities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="w-16 h-16 text-border mb-4" />
          <p className="text-muted">No ambiguities detected yet.</p>
          <p className="text-xs text-muted/60 mt-1">Generate test cases from SRS first to run ambiguity analysis.</p>
        </div>
      ) : (
        <>
          {/* Summary Bar */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4">
            {[
              { label: 'High Severity', count: highCount, color: 'text-red-400', bg: 'bg-red-500/10' },
              { label: 'Medium Severity', count: medCount, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { label: 'Low Severity', count: lowCount, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl px-5 py-3 border border-border`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">{s.label}</p>
              </div>
            ))}
            <div className="bg-surface rounded-xl px-5 py-3 border border-border ml-auto">
              <p className="text-2xl font-bold text-foreground">{ambiguities.length}</p>
              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Total Issues</p>
            </div>
          </motion.div>

          {/* Highlighted SRS with annotations */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Annotated SRS</h3>
              <div className="bg-surface border border-border rounded-xl p-4 max-h-[500px] overflow-y-auto">
                {lines.map((line, idx) => {
                  const lineIssues = ambiguities.filter(a => a.lineNumber === idx + 1);
                  const hasIssue = lineIssues.length > 0;
                  return (
                    <div key={idx} className={`flex gap-2 py-1 px-2 rounded text-xs font-mono ${hasIssue ? 'bg-amber-500/5' : ''}`}>
                      <span className="text-muted/40 w-6 shrink-0 text-right">{idx + 1}</span>
                      <span className={hasIssue ? 'text-amber-300' : 'text-foreground/70'}>{line || ' '}</span>
                      {hasIssue && <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Detected Issues</h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {ambiguities.map((issue, i) => {
                  const style = getSeverityStyle(issue.severity);
                  return (
                    <motion.div
                      key={issue.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`${style.bg} border ${style.border} rounded-lg p-3 space-y-2`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                          {issue.severity.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted">Line {issue.lineNumber}</span>
                        <code className={`ml-auto text-xs font-mono ${style.text}`}>"{issue.phrase}"</code>
                      </div>
                      <div className="flex items-start gap-2 text-xs">
                        <HelpCircle className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
                        <span className="text-foreground/70">{issue.reason}</span>
                      </div>
                      <div className="flex items-start gap-2 text-xs">
                        <Lightbulb className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                        <span className="text-warning/80">{issue.suggestion}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
