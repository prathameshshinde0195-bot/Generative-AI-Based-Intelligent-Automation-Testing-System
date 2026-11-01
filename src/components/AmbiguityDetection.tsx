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
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#F0F9FF]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#E0F2FE] bg-white p-5 rounded-2xl shadow-sm border">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white shadow-md shadow-sky-500/10">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2 tracking-tight">
              Requirement Ambiguity Detection
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-[#FAF5FF] text-[#7C3AED] border border-[#EDE9FE]">
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
          {/* Summary KPIs in White, Sky Blue, Purple, and Light Pink */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: 'High Severity', sev: 'high', count: highCount, color: 'text-[#BE185D]', border: 'border-pink-300 hover:border-pink-500', badge: 'bg-[#FDF2F8] text-[#BE185D]' },
              { label: 'Medium Severity', sev: 'medium', count: medCount, color: 'text-amber-600', border: 'border-amber-300 hover:border-amber-500', badge: 'bg-amber-50 text-amber-700' },
              { label: 'Low Severity', sev: 'low', count: lowCount, color: 'text-[#0284C7]', border: 'border-sky-300 hover:border-sky-500', badge: 'bg-sky-50 text-[#0284C7]' },
              { label: 'Resolved', sev: 'all', count: resolvedCount, color: 'text-[#16A34A]', border: 'border-emerald-300 hover:border-emerald-500', badge: 'bg-emerald-50 text-[#16A34A]' },
              { label: 'Total Detected', sev: 'all', count: ambiguities.length, color: 'text-[#7C3AED]', border: 'border-purple-300 hover:border-purple-500', badge: 'bg-purple-50 text-[#7C3AED]' },
            ].map(s => (
              <button
                key={s.label}
                type="button"
                onClick={() => setSelectedSeverity(prev => prev === s.sev ? 'all' : s.sev)}
                className={`bg-white rounded-2xl px-5 py-4 border-2 ${s.border} shadow-sm hover:shadow-md text-left transition-all hover:-translate-y-0.5 cursor-pointer ${
                  selectedSeverity === s.sev && s.sev !== 'all' ? 'ring-2 ring-[#7C3AED]' : ''
                }`}
              >
                <p className={`text-3xl font-black ${s.color} tracking-tight`}>{s.count}</p>
                <p className="text-xs text-[#0F172A] uppercase tracking-wider font-black mt-1">{s.label}</p>
              </button>
            ))}
          </motion.div>

          {/* Filters Bar: Categories & Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border-2 border-slate-200 rounded-2xl shadow-xs">
            {/* Category Filter */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-black text-[#0F172A] text-xs uppercase mr-1">Category:</span>
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-xs'
                      : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-[#8B5CF6]'
                  }`}
                >
                  {cat === 'all' ? 'All Categories' : cat}
                </button>
              ))}
            </div>

            {/* Resolved Status Filter */}
            <div className="flex items-center gap-1 bg-[#F0F9FF] p-1 rounded-xl border border-sky-200 text-xs">
              {(['unresolved', 'resolved', 'all'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterResolved(f)}
                  className={`px-3 py-1.5 rounded-lg capitalize font-bold transition-colors cursor-pointer ${
                    filterResolved === f
                      ? 'bg-[#0EA5E9] text-white shadow-xs'
                      : 'text-slate-600 hover:text-[#0F172A]'
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
            <div className="bg-white border-2 border-sky-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                <h3 className="text-sm font-black text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0EA5E9]" />
                  Annotated SRS Document
                </h3>
                <span className="text-xs font-bold text-[#0284C7] bg-[#F0F9FF] px-2.5 py-0.5 rounded-full border border-sky-200">{lines.length} lines analyzed</span>
              </div>
              <div className="bg-[#F8FCFF] border border-[#E0F2FE] rounded-xl p-4 max-h-[580px] overflow-y-auto space-y-1 font-mono text-xs">
                {lines.map((line, idx) => {
                  const lineIssues = ambiguities.filter(a => a.lineNumber === idx + 1 && !a.resolved);
                  const hasIssue = lineIssues.length > 0;
                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 py-1 px-2 rounded-lg transition-colors ${
                        hasIssue ? 'bg-[#FDF2F8] border border-[#FCE7F3]' : 'hover:bg-white'
                      }`}
                    >
                      <span className="text-slate-400 w-6 shrink-0 text-right select-none font-bold">{idx + 1}</span>
                      <span className={`flex-1 break-words ${hasIssue ? 'text-[#BE185D] font-bold' : 'text-slate-800'}`}>
                        {line || ' '}
                      </span>
                      {hasIssue && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase shrink-0 bg-[#BE185D] text-white shadow-xs">
                          {lineIssues[0].severity}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Detected Issues with Side-by-Side Comparison */}
            <div className="bg-white border-2 border-purple-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <h3 className="text-sm font-black text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
                  Quality Issues & Suggested Rewrites ({filteredIssues.length})
                </h3>
              </div>

              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                <AnimatePresence>
                  {filteredIssues.map((issue, i) => {
                    return (
                      <motion.div
                        key={issue.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: i * 0.02 }}
                        className="bg-white border-2 border-slate-200 hover:border-[#8B5CF6] rounded-2xl p-4.5 space-y-3 shadow-sm hover:shadow-md transition-all"
                      >
                        {/* Top bar */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                              issue.severity === 'high' ? 'bg-[#FDF2F8] text-[#BE185D] border border-[#FCE7F3]' :
                              issue.severity === 'medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-sky-50 text-[#0284C7] border border-sky-200'
                            }`}>
                              {issue.severity.toUpperCase()}
                            </span>
                            <span className="text-xs font-black text-[#0F172A]">
                              Line {issue.lineNumber}
                            </span>
                            {issue.category && (
                              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#F0F9FF] border border-sky-200 text-[#0284C7] font-bold">
                                {issue.category}
                              </span>
                            )}
                          </div>
                          {issue.confidenceScore && (
                            <span className="text-xs font-bold text-[#8B5CF6] bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                              {issue.confidenceScore}% Confidence
                            </span>
                          )}
                        </div>

                        {/* Vague phrase & reason */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-[#64748B] font-bold">Detected:</span>
                            <code className="px-2 py-0.5 rounded-md bg-[#FDF2F8] border border-[#FCE7F3] font-mono font-black text-sm text-[#BE185D]">
                              "{issue.phrase}"
                            </code>
                          </div>
                          <div className="flex items-start gap-2 text-xs text-slate-700 font-semibold leading-relaxed">
                            <HelpCircle className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
                            <span>{issue.reason}</span>
                          </div>
                        </div>

                        {/* Side-by-side original vs rewritten */}
                        {issue.rewrittenRequirement && (
                          <div className="p-3.5 bg-[#F8FCFF] border-2 border-sky-200 rounded-xl space-y-2 text-xs">
                            <div className="flex items-center gap-1 text-xs font-black text-[#0284C7] uppercase">
                              <Lightbulb className="w-4 h-4 text-amber-500" />
                              <span>Proposed Specification Rewrite:</span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[#166534] font-bold text-xs leading-relaxed">
                              {issue.rewrittenRequirement}
                            </div>
                          </div>
                        )}

                        {/* Actions: Accept Suggestion vs Reject */}
                        {!issue.resolved ? (
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => handleRejectSuggestion(issue.id)}
                              className="px-3 py-1.5 rounded-lg border-2 border-slate-200 bg-white text-slate-700 hover:text-[#0F172A] text-xs font-bold transition-colors cursor-pointer"
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={() => handleAcceptSuggestion(issue.id)}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:opacity-95 text-white text-xs font-black shadow-sm transition-all cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Apply Rewrite to SRS</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-[#16A34A] font-black pt-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Resolved & Synchronized with SRS</span>
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
