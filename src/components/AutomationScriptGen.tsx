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
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#F0F9FF]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#E0F2FE] bg-white p-5 rounded-2xl shadow-sm border">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white shadow-md shadow-sky-500/10">
            <Code2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2 tracking-tight">
              Multi-Framework Automation Script Generator
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-[#FDF2F8] text-[#BE185D] border border-[#FCE7F3]">
                Production Codegen
              </span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5 font-medium">Generate executable test scripts in Playwright, Cypress, and Selenium with assertions and setup</p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-2">
          {selectedTc && (
            <>
              <button
                onClick={handleOpenDataGenerator}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-50 border-2 border-sky-200 text-[#0284C7] text-xs font-black hover:bg-sky-100 transition-colors cursor-pointer"
                title="Generate synthetic test data for this test case"
              >
                <FlaskConical className="w-4 h-4 text-[#0EA5E9]" />
                <span>Test Data Generator</span>
              </button>

              <button
                onClick={handleSendToLiveRunner}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] hover:opacity-95 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Send to Live Runner</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      {allCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border-2 border-dashed border-sky-200 rounded-2xl shadow-sm">
          <Code2 className="w-16 h-16 text-sky-300 mb-3" />
          <h3 className="text-base font-black text-[#0F172A]">No Test Cases Available</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md text-center font-medium">
            Generate test cases in the SRS Input module first to generate runnable automation scripts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left Column: Framework & TC Selection */}
          <div className="space-y-4">
            {/* Framework Select */}
            <div className="space-y-2">
              <label className="text-xs font-black text-[#0F172A] uppercase tracking-wider block">Target Automation Framework</label>
              <div className="grid grid-cols-2 gap-3">
                {frameworks.map((fw) => {
                  const isSelected = selectedFramework === fw.id;
                  return (
                    <button
                      key={fw.id}
                      onClick={() => setSelectedFramework(fw.id)}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#0EA5E9] bg-[#F0F9FF] shadow-sm'
                          : 'border-slate-200 bg-white hover:border-[#8B5CF6]'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ background: fw.color }} />
                      <div>
                        <p className={`text-xs font-black ${isSelected ? 'text-[#0284C7]' : 'text-[#0F172A]'}`}>{fw.label}</p>
                        <p className="text-[11px] text-slate-500 font-bold">{fw.lang} Architecture</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Test Case Select */}
            <div className="space-y-2">
              <label className="text-xs font-black text-[#0F172A] uppercase tracking-wider block">Select Test Case</label>
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full flex items-center justify-between p-3.5 bg-white border-2 border-slate-200 hover:border-[#8B5CF6] rounded-2xl text-xs text-[#0F172A] transition-colors shadow-xs cursor-pointer"
                >
                  <span className={selectedTestCase ? 'font-bold text-[#0F172A]' : 'text-slate-400'}>
                    {selectedTc
                      ? `${selectedTc.testCaseId}: ${selectedTc.title || selectedTc.scenario}`
                      : 'Choose a test case...'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>
                {showDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl shadow-xl max-h-[280px] overflow-y-auto divide-y divide-slate-100">
                    {allCases.map((tc) => (
                      <button
                        key={tc.id || tc.testCaseId}
                        onClick={() => { setSelectedTestCase(tc.testCaseId); setShowDropdown(false); }}
                        className="w-full text-left px-4 py-3 text-xs hover:bg-[#F0F9FF] transition-colors flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-[#7C3AED] font-black mr-2">{tc.testCaseId}</span>
                          <span className="text-[#0F172A] font-bold truncate">{tc.title || tc.scenario}</span>
                        </div>
                        <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-sky-50 text-[#0284C7] border border-sky-200 shrink-0">
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
              <div className="bg-white border-2 border-purple-200 rounded-2xl p-5 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-purple-100 pb-2.5">
                  <h4 className="text-xs font-black text-[#0F172A] flex items-center gap-1.5 uppercase tracking-wide">
                    <span className="font-mono text-[#7C3AED] bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">{selectedTc.testCaseId}</span>
                    <span>Specification Context</span>
                  </h4>
                  {generating && <Loader2 className="w-4 h-4 animate-spin text-[#7C3AED]" />}
                </div>

                <div>
                  <p className="text-[11px] uppercase font-black text-[#64748B] mb-1">Scenario</p>
                  <p className="text-xs text-[#0F172A] font-black">{selectedTc.title || selectedTc.scenario}</p>
                </div>

                <div>
                  <p className="text-[11px] uppercase font-black text-[#64748B] mb-1">Preconditions</p>
                  <p className="text-xs text-[#0F172A] font-bold">{normalizePreconditions(selectedTc.preconditions) || 'None'}</p>
                </div>

                <div>
                  <p className="text-[11px] uppercase font-black text-[#0F172A] mb-1.5">Execution Steps</p>
                  <ol className="space-y-1 list-decimal list-inside text-xs text-[#0F172A] font-medium bg-[#F8FCFF] p-3 rounded-xl border border-sky-100">
                    {selectedTc.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>

                <div>
                  <p className="text-[11px] uppercase font-black text-[#16A34A] mb-1">Expected Result</p>
                  <p className="text-xs text-[#16A34A] font-black">{selectedTc.expectedResults}</p>
                </div>

                {selectedTc.testData && (
                  <div>
                    <p className="text-[11px] uppercase font-black text-[#0284C7] mb-1">Test Data Embedded</p>
                    <code className="text-xs font-mono font-black text-[#0284C7] bg-[#E0F2FE] px-2.5 py-1 rounded-lg border border-sky-200 inline-block">
                      {selectedTc.testData}
                    </code>
                  </div>
                )}
              </div>
            )}

            {/* Run Hints */}
            {generatedScript?.runHints && (
              <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 space-y-2.5 shadow-sm">
                <p className="text-xs font-black text-[#16A34A] uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-[#16A34A]" />
                  <span>Execution Terminal Instructions</span>
                </p>
                {generatedScript.runHints.map((h, i) => (
                  <code key={i} className="block text-xs text-[#16A34A] font-mono font-black bg-[#F0FDF4] px-3 py-2 rounded-xl border border-emerald-200">
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
                <label className="text-xs font-black text-[#0F172A] uppercase tracking-wider">
                  Generated Script {generatedScript?.fileName ? `• ${generatedScript.fileName}` : ''}
                </label>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black border ${
                  source === 'ai' ? 'bg-[#FAF5FF] text-[#7C3AED] border-purple-200' : 'bg-[#E0F2FE] text-[#0284C7] border-sky-200'
                }`}>
                  {source === 'ai' ? 'AI Grounded' : 'Engine Template'}
                </span>
              </div>
              {generatedScript && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center gap-1 text-xs text-[#7C3AED] font-black hover:underline cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditing ? 'View Mode' : 'Edit Code'}</span>
                  </button>
                  <button type="button" onClick={handleDownload} className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0F172A] transition-colors font-black cursor-pointer">
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                  <button type="button" onClick={handleCopy} className="flex items-center gap-1 text-xs text-[#7C3AED] font-black hover:text-[#6D28D9] transition-colors cursor-pointer">
                    {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Code</>}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white text-[#0F172A] border-2 border-purple-200 rounded-2xl overflow-hidden min-h-[460px] shadow-sm">
              {generating && !generatedScript ? (
                <div className="flex items-center justify-center py-36 gap-2 text-muted">
                  <Loader2 className="w-5 h-5 animate-spin text-[#7C3AED]" />
                  <span className="text-xs font-bold text-[#64748B]">Synthesizing runnable automation code...</span>
                </div>
              ) : generatedScript ? (
                <div>
                  <div className="flex items-center justify-between px-4 py-3 bg-[#F8FCFF] border-b-2 border-purple-100 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: frameworks.find((f) => f.id === generatedScript.framework)?.color }} />
                      <span className="text-[11px] text-[#0F172A] font-mono font-black">{generatedScript.language} • {generatedScript.framework}</span>
                    </div>
                    {isEditing ? (
                      <span className="text-[10px] text-[#BE185D] font-black uppercase bg-[#FDF2F8] px-2.5 py-0.5 rounded-full border border-pink-200">Editing Enabled</span>
                    ) : (
                      <span className="text-[10px] text-[#64748B] font-bold bg-slate-100 px-2.5 py-0.5 rounded-full">Read-Only</span>
                    )}
                  </div>

                  {isEditing ? (
                    <textarea
                      value={editedCode}
                      onChange={(e) => setEditedCode(e.target.value)}
                      className="w-full h-[520px] p-4 text-xs font-mono bg-white text-[#0F172A] font-bold resize-none outline-none leading-relaxed selection:bg-purple-100"
                      spellCheck={false}
                    />
                  ) : (
                    <pre className="p-4 text-xs font-mono text-[#0F172A] font-semibold overflow-auto max-h-[520px] leading-relaxed bg-white selection:bg-purple-100">
                      <code>{editedCode || generatedScript.code}</code>
                    </pre>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-36 text-center">
                  <div>
                    <Code2 className="w-10 h-10 text-purple-300 mx-auto mb-2" />
                    <p className="text-xs text-[#64748B] font-bold">Select a test case to generate framework code</p>
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
