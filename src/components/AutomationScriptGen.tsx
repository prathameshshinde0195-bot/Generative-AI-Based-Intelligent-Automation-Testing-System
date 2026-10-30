import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Code2, Copy, Check, ChevronDown, Download, Loader2, Terminal, Play, Edit3, FlaskConical } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { generateExecutableAutomationScript } from '../lib/automation-codegen';
import { aiAPI } from '../lib/api';
import type { AutomationFramework, GeneratedScript, TestCase } from '../lib/types';
import { toast } from 'sonner';

const frameworks: { id: AutomationFramework; label: string; lang: string; color: string }[] = [
  { id: 'playwright', label: 'Playwright (TS)', lang: 'TypeScript', color: '#7c3aed' },
  { id: 'cypress', label: 'Cypress (JS)', lang: 'JavaScript', color: '#0ea5e9' },
  { id: 'selenium-python', label: 'Selenium (Python)', lang: 'Python', color: '#16a34a' },
  { id: 'selenium-java', label: 'Selenium (Java)', lang: 'Java', color: '#f59e0b' },
];

function normalizePreconditions(preconditions: TestCase['preconditions'] | string[] | string): string {
  if (Array.isArray(preconditions)) return preconditions.join('. ');
  return String(preconditions || '');
}

export default function AutomationScriptGen() {
  const { testCases, negativeTestCases, setActiveFeature, setSelectedTestCaseForDataGen } = useAppStore();
  const allCases = useMemo(() => [...testCases, ...negativeTestCases], [testCases, negativeTestCases]);
  const [selectedFramework, setSelectedFramework] = useState<AutomationFramework>('playwright');
  const [selectedTestCase, setSelectedTestCase] = useState<string>('');
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [source, setSource] = useState<'local' | 'ai'>('local');
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState('');

  const selectedTc = useMemo(
    () => allCases.find((c) => c.testCaseId === selectedTestCase) || null,
    [allCases, selectedTestCase]
  );

  // Auto-select first test case if available
  useEffect(() => {
    if (allCases.length > 0 && !selectedTestCase) {
      setSelectedTestCase(allCases[0].testCaseId);
    }
  }, [allCases, selectedTestCase]);

  // Regenerate whenever framework or TC changes
  useEffect(() => {
    if (!selectedTc) {
      setGeneratedScript(null);
      setEditedCode('');
      return;
    }

    let cancelled = false;
    const run = async () => {
      setGenerating(true);
      try {
        let script: GeneratedScript | null = null;
        try {
          const res = await aiAPI.generateAutomationScript({
            framework: selectedFramework,
            testCase: {
              testCaseId: selectedTc.testCaseId,
              scenario: selectedTc.scenario,
              preconditions: typeof selectedTc.preconditions === 'string'
                ? [selectedTc.preconditions]
                : selectedTc.preconditions,
              steps: selectedTc.steps,
              expectedResults: selectedTc.expectedResults,
              priority: selectedTc.priority,
              category: selectedTc.category,
              testData: selectedTc.testData,
            },
          }) as { data?: { code?: string; language?: string; framework?: string } };

          if (res?.data?.code && res.data.code.length > 40) {
            script = {
              framework: selectedFramework,
              testCaseId: selectedTc.testCaseId,
              code: res.data.code,
              language: res.data.language || frameworks.find((f) => f.id === selectedFramework)?.lang.toLowerCase() || 'typescript',
              fileName: generateExecutableAutomationScript(selectedTc, selectedFramework).fileName,
              runHints: generateExecutableAutomationScript(selectedTc, selectedFramework).runHints,
            };
            if (!cancelled) setSource('ai');
          }
        } catch {
          // fallback to local codegen
        }

        if (!script) {
          script = generateExecutableAutomationScript(selectedTc, selectedFramework);
          if (!cancelled) setSource('local');
        }

        if (!cancelled && script) {
          setGeneratedScript(script);
          setEditedCode(script.code);
        }
      } finally {
        if (!cancelled) setGenerating(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [selectedFramework, selectedTc]);

  const handleCopy = async () => {
    const codeToCopy = isEditing ? editedCode : (generatedScript?.code || '');
    if (!codeToCopy) return;
    await navigator.clipboard.writeText(codeToCopy);
    setCopied(true);
    toast.success('Script copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const codeToDownload = isEditing ? editedCode : (generatedScript?.code || '');
    if (!codeToDownload || !generatedScript) return;
    const blob = new Blob([codeToDownload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generatedScript.fileName || `${selectedTestCase}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${generatedScript.fileName}`);
  };

  const handleSendToLiveRunner = () => {
    if (!selectedTc) return;
    toast.success(`Navigating to Live Runner for ${selectedTc.testCaseId}`);
    setActiveFeature('test-runs');
  };

  const handleOpenDataGenerator = () => {
    if (!selectedTc) return;
    setSelectedTestCaseForDataGen(selectedTc);
    setActiveFeature('test-data');
    toast.info(`Opening Test Data Generator with context for ${selectedTc.testCaseId}`);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-white dark:bg-slate-900">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-[#7c3aed]">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              Multi-Framework Automation Script Generator
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-50 text-[#7c3aed] dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200">
                Production Codegen
              </span>
            </h2>
            <p className="text-xs text-muted">Generate executable test scripts in Playwright, Cypress, and Selenium with assertions and setup</p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-2">
          {selectedTc && (
            <>
              <button
                onClick={handleOpenDataGenerator}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 text-[#0ea5e9] text-xs font-semibold hover:bg-sky-100 transition-colors"
                title="Generate synthetic test data for this test case"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Test Data Generator</span>
              </button>

              <button
                onClick={handleSendToLiveRunner}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-[#16a34a] text-xs font-semibold hover:bg-emerald-100 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Send to Live Runner</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      {allCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-border rounded-2xl">
          <Code2 className="w-16 h-16 text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-foreground">No Test Cases Available</h3>
          <p className="text-xs text-muted mt-1 max-w-md text-center">
            Generate test cases in the SRS Input module first to generate runnable automation scripts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left Column: Framework & TC Selection */}
          <div className="space-y-4">
            {/* Framework Select */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block">Target Automation Framework</label>
              <div className="grid grid-cols-2 gap-2.5">
                {frameworks.map((fw) => {
                  const isSelected = selectedFramework === fw.id;
                  return (
                    <button
                      key={fw.id}
                      onClick={() => setSelectedFramework(fw.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-[#7c3aed] bg-purple-50/70 dark:bg-purple-950/30 shadow-xs'
                          : 'border-border bg-white dark:bg-slate-800 hover:border-border-bright'
                      }`}
                    >
                      <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: fw.color }} />
                      <div>
                        <p className={`text-xs font-bold ${isSelected ? 'text-[#7c3aed]' : 'text-foreground'}`}>{fw.label}</p>
                        <p className="text-[10px] text-muted">{fw.lang} Architecture</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Test Case Select */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block">Select Test Case</label>
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-border rounded-xl text-xs text-foreground hover:border-[#7c3aed] transition-colors shadow-xs"
                >
                  <span className={selectedTestCase ? 'font-medium text-foreground' : 'text-muted'}>
                    {selectedTc
                      ? `${selectedTc.testCaseId}: ${selectedTc.title || selectedTc.scenario}`
                      : 'Choose a test case...'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted" />
                </button>
                {showDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-border rounded-xl shadow-xl max-h-[280px] overflow-y-auto divide-y divide-border/40">
                    {allCases.map((tc) => (
                      <button
                        key={tc.id || tc.testCaseId}
                        onClick={() => { setSelectedTestCase(tc.testCaseId); setShowDropdown(false); }}
                        className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-[#7c3aed] font-bold mr-2">{tc.testCaseId}</span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{tc.title || tc.scenario}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-muted shrink-0">
                          {tc.category}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Test Case Inspection */}
            {selectedTc && (
              <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span className="font-mono text-[#7c3aed]">{selectedTc.testCaseId}</span>
                    <span>Specification Context</span>
                  </h4>
                  {generating && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7c3aed]" />}
                </div>

                <div>
                  <p className="text-[10px] uppercase font-bold text-muted mb-0.5">Scenario</p>
                  <p className="text-xs text-foreground font-semibold">{selectedTc.title || selectedTc.scenario}</p>
                </div>

                <div>
                  <p className="text-[10px] uppercase font-bold text-muted mb-0.5">Preconditions</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{normalizePreconditions(selectedTc.preconditions) || 'None'}</p>
                </div>

                <div>
                  <p className="text-[10px] uppercase font-bold text-muted mb-1">Execution Steps</p>
                  <ol className="space-y-1 list-decimal list-inside text-xs text-slate-700 dark:text-slate-300">
                    {selectedTc.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>

                <div>
                  <p className="text-[10px] uppercase font-bold text-muted mb-0.5">Expected Result</p>
                  <p className="text-xs text-[#16a34a] font-medium">{selectedTc.expectedResults}</p>
                </div>

                {selectedTc.testData && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted mb-0.5">Test Data Embedded</p>
                    <code className="text-xs font-mono text-[#0ea5e9] bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 rounded border border-sky-200">
                      {selectedTc.testData}
                    </code>
                  </div>
                )}
              </div>
            )}

            {/* Run Hints */}
            {generatedScript?.runHints && (
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-border rounded-xl p-3.5 space-y-2">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[#16a34a]" />
                  <span>Execution Terminal Instructions</span>
                </p>
                {generatedScript.runHints.map((h, i) => (
                  <code key={i} className="block text-xs text-[#16a34a] font-mono bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded border border-border">
                    {h}
                  </code>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Code Editor / Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">
                  Generated Script {generatedScript?.fileName ? `• ${generatedScript.fileName}` : ''}
                </label>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  source === 'ai' ? 'bg-purple-100 dark:bg-purple-950/40 text-[#7c3aed]' : 'bg-sky-100 dark:bg-sky-950/40 text-[#0ea5e9]'
                }`}>
                  {source === 'ai' ? 'AI Grounded' : 'Engine Template'}
                </span>
              </div>
              {generatedScript && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center gap-1 text-xs text-[#7c3aed] font-semibold hover:underline"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditing ? 'View Mode' : 'Edit Code'}</span>
                  </button>
                  <button onClick={handleDownload} className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors font-medium">
                    <Download className="w-3 h-3" /> Download
                  </button>
                  <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-[#7c3aed] font-semibold hover:text-[#6d28d9] transition-colors">
                    {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Code</>}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-[#0f172a] text-slate-100 border border-border rounded-xl overflow-hidden min-h-[460px] shadow-sm">
              {generating && !generatedScript ? (
                <div className="flex items-center justify-center py-36 gap-2 text-muted">
                  <Loader2 className="w-5 h-5 animate-spin text-[#7c3aed]" />
                  <span className="text-xs text-slate-300">Synthesizing runnable automation code...</span>
                </div>
              ) : generatedScript ? (
                <div>
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#1e293b] border-b border-slate-700 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: frameworks.find((f) => f.id === generatedScript.framework)?.color }} />
                      <span className="text-[11px] text-slate-300 font-mono">{generatedScript.language} • {generatedScript.framework}</span>
                    </div>
                    {isEditing ? (
                      <span className="text-[10px] text-amber-400 font-bold uppercase">Editing Enabled</span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Read-Only</span>
                    )}
                  </div>

                  {isEditing ? (
                    <textarea
                      value={editedCode}
                      onChange={(e) => setEditedCode(e.target.value)}
                      className="w-full h-[520px] p-4 text-xs font-mono bg-[#0f172a] text-slate-100 resize-none outline-none leading-relaxed"
                      spellCheck={false}
                    />
                  ) : (
                    <pre className="p-4 text-xs font-mono text-slate-200 overflow-auto max-h-[520px] leading-relaxed">
                      <code>{editedCode || generatedScript.code}</code>
                    </pre>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-36 text-center">
                  <div>
                    <Code2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Select a test case to generate framework code</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
