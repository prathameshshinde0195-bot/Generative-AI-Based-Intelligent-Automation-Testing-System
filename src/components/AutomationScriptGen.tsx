import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Code2, Copy, Check, ChevronDown, Download, Loader2, Terminal,
  Play, Edit3, FlaskConical, Sparkles, RotateCcw, Filter, CheckCircle2
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { generateExecutableAutomationScript } from '../lib/automation-codegen';
import { BUILTIN_REQUIREMENT_TEST_CASES } from '../lib/demo-test-cases';
import { aiAPI } from '../lib/api';
import type { AutomationFramework, GeneratedScript, TestCase } from '../lib/types';
import { toast } from 'sonner';

const frameworks: { id: AutomationFramework; label: string; lang: string; color: string; desc: string }[] = [
  { id: 'playwright', label: 'Playwright (TS)', lang: 'TypeScript', color: '#7c3aed', desc: 'TypeScript Architecture' },
  { id: 'cypress', label: 'Cypress (JS)', lang: 'JavaScript', color: '#0ea5e9', desc: 'JavaScript Architecture' },
  { id: 'selenium-python', label: 'Selenium (Python)', lang: 'Python', color: '#16a34a', desc: 'Python Architecture' },
  { id: 'selenium-java', label: 'Selenium (Java)', lang: 'Java', color: '#f59e0b', desc: 'Java Architecture' },
];

function normalizePreconditions(preconditions: TestCase['preconditions'] | string[] | string): string {
  if (Array.isArray(preconditions)) return preconditions.join('. ');
  return String(preconditions || '');
}

export default function AutomationScriptGen() {
  const { testCases, negativeTestCases, setActiveFeature, setSelectedTestCaseForDataGen } = useAppStore();
  const storeCases = useMemo(() => [...testCases, ...negativeTestCases], [testCases, negativeTestCases]);

  // Combine store test cases with built-in requirement test suite (REQ-001 to REQ-006)
  const allCases = useMemo(() => {
    if (storeCases.length === 0) return BUILTIN_REQUIREMENT_TEST_CASES;
    const storeIds = new Set(storeCases.map((c) => c.testCaseId));
    const supplementalDemo = BUILTIN_REQUIREMENT_TEST_CASES.filter((c) => !storeIds.has(c.testCaseId));
    return [...storeCases, ...supplementalDemo];
  }, [storeCases]);

  // Extract unique requirements for quick requirement-level switching
  const requirements = useMemo(() => {
    const map = new Map<string, { id: string; title: string; count: number }>();
    for (const tc of allCases) {
      const reqId = tc.requirementId || 'REQ-GENERAL';
      const existing = map.get(reqId);
      if (existing) {
        existing.count++;
      } else {
        map.set(reqId, {
          id: reqId,
          title: tc.requirementDescription || tc.title || `Requirement ${reqId}`,
          count: 1,
        });
      }
    }
    return Array.from(map.values());
  }, [allCases]);

  const [selectedRequirement, setSelectedRequirement] = useState<string>('ALL');
  const [selectedFramework, setSelectedFramework] = useState<AutomationFramework>('playwright');
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<string>(allCases[0]?.testCaseId || '');
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [source, setSource] = useState<'local' | 'ai'>('local');
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState('');

  // Filter test cases by selected requirement
  const filteredCases = useMemo(() => {
    if (selectedRequirement === 'ALL') return allCases;
    return allCases.filter((tc) => (tc.requirementId || 'REQ-GENERAL') === selectedRequirement);
  }, [allCases, selectedRequirement]);

  // Active test case resolution
  const selectedTc: TestCase | null = useMemo(() => {
    return filteredCases.find((c) => c.testCaseId === selectedTestCaseId) || filteredCases[0] || allCases[0] || null;
  }, [filteredCases, selectedTestCaseId, allCases]);

  // Core synchronous code generator - executes instantly with 0ms delay
  const generateScriptSync = (tc: TestCase | null, framework: AutomationFramework) => {
    if (!tc) {
      setGeneratedScript(null);
      setEditedCode('');
      return;
    }
    const script = generateExecutableAutomationScript(tc, framework);
    setGeneratedScript(script);
    setEditedCode(script.code);
    setIsEditing(false);
    setSource('local');
  };

  // Keep code synced whenever framework or selected TC changes
  useEffect(() => {
    if (selectedTc) {
      if (selectedTestCaseId !== selectedTc.testCaseId) {
        setSelectedTestCaseId(selectedTc.testCaseId);
      }
      generateScriptSync(selectedTc, selectedFramework);
    }
  }, [selectedFramework, selectedTc?.testCaseId]);

  // Framework selection handler with instant code update
  const handleSelectFramework = (fw: AutomationFramework) => {
    setSelectedFramework(fw);
    if (selectedTc) {
      generateScriptSync(selectedTc, fw);
      const fwName = frameworks.find((f) => f.id === fw)?.label || fw;
      toast.success(`Generated ${fwName} automation code`);
    }
  };

  // Test case selection handler with instant code update
  const handleSelectTestCase = (tcId: string) => {
    setSelectedTestCaseId(tcId);
    setShowDropdown(false);
    const target = allCases.find((c) => c.testCaseId === tcId);
    if (target) {
      generateScriptSync(target, selectedFramework);
      toast.info(`Loaded test case ${target.testCaseId}`);
    }
  };

  // Requirement filter change handler
  const handleSelectRequirement = (reqId: string) => {
    setSelectedRequirement(reqId);
    const matchingCases = reqId === 'ALL'
      ? allCases
      : allCases.filter((tc) => (tc.requirementId || 'REQ-GENERAL') === reqId);
    if (matchingCases.length > 0) {
      const first = matchingCases[0];
      setSelectedTestCaseId(first.testCaseId);
      generateScriptSync(first, selectedFramework);
    }
  };

  // Reset edited code back to pristine generated version
  const handleResetCode = () => {
    if (selectedTc) {
      generateScriptSync(selectedTc, selectedFramework);
      toast.info('Reset code to engine generated version');
    }
  };

  // Cloud AI Deep Optimization (optional / on-demand)
  const handleAiDeepOptimize = async () => {
    if (!selectedTc) return;
    setGeneratingAi(true);
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
        const fwObj = frameworks.find((f) => f.id === selectedFramework);
        const enhanced: GeneratedScript = {
          framework: selectedFramework,
          testCaseId: selectedTc.testCaseId,
          code: res.data.code,
          language: res.data.language || fwObj?.lang.toLowerCase() || 'typescript',
          fileName: generateExecutableAutomationScript(selectedTc, selectedFramework).fileName,
          runHints: generateExecutableAutomationScript(selectedTc, selectedFramework).runHints,
        };
        setGeneratedScript(enhanced);
        setEditedCode(enhanced.code);
        setSource('ai');
        toast.success(`AI synthesized deep ${selectedFramework.toUpperCase()} script!`);
      } else {
        toast.info('AI engine returned standard script template.');
      }
    } catch {
      toast.info('Cloud AI offline — current script generated using local engine');
    } finally {
      setGeneratingAi(false);
    }
  };

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
    a.download = generatedScript.fileName || `${selectedTestCaseId}.txt`;
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
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#E0F2FE] bg-white p-5 rounded-2xl shadow-sm border-2 border-slate-200"
      >
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
            <p className="text-xs text-[#64748B] mt-0.5 font-medium">
              Generate executable test scripts in Playwright, Cypress, and Selenium with assertions and setup
            </p>
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

      {/* Requirement Filter Tabs */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-3 shadow-xs">
        <div className="flex items-center gap-2 mb-2 px-1">
          <Filter className="w-3.5 h-3.5 text-[#0EA5E9]" />
          <span className="text-xs font-black text-[#0F172A] uppercase tracking-wider">
            Filter by Requirement ({requirements.length} Requirements Available)
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => handleSelectRequirement('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer border-2 ${
              selectedRequirement === 'ALL'
                ? 'bg-[#0EA5E9] text-white border-[#0284C7] shadow-xs'
                : 'bg-white text-[#475569] border-slate-200 hover:border-[#0EA5E9]'
            }`}
          >
            All Requirements ({allCases.length})
          </button>
          {requirements.map((req) => {
            const isSelected = selectedRequirement === req.id;
            return (
              <button
                key={req.id}
                onClick={() => handleSelectRequirement(req.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer border-2 ${
                  isSelected
                    ? 'bg-[#7C3AED] text-white border-[#6D28D9] shadow-xs'
                    : 'bg-white text-[#475569] border-slate-200 hover:border-[#7C3AED]'
                }`}
              >
                <span className={isSelected ? 'text-purple-200' : 'text-[#7C3AED]'}>{req.id}</span>
                <span className="text-[10px] opacity-80">({req.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column: Target Framework & TestCase Selection */}
        <div className="space-y-4">
          {/* Target Automation Framework Selection */}
          <div className="space-y-2">
            <label className="text-xs font-black text-[#0F172A] uppercase tracking-wider block">
              Target Automation Framework
            </label>
            <div className="grid grid-cols-2 gap-3">
              {frameworks.map((fw) => {
                const isSelected = selectedFramework === fw.id;
                return (
                  <button
                    key={fw.id}
                    onClick={() => handleSelectFramework(fw.id)}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#0EA5E9] bg-[#F0F9FF] shadow-sm ring-2 ring-sky-300/40'
                        : 'border-slate-200 bg-white hover:border-[#8B5CF6]'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ background: fw.color }} />
                    <div className="min-w-0">
                      <p className={`text-xs font-black ${isSelected ? 'text-[#0284C7]' : 'text-[#0F172A]'}`}>
                        {fw.label}
                      </p>
                      <p className="text-[11px] text-slate-500 font-bold truncate">{fw.desc}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-[#0EA5E9] ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Test Case Select */}
          <div className="space-y-2">
            <label className="text-xs font-black text-[#0F172A] uppercase tracking-wider block">
              Select Test Case
            </label>
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full flex items-center justify-between p-3.5 bg-white border-2 border-slate-200 hover:border-[#8B5CF6] rounded-2xl text-xs text-[#0F172A] transition-colors shadow-xs cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  {selectedTc ? (
                    <>
                      <span className="font-mono text-[#7C3AED] font-black bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 shrink-0">
                        {selectedTc.testCaseId}
                      </span>
                      <span className="font-bold text-[#0F172A] truncate">
                        {selectedTc.title || selectedTc.scenario}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-400">Choose a test case...</span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
              </button>
              {showDropdown && (
                <div className="absolute z-20 w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl shadow-xl max-h-[320px] overflow-y-auto divide-y divide-slate-100">
                  {filteredCases.map((tc) => (
                    <button
                      key={tc.id || tc.testCaseId}
                      onClick={() => handleSelectTestCase(tc.testCaseId)}
                      className={`w-full text-left px-4 py-3 text-xs hover:bg-[#F0F9FF] transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                        tc.testCaseId === selectedTestCaseId ? 'bg-sky-50/80 font-black' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-[#7C3AED] font-black mr-2">{tc.testCaseId}</span>
                        <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded mr-2 border border-sky-200">
                          {tc.requirementId || 'REQ'}
                        </span>
                        <span className="text-[#0F172A] font-bold truncate">{tc.title || tc.scenario}</span>
                      </div>
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-slate-100 text-[#475569] border border-slate-200 shrink-0">
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
                <h4 className="text-xs font-black text-[#0F172A] flex items-center gap-2 uppercase tracking-wide">
                  <span className="font-mono text-[#7C3AED] bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                    {selectedTc.testCaseId}
                  </span>
                  <span className="font-mono text-[#0284C7] bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-200">
                    {selectedTc.requirementId || 'REQ-GENERAL'}
                  </span>
                  <span>Specification Context</span>
                </h4>
                <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {selectedTc.priority} Priority
                </span>
              </div>

              <div>
                <p className="text-[11px] uppercase font-black text-[#64748B] mb-1">Scenario</p>
                <p className="text-xs text-[#0F172A] font-black">{selectedTc.title || selectedTc.scenario}</p>
              </div>

              {selectedTc.requirementDescription && (
                <div>
                  <p className="text-[11px] uppercase font-black text-[#64748B] mb-1">Requirement Statement</p>
                  <p className="text-xs text-[#334155] font-medium bg-slate-50 p-2 rounded-lg border border-slate-200">
                    {selectedTc.requirementDescription}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[11px] uppercase font-black text-[#64748B] mb-1">Preconditions</p>
                <p className="text-xs text-[#0F172A] font-bold">{normalizePreconditions(selectedTc.preconditions) || 'None'}</p>
              </div>

              <div>
                <p className="text-[11px] uppercase font-black text-[#0F172A] mb-1.5">
                  Execution Steps ({selectedTc.steps.length})
                </p>
                <ol className="space-y-1 list-decimal list-inside text-xs text-[#0F172A] font-medium bg-[#F8FCFF] p-3 rounded-xl border border-sky-100">
                  {selectedTc.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>

              <div>
                <p className="text-[11px] uppercase font-black text-[#16A34A] mb-1">Expected Result</p>
                <p className="text-xs text-[#16A34A] font-black bg-emerald-50/70 p-2 rounded-lg border border-emerald-200">
                  {selectedTc.expectedResults}
                </p>
              </div>

              {selectedTc.testData && (
                <div>
                  <p className="text-[11px] uppercase font-black text-[#0284C7] mb-1">Embedded Test Data</p>
                  <code className="text-xs font-mono font-black text-[#0284C7] bg-[#E0F2FE] px-2.5 py-1 rounded-lg border border-sky-200 inline-block break-all">
                    {selectedTc.testData}
                  </code>
                </div>
              )}
            </div>
          )}

          {/* Run Hints / CLI instructions */}
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
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-black text-[#0F172A] uppercase tracking-wider">
                Generated Script {generatedScript?.fileName ? `• ${generatedScript.fileName}` : ''}
              </label>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black border ${
                source === 'ai' ? 'bg-[#FAF5FF] text-[#7C3AED] border-purple-200' : 'bg-[#E0F2FE] text-[#0284C7] border-sky-200'
              }`}>
                {source === 'ai' ? 'AI Grounded' : 'Engine Ready (0ms)'}
              </span>
            </div>

            {generatedScript && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* AI Deep Optimize Button */}
                <button
                  type="button"
                  onClick={handleAiDeepOptimize}
                  disabled={generatingAi}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-xs text-[#7C3AED] border border-purple-200 font-black hover:bg-purple-100 transition-colors cursor-pointer disabled:opacity-50"
                  title="Enhance script with Cloud Generative AI model"
                >
                  {generatingAi ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7C3AED]" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
                  )}
                  <span>{generatingAi ? 'Synthesizing...' : 'AI Deep Optimize'}</span>
                </button>

                {/* Edit Mode Toggle */}
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-1 text-xs text-[#7C3AED] font-black hover:underline cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'View Mode' : 'Edit Code'}</span>
                </button>

                {/* Reset button if edited */}
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleResetCode}
                    className="flex items-center gap-1 text-xs text-[#0284C7] hover:text-[#0369A1] font-black cursor-pointer"
                    title="Reset to generated version"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}

                {/* Download Button */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0F172A] transition-colors font-black cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>

                {/* Copy Button */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-[#7C3AED] font-black hover:text-[#6D28D9] transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Code
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="bg-white text-[#0F172A] border-2 border-purple-200 rounded-2xl overflow-hidden min-h-[520px] shadow-sm">
            {generatedScript ? (
              <div>
                <div className="flex items-center justify-between px-4 py-3 bg-[#F8FCFF] border-b-2 border-purple-100 text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: frameworks.find((f) => f.id === generatedScript.framework)?.color }}
                    />
                    <span className="text-[11px] text-[#0F172A] font-mono font-black">
                      {generatedScript.language.toUpperCase()} • {generatedScript.framework} • {selectedTc?.testCaseId}
                    </span>
                  </div>
                  {isEditing ? (
                    <span className="text-[10px] text-[#BE185D] font-black uppercase bg-[#FDF2F8] px-2.5 py-0.5 rounded-full border border-pink-200">
                      Editing Enabled
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#0284C7] font-black bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                      Executable Architecture
                    </span>
                  )}
                </div>

                {isEditing ? (
                  <textarea
                    value={editedCode}
                    onChange={(e) => setEditedCode(e.target.value)}
                    className="w-full h-[540px] p-4 text-xs font-mono bg-white text-[#0F172A] font-bold resize-none outline-none leading-relaxed selection:bg-purple-100"
                    spellCheck={false}
                  />
                ) : (
                  <pre className="p-4 text-xs font-mono text-[#0F172A] font-semibold overflow-auto max-h-[540px] leading-relaxed bg-white selection:bg-purple-100">
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
    </div>
  );
}
