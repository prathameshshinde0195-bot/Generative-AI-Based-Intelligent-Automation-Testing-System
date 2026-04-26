import { useState } from 'react';
import { motion } from 'framer-motion';
import { Code2, Copy, Check, ChevronDown } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { generateAutomationScript } from '../lib/ai-engine';
import type { AutomationFramework, GeneratedScript } from '../lib/types';

const frameworks: { id: AutomationFramework; label: string; lang: string; color: string }[] = [
  { id: 'selenium-java', label: 'Selenium (Java)', lang: 'Java', color: '#f89820' },
  { id: 'selenium-python', label: 'Selenium (Python)', lang: 'Python', color: '#3776ab' },
  { id: 'cypress', label: 'Cypress (JS)', lang: 'JavaScript', color: '#69d3a7' },
  { id: 'playwright', label: 'Playwright (TS)', lang: 'TypeScript', color: '#2ead33' },
];

export default function AutomationScriptGen() {
  const { testCases, negativeTestCases } = useAppStore();
  const allCases = [...testCases, ...negativeTestCases];
  const [selectedFramework, setSelectedFramework] = useState<AutomationFramework>('playwright');
  const [selectedTestCase, setSelectedTestCase] = useState<string>('');
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleGenerate = () => {
    const tc = allCases.find(c => c.testCaseId === selectedTestCase);
    if (!tc) return;
    const script = generateAutomationScript(tc, selectedFramework);
    setGeneratedScript(script);
  };

  const handleCopy = () => {
    if (generatedScript) {
      navigator.clipboard.writeText(generatedScript.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Code2 className="w-6 h-6 text-success" />
          Automation Script Generator
        </h2>
        <p className="text-sm text-muted mt-1">Convert test cases into executable automation scripts</p>
      </motion.div>

      {allCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Code2 className="w-16 h-16 text-border mb-4" />
          <p className="text-muted">Generate test cases first to create automation scripts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-4">
            {/* Framework Selection */}
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">Framework</label>
              <div className="grid grid-cols-2 gap-2">
                {frameworks.map(fw => (
                  <button
                    key={fw.id}
                    onClick={() => { setSelectedFramework(fw.id); setGeneratedScript(null); }}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                      selectedFramework === fw.id
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border bg-surface hover:border-border-bright'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ background: fw.color }} />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{fw.label}</p>
                      <p className="text-[10px] text-muted">{fw.lang}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Test Case Selection */}
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">Select Test Case</label>
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full flex items-center justify-between p-3 bg-surface border border-border rounded-lg text-xs text-foreground hover:border-border-bright transition-colors"
                >
                  <span className={selectedTestCase ? 'text-foreground' : 'text-muted'}>
                    {selectedTestCase ? `${selectedTestCase}: ${allCases.find(c => c.testCaseId === selectedTestCase)?.scenario?.substring(0, 50)}...` : 'Choose a test case...'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted" />
                </button>
                {showDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-surface border border-border rounded-lg shadow-xl max-h-[250px] overflow-y-auto">
                    {allCases.map(tc => (
                      <button
                        key={tc.id}
                        onClick={() => { setSelectedTestCase(tc.testCaseId); setShowDropdown(false); setGeneratedScript(null); }}
                        className="w-full text-left px-3 py-2.5 text-xs hover:bg-surface-alt transition-colors border-b border-border/30 last:border-0"
                      >
                        <span className="font-mono text-primary font-bold">{tc.testCaseId}</span>
                        <span className="text-muted ml-2">{tc.scenario.substring(0, 60)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!selectedTestCase}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-success to-primary text-white font-semibold py-3 px-6 rounded-xl hover:opacity-90 transition-all disabled:opacity-40"
            >
              <Code2 className="w-4 h-4" /> Generate Script
            </button>

            {/* Quick preview of selected test case */}
            {selectedTestCase && (
              <div className="bg-surface border border-border rounded-lg p-4 space-y-2">
                <h4 className="text-xs font-semibold text-muted">Selected Test Case Details</h4>
                {(() => {
                  const tc = allCases.find(c => c.testCaseId === selectedTestCase);
                  if (!tc) return null;
                  return (
                    <>
                      <p className="text-xs text-foreground">{tc.scenario}</p>
                      <div className="flex gap-2 flex-wrap">
                        {tc.tags.map(t => (
                          <span key={t} className="text-[10px] bg-surface-alt text-muted px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Code Output */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Generated Script</label>
              {generatedScript && (
                <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-primary hover:text-primary-dim transition-colors">
                  {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Code</>}
                </button>
              )}
            </div>
            <div className="bg-[#0d1117] border border-border rounded-xl overflow-hidden">
              {generatedScript ? (
                <div className="relative">
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#161b22] border-b border-border">
                    <div className="w-3 h-3 rounded-full" style={{ background: frameworks.find(f => f.id === generatedScript.framework)?.color }} />
                    <span className="text-[10px] text-muted font-mono">{generatedScript.language} • {generatedScript.framework}</span>
                  </div>
                  <pre className="p-4 text-xs font-mono text-foreground/90 overflow-auto max-h-[500px] leading-relaxed">
                    <code>{generatedScript.code}</code>
                  </pre>
                </div>
              ) : (
                <div className="flex items-center justify-center py-32">
                  <div className="text-center">
                    <Code2 className="w-10 h-10 text-border mx-auto mb-2" />
                    <p className="text-xs text-muted">Select a test case and framework to generate</p>
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
