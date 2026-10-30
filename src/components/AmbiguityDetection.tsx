import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, HelpCircle, Lightbulb, CheckCircle2,
  RefreshCw, Download, Check, ShieldCheck, Sparkles
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { detectAmbiguities } from '../lib/ai-engine';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function AmbiguityDetection() {
  const { ambiguities, setAmbiguities, srsText, setSrsText } = useAppStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [filterResolved, setFilterResolved] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');

  const lines = srsText.split('\n');

  const getSeverityStyle = (s: string) => {
    if (s === 'high') return { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800/40', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
    if (s === 'medium') return { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800/40', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' };
    return { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800/40', text: 'text-sky-600 dark:text-sky-400', badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' };
  };

  const highCount = ambiguities.filter(a => a.severity === 'high' && !a.resolved).length;
  const medCount = ambiguities.filter(a => a.severity === 'medium' && !a.resolved).length;
  const lowCount = ambiguities.filter(a => a.severity === 'low' && !a.resolved).length;
  const resolvedCount = ambiguities.filter(a => a.resolved).length;

  // Filter issues
  const filteredIssues = ambiguities.filter(issue => {
    if (selectedSeverity !== 'all' && issue.severity !== selectedSeverity) return false;
    if (selectedCategory !== 'all' && issue.category !== selectedCategory) return false;
    if (filterResolved === 'unresolved' && issue.resolved) return false;
    if (filterResolved === 'resolved' && !issue.resolved) return false;
    return true;
  });

  // Re-run analysis
  const handleReanalyze = async () => {
    if (!srsText.trim()) {
      toast.error('SRS text is empty. Enter requirements to analyze.');
      return;
    }
    setIsReanalyzing(true);
    try {
      const results = await detectAmbiguities(srsText);
      setAmbiguities(results);
      toast.success(`Analysis complete: ${results.length} issues detected`);
    } catch {
      toast.error('Failed to analyze ambiguities');
    } finally {
      setIsReanalyzing(false);
    }
  };

  // Accept a single suggestion: replace the line in srsText and mark resolved
  const handleAcceptSuggestion = (issueId: string) => {
    const issue = ambiguities.find(a => a.id === issueId);
    if (!issue || !issue.rewrittenRequirement) return;

    const lineIdx = issue.lineNumber - 1;
    if (lineIdx >= 0 && lineIdx < lines.length) {
      const updatedLines = [...lines];
      updatedLines[lineIdx] = issue.rewrittenRequirement;
      const updatedText = updatedLines.join('\n');
      setSrsText(updatedText);

      // Mark this issue as resolved
      const updatedAmbiguities = ambiguities.map(a => a.id === issueId ? { ...a, resolved: true } : a);
      setAmbiguities(updatedAmbiguities);
      toast.success(`Requirement on line ${issue.lineNumber} updated with suggested rewrite`);
    }
  };

  // Reject / dismiss suggestion
  const handleRejectSuggestion = (issueId: string) => {
    const updated = ambiguities.map(a => a.id === issueId ? { ...a, resolved: true } : a);
    setAmbiguities(updated);
    toast.info('Issue dismissed');
  };

  // Batch Accept All
  const handleBatchAccept = () => {
    let updatedText = srsText;
    const unresolved = ambiguities.filter(a => !a.resolved && a.rewrittenRequirement);
    if (unresolved.length === 0) {
      toast.info('No pending suggestions to accept');
      return;
    }

    const currentLines = updatedText.split('\n');
    unresolved.forEach(issue => {
      const idx = issue.lineNumber - 1;
      if (idx >= 0 && idx < currentLines.length && issue.rewrittenRequirement) {
        currentLines[idx] = issue.rewrittenRequirement;
      }
    });

    setSrsText(currentLines.join('\n'));
    setAmbiguities(ambiguities.map(a => ({ ...a, resolved: true })));
    toast.success(`Accepted ${unresolved.length} suggested rewrites into SRS`);
  };

  // Download Ambiguity Report
  const handleExportReport = () => {
    const data = ambiguities.map(a => ({
      'Line': a.lineNumber,
      'Severity': a.severity.toUpperCase(),
      'Category': a.category || 'Vague language',
      'Vague Phrase': a.phrase,
      'Reason': a.reason,
      'Suggestion': a.suggestion,
      'Rewritten Requirement': a.rewrittenRequirement || '',
      'Confidence Score': a.confidenceScore ? `${a.confidenceScore}%` : 'N/A',
      'Status': a.resolved ? 'Resolved' : 'Pending',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ambiguities');
    XLSX.writeFile(wb, `SRS-Ambiguity-Report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#f0f9ff] dark:bg-slate-900">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0] dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
              Requirement Ambiguity Detection
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200">
                NLP Quality Gate
              </span>
            </h2>
            <p className="text-xs text-[#64748b]">Identify vague terminology, missing quantifiable metrics, and ungrounded statements</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleReanalyze}
            disabled={isReanalyzing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-[#e2e8f0] dark:border-slate-700 text-[#0f172a] dark:text-white hover:border-[#0ea5e9] text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReanalyzing ? 'animate-spin text-[#0ea5e9]' : ''}`} />
            <span>{isReanalyzing ? 'Re-analyzing...' : 'Re-run Analysis'}</span>
          </button>

          {ambiguities.length > 0 && (
            <>
              <button
                onClick={handleBatchAccept}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-[#16a34a] text-xs font-semibold hover:bg-emerald-100 transition-colors"
                title="Batch accept all suggested rewritten requirements"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Accept All Rewrites</span>
              </button>

              <button
                onClick={handleExportReport}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Report</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      {ambiguities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-border rounded-2xl">
          <ShieldCheck className="w-16 h-16 text-emerald-400 mb-3" />
          <h3 className="text-base font-bold text-foreground">No Ambiguities Detected</h3>
          <p className="text-xs text-muted mt-1 max-w-md text-center">
            Your SRS text meets testable quality criteria, or test cases have not yet been extracted. Enter requirements in SRS Input and generate cases to run analysis.
          </p>
          <button
            onClick={handleReanalyze}
            disabled={isReanalyzing || !srsText.trim()}
            className="mt-4 px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] transition-colors"
          >
            Run Ambiguity Check Now
          </button>
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'High Severity', sev: 'high', count: highCount, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200' },
              { label: 'Medium Severity', sev: 'medium', count: medCount, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200' },
              { label: 'Low Severity', sev: 'low', count: lowCount, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200' },
              { label: 'Resolved', sev: 'all', count: resolvedCount, color: 'text-[#16a34a]', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200' },
              { label: 'Total Detected', sev: 'all', count: ambiguities.length, color: 'text-[#7c3aed]', bg: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200' },
            ].map(s => (
              <button
                key={s.label}
                onClick={() => setSelectedSeverity(prev => prev === s.sev ? 'all' : s.sev)}
                className={`${s.bg} rounded-xl px-4 py-3 border shadow-xs text-left transition-all hover:scale-[1.02] cursor-pointer ${
                  selectedSeverity === s.sev && s.sev !== 'all' ? 'ring-2 ring-[#7c3aed]' : ''
                }`}
              >
                <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
                <p className="text-[10px] text-muted uppercase tracking-wider font-bold mt-0.5">{s.label}</p>
              </button>
            ))}
          </motion.div>

          {/* Filters Bar: Categories & Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 border border-border rounded-xl">
            {/* Category Filter */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold text-muted text-[11px] uppercase mr-1">Category:</span>
              {[
                'all',
                'Vague language',
                'Missing measurable criteria',
                'Incomplete conditions',
                'Missing error handling',
                'Missing security constraints',
                'Unclear performance expectations',
              ].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#7c3aed] text-white shadow-xs'
                      : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-border hover:border-border-bright'
                  }`}
                >
                  {cat === 'all' ? 'All Categories' : cat}
                </button>
              ))}
            </div>

            {/* Resolved Status Filter */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-700 p-1 rounded-lg border border-border text-xs">
              {(['unresolved', 'resolved', 'all'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterResolved(f)}
                  className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                    filterResolved === f
                      ? 'bg-[#0ea5e9] text-white shadow-xs'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {f === 'all' ? 'Show All' : f}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content: Split View between Annotated SRS and Detected Issues */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Left Column: Annotated SRS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Annotated SRS Document</h3>
                <span className="text-[11px] text-muted">{lines.length} lines analyzed</span>
              </div>
              <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-4 max-h-[580px] overflow-y-auto space-y-1 font-mono text-xs">
                {lines.map((line, idx) => {
                  const lineIssues = ambiguities.filter(a => a.lineNumber === idx + 1 && !a.resolved);
                  const hasIssue = lineIssues.length > 0;
                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 py-1 px-2 rounded transition-colors ${
                        hasIssue ? 'bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50' : 'hover:bg-slate-50 dark:hover:bg-slate-850'
                      }`}
                    >
                      <span className="text-slate-400 dark:text-slate-500 w-6 shrink-0 text-right select-none">{idx + 1}</span>
                      <span className={`flex-1 break-words ${hasIssue ? 'text-amber-900 dark:text-amber-200 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}>
                        {line || ' '}
                      </span>
                      {hasIssue && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                          {lineIssues[0].severity}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Detected Issues with Side-by-Side Comparison */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                  Quality Issues & Suggested Rewrites ({filteredIssues.length})
                </h3>
              </div>

              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                <AnimatePresence>
                  {filteredIssues.map((issue, i) => {
                    const style = getSeverityStyle(issue.severity);
                    return (
                      <motion.div
                        key={issue.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: i * 0.02 }}
                        className={`${style.bg} border ${style.border} rounded-xl p-4 space-y-3 shadow-xs`}
                      >
                        {/* Top bar */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                              {issue.severity.toUpperCase()}
                            </span>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Line {issue.lineNumber}
                            </span>
                            {issue.category && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-700 border border-border text-muted font-medium">
                                {issue.category}
                              </span>
                            )}
                          </div>
                          {issue.confidenceScore && (
                            <span className="text-[11px] text-muted font-medium">
                              {issue.confidenceScore}% Confidence
                            </span>
                          )}
                        </div>

                        {/* Vague phrase & reason */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-muted font-medium">Detected:</span>
                            <code className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-border font-mono font-bold text-red-600 dark:text-red-400">
                              "{issue.phrase}"
                            </code>
                          </div>
                          <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <HelpCircle className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
                            <span>{issue.reason}</span>
                          </div>
                        </div>

                        {/* Side-by-side original vs rewritten */}
                        {issue.rewrittenRequirement && (
                          <div className="p-3 bg-white dark:bg-slate-800 border border-border rounded-lg space-y-2 text-xs">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-muted uppercase">
                              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                              <span>Proposed Specification Rewrite:</span>
                            </div>
                            <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200 font-medium">
                              {issue.rewrittenRequirement}
                            </div>
                          </div>
                        )}

                        {/* Actions: Accept Suggestion vs Reject */}
                        {!issue.resolved ? (
                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                            <button
                              onClick={() => handleRejectSuggestion(issue.id)}
                              className="px-3 py-1.5 rounded-lg border border-border bg-white dark:bg-slate-700 text-muted hover:text-foreground text-xs font-medium transition-colors"
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={() => handleAcceptSuggestion(issue.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold shadow-xs transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Apply Rewrite to SRS</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-[#16a34a] font-semibold pt-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Resolved</span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
