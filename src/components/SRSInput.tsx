import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Sparkles, Download, Trash2, ChevronDown, ChevronUp, Tag, Clock, Upload, Shield, AlertTriangle, Zap, Grid3X3, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { generateTestCases, detectAmbiguities, assessRisk, generateTraceabilityMatrix, detectDuplicates, calculateCoverage, generateNegativeTestCases } from '../lib/ai-engine';
import { testCaseAPI } from '../lib/api';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const SAMPLE_SRS = `REQ-001: The system shall allow users to register with email and password. The password must be at least 8 characters with uppercase, lowercase, and special characters.

REQ-002: Users should be able to login using their credentials. The system must lock the account after 5 failed login attempts.

REQ-003: The system shall provide a dashboard displaying user analytics including total visits, active sessions, and conversion rates in real-time.

REQ-004: Admin users must be able to manage user roles and permissions. The system shall support role-based access control with at least 3 permission levels.

REQ-005: The system shall process payment transactions securely using encryption. All payment data must comply with PCI-DSS standards.

REQ-006: The search functionality should return results quickly and display them in a user-friendly manner with pagination support.

REQ-007: The system shall send email notifications for account activities including login, password change, and transaction completion.

REQ-008: The API shall support RESTful endpoints with proper authentication using JWT tokens. Rate limiting should be implemented for all public endpoints.

REQ-009: The system should handle concurrent users efficiently and maintain performance under load. Response time should be fast for all operations.

REQ-010: User data export functionality must be available in CSV and PDF formats. The export should include all user activity logs and transaction history.`;

export default function SRSInput() {
  const { srsText, setSrsText, setTestCases, setAmbiguities, setRiskAssessment, setTraceability, setDuplicates, setCoverage, setNegativeTestCases, isProcessing, setIsProcessing, testCases, negativeTestCases, addSrsHistory, toggleTestCaseCoverage } = useAppStore();
  const [expandedTC, setExpandedTC] = useState<string | null>(null);
  const [processingType, setProcessingType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const tcGenerationTypes = [
    { id: 'functional', label: 'Functional', icon: Zap, color: 'from-blue-500 to-cyan-500', description: 'Happy path scenarios' },
    { id: 'security', label: 'Security', icon: Shield, color: 'from-red-500 to-pink-500', description: 'Auth & authorization' },
    { id: 'boundary', label: 'Boundary Value', icon: Grid3X3, color: 'from-purple-500 to-indigo-500', description: 'Edge & limit testing' },
    { id: 'negative', label: 'Negative/Edge', icon: AlertTriangle, color: 'from-amber-500 to-orange-500', description: 'Error scenarios' },
  ];

  const downloadJSON = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const allCases = [...testCases, ...negativeTestCases];
    if (allCases.length === 0) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadJSON(
      {
        generatedAt: new Date().toISOString(),
        testCaseCount: allCases.length,
        testCases: allCases,
      },
      `test-cases-${stamp}.json`
    );
    toast.success('Downloaded JSON export');
  };

  const extractTextFromPDF = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let text = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((it: any) => ('str' in it ? it.str : ''))
        .join(' ');
      text += `${pageText}\n\n`;
    }
    return text.trim();
  };

  const handleImportFile = async (file: File) => {
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.txt')) {
        const text = await file.text();
        setSrsText(text);
        toast.success('Imported text file');
        return;
      }
      if (name.endsWith('.pdf')) {
        toast.info('Extracting text from PDF...');
        const text = await extractTextFromPDF(file);
        setSrsText(text);
        toast.success('Imported PDF');
        return;
      }
      toast.error('Unsupported file. Please import a .txt or .pdf file.');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to import file');
    }
  };

  const handleGenerate = async () => {
    if (!srsText.trim()) return;
    setIsProcessing(true);
    try {
      const cases = await generateTestCases(srsText);
      setTestCases(cases);

      const [ambiguityResults, negCases] = await Promise.all([
        detectAmbiguities(srsText),
        generateNegativeTestCases(srsText),
      ]);
      setAmbiguities(ambiguityResults);
      setNegativeTestCases(negCases);

      const allCases = [...cases, ...negCases];
      const [riskResult, traceResult, dupResult, covResult] = await Promise.all([
        assessRisk(srsText, allCases),
        generateTraceabilityMatrix(srsText, allCases),
        detectDuplicates(allCases),
        calculateCoverage(srsText, allCases),
      ]);
      setRiskAssessment(riskResult);
      setTraceability(traceResult);
      setDuplicates(dupResult);
      setCoverage(covResult);

      // Best-effort sync to backend so Test Runs and other sessions can reuse generated TCs.
      await Promise.allSettled(
        allCases.slice(0, 50).map((tc) =>
          testCaseAPI.create({
            scenario: tc.scenario,
            preconditions: typeof tc.preconditions === 'string' ? [tc.preconditions] : tc.preconditions,
            steps: tc.steps || [],
            expectedResults: tc.expectedResults,
            priority: tc.priority,
            category: tc.category,
          })
        )
      );

      // Save to SRS history
      const historyEntry = {
        id: uuidv4(),
        title: `SRS - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        srsText,
        createdAt: new Date().toISOString(),
        testCaseCount: allCases.length,
      };
      addSrsHistory(historyEntry);
      toast.success('SRS saved to history');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateByType = async (typeId: string) => {
    if (!srsText.trim() || !testCases.length) {
      toast.error('Please generate base test cases first');
      return;
    }
    setProcessingType(typeId);
    try {
      // Filter or generate additional TCs based on type
      const additionalTCs = await generateTypeSpecificTestCases(srsText, typeId, testCases);
      const updatedCases = [...testCases, ...additionalTCs];
      setTestCases(updatedCases);

      toast.success(`Added ${additionalTCs.length} ${tcGenerationTypes.find(t => t.id === typeId)?.label} test cases`);
    } finally {
      setProcessingType(null);
    }
  };

  // Generate type-specific test cases
  const generateTypeSpecificTestCases = async (srsText: string, typeId: string, existingCases: any[]): Promise<any[]> => {
    await new Promise(resolve => setTimeout(resolve, 1200));
    const requirements = extractRequirements(srsText);
    const newCases: any[] = [];
    let tcCounter = Math.max(...existingCases.map(tc => parseInt(tc.testCaseId.split('-')[1]) || 0)) + 1;

    const SECURITY_KEYWORDS = ['authentication', 'authorization', 'password', 'encryption', 'token', 'session', 'login', 'logout', 'access control', 'permission', 'role', 'admin', 'security', 'ssl', 'tls', 'https', 'certificate', 'oauth', 'jwt', 'api key', 'secret', 'credential'];

    const BOUNDARY_KEYWORDS = ['length', 'limit', 'maximum', 'minimum', 'range', 'threshold', 'boundary', 'edge', 'constraint', 'validation', 'field', 'input'];

    for (const req of requirements) {
      const lower = req.text.toLowerCase();
      const priority = determinePriority(req.text);
      const risk = calculateRiskScore(req.text);

      if (typeId === 'functional') {
        // Multiple functional scenarios
        ['happy path', 'alternative flow', 'data variation', 'concurrent operation'].forEach((scenario) => {
          newCases.push({
            id: uuidv4(),
            testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
            scenario: `${scenario.toUpperCase()}: ${req.text.substring(0, 60)}`,
            preconditions: generatePrecondition(req.text),
            steps: generateSteps(req.text, 'functional'),
            expectedResults: `System successfully handles ${scenario} for: ${req.text.substring(0, 50)}`,
            priority,
            riskScore: risk,
            requirementId: req.id,
            category: 'functional',
            tags: [...extractTags(req.text), scenario],
            createdAt: new Date().toISOString(),
          });
        });
      } else if (typeId === 'security' || (SECURITY_KEYWORDS.some(kw => lower.includes(kw)))) {
        const securityScenarios = [
          'unauthorized access attempt',
          'invalid token validation',
          'sql injection attempt',
          'privilege escalation',
          'session hijacking prevention',
        ];
        securityScenarios.forEach((scenario) => {
          newCases.push({
            id: uuidv4(),
            testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
            scenario: `SECURITY - ${scenario}: ${req.text.substring(0, 50)}`,
            preconditions: 'Security testing environment is configured. Test accounts with various permissions available.',
            steps: generateSteps(req.text, 'security'),
            expectedResults: `System blocks ${scenario} and logs security event.`,
            priority: 'High',
            riskScore: Math.min(100, risk + 25),
            requirementId: req.id,
            category: 'security',
            tags: [...extractTags(req.text), 'security', scenario],
            createdAt: new Date().toISOString(),
          });
        });
      } else if (typeId === 'boundary' || BOUNDARY_KEYWORDS.some(kw => lower.includes(kw))) {
        const boundaryTests = [
          'minimum valid value',
          'maximum valid value',
          'just below minimum',
          'just above maximum',
          'null/empty input',
          'special characters',
          'very long input',
        ];
        boundaryTests.forEach((test) => {
          newCases.push({
            id: uuidv4(),
            testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
            scenario: `BOUNDARY - ${test}: ${req.text.substring(0, 50)}`,
            preconditions: 'Test data with boundary values prepared.',
            steps: generateSteps(req.text, 'boundary'),
            expectedResults: `System correctly handles ${test}. Appropriate error or success message displayed.`,
            priority: 'High',
            riskScore: Math.min(100, risk + 20),
            requirementId: req.id,
            category: 'boundary',
            tags: [...extractTags(req.text), 'boundary', test],
            createdAt: new Date().toISOString(),
          });
        });
      } else if (typeId === 'negative') {
        const negativeScenarios = [
          'missing required field',
          'invalid format input',
          'timeout scenario',
          'system error recovery',
          'concurrent access conflict',
          'network failure handling',
        ];
        negativeScenarios.forEach((scenario) => {
          newCases.push({
            id: uuidv4(),
            testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
            scenario: `NEGATIVE - ${scenario}: ${req.text.substring(0, 50)}`,
            preconditions: 'Test environment configured for failure scenarios.',
            steps: generateSteps(req.text, 'negative'),
            expectedResults: `System gracefully handles ${scenario}. User-friendly error message displayed.`,
            priority: 'Medium',
            riskScore: Math.min(100, risk + 15),
            requirementId: req.id,
            category: 'negative',
            tags: [...extractTags(req.text), 'negative', scenario],
            createdAt: new Date().toISOString(),
          });
        });
      }
    }

    return newCases;
  };

  const extractRequirements = (srsText: string) => {
    const lines = srsText.split('\n').filter(l => l.trim());
    const requirements: { id: string; text: string }[] = [];
    let reqCounter = 1;

    for (const line of lines) {
      const trimmed = line.trim();
      const reqMatch = trimmed.match(/^(REQ[-_]?\d+|R\d+|FR[-_]?\d+|NFR[-_]?\d+|US[-_]?\d+)[:\s-]*(.*)/i);
      if (reqMatch) {
        requirements.push({ id: reqMatch[1].toUpperCase(), text: reqMatch[2].trim() || trimmed });
      } else if (trimmed.length > 20 && !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
        requirements.push({ id: `REQ-${String(reqCounter).padStart(3, '0')}`, text: trimmed });
        reqCounter++;
      }
    }

    return requirements.length > 0 ? requirements : [{ id: 'REQ-001', text: srsText.substring(0, 200) }];
  };

  const determinePriority = (text: string): 'High' | 'Medium' | 'Low' => {
    const lower = text.toLowerCase();
    const SECURITY_KEYWORDS = ['authentication', 'authorization', 'password', 'encryption', 'token', 'session', 'login', 'logout', 'access control', 'permission'];
    const hasSecurityKw = SECURITY_KEYWORDS.some(kw => lower.includes(kw));
    const hasCriticalWords = ['must', 'critical', 'essential', 'mandatory', 'required', 'shall'].some(w => lower.includes(w));
    const hasHighFreq = ['always', 'every', 'all users', 'real-time', 'immediately'].some(w => lower.includes(w));

    if (hasSecurityKw || hasCriticalWords) return 'High';
    if (hasHighFreq || lower.includes('should') || lower.includes('important')) return 'Medium';
    return 'Low';
  };

  const calculateRiskScore = (text: string): number => {
    const lower = text.toLowerCase();
    let score = 20;
    const SECURITY_KEYWORDS = ['authentication', 'authorization', 'password', 'encryption', 'token', 'session', 'login'];
    const PERFORMANCE_KEYWORDS = ['performance', 'speed', 'latency', 'throughput', 'response time', 'load', 'concurrent', 'scalability'];
    SECURITY_KEYWORDS.forEach(kw => { if (lower.includes(kw)) score += 8; });
    PERFORMANCE_KEYWORDS.forEach(kw => { if (lower.includes(kw)) score += 5; });
    if (lower.includes('database') || lower.includes('data')) score += 10;
    if (lower.includes('payment') || lower.includes('transaction')) score += 15;
    if (lower.includes('user input') || lower.includes('form')) score += 7;
    return Math.min(100, score);
  };

  const generatePrecondition = (text: string): string => {
    const lower = text.toLowerCase();
    const conditions: string[] = ['System is accessible and running'];
    if (lower.includes('user') || lower.includes('login')) conditions.push('User is logged in with valid credentials');
    if (lower.includes('admin')) conditions.push('User has admin privileges');
    if (lower.includes('database')) conditions.push('Database is online and connection is established');
    if (lower.includes('payment')) conditions.push('Payment gateway is configured and active');
    return conditions.join('. ') + '.';
  };

  const generateSteps = (text: string, type: string = 'positive'): string[] => {
    const steps: string[] = [];
    if (type === 'functional' || type === 'positive') {
      steps.push(`Navigate to the feature related to: ${text.substring(0, 50)}`);
      steps.push('Provide valid input data');
      steps.push('Execute the operation');
      steps.push('Verify the system response and data consistency');
    } else if (type === 'security') {
      steps.push('Attempt to bypass security controls');
      steps.push('Try unauthorized access to protected resources');
      steps.push('Monitor security logs for events');
      steps.push('Verify proper blocking and audit trail');
    } else if (type === 'validation') {
      steps.push('Navigate to input form');
      steps.push('Enter invalid data in required fields');
      steps.push('Attempt form submission');
      steps.push('Verify validation error messages');
    } else if (type === 'boundary') {
      steps.push('Prepare test data at boundary values');
      steps.push('Input data at edge of valid range');
      steps.push('Submit request');
      steps.push('Verify correct handling and response');
    } else if (type === 'negative') {
      steps.push('Simulate error condition');
      steps.push('Trigger system error or failure');
      steps.push('Observe system behavior');
      steps.push('Verify graceful error handling');
    }
    return steps;
  };

  const extractTags = (text: string): string[] => {
    const tags: string[] = [];
    const lower = text.toLowerCase();
    if (lower.includes('user')) tags.push('user-management');
    if (lower.includes('login') || lower.includes('auth')) tags.push('authentication');
    if (lower.includes('payment')) tags.push('payment');
    if (lower.includes('search')) tags.push('search');
    if (lower.includes('email')) tags.push('notifications');
    if (lower.includes('api')) tags.push('api');
    if (lower.includes('report')) tags.push('reporting');
    if (lower.includes('export')) tags.push('export');
    return tags.length > 0 ? tags : ['general'];
  };

  const getPriorityColor = (p: string) => {
    if (p === 'High') return 'bg-red-500/15 text-red-400 border-red-500/30';
    if (p === 'Medium') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          SRS to Test Case Generator
        </h2>
        <p className="text-sm text-muted mt-1">Paste your SRS document or user stories to generate structured test cases</p>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Input Panel */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider">SRS / User Story Input</label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportFile(file);
                  // allow selecting same file again
                  e.currentTarget.value = '';
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-primary hover:text-primary-dim transition-colors font-medium inline-flex items-center gap-1"
              >
                <Upload className="w-3 h-3" /> Import (.pdf/.txt)
              </button>
              <button
                onClick={() => setSrsText(SAMPLE_SRS)}
                className="text-xs text-primary hover:text-primary-dim transition-colors font-medium"
              >
                Load Sample SRS
              </button>
            </div>
          </div>
          <textarea
            value={srsText}
            onChange={(e) => setSrsText(e.target.value)}
            placeholder="Paste your SRS document, user stories, or requirements here...\n\nFormat examples:\nREQ-001: The system shall...\nAs a user, I want to...\nThe application must..."
            className="w-full h-[400px] bg-surface border border-border rounded-xl p-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none font-mono leading-relaxed"
          />
          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={isProcessing || !srsText.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-accent text-white font-semibold py-3 px-6 rounded-xl hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  Analyzing with AI...
                </>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate All Test Artifacts</>
              )}
            </button>
            <button
              onClick={() => { setSrsText(''); setTestCases([]); }}
              className="px-4 py-3 bg-surface border border-border rounded-xl text-muted hover:text-foreground hover:border-border-bright transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Advanced TC Type Generation Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 pt-6 border-t border-border/50"
          >
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Generate Test Cases by Type</h3>
            <p className="text-xs text-muted/70 mb-3">Create specific types of test cases after generating base cases</p>
            <div className="grid grid-cols-2 gap-2">
              {tcGenerationTypes.map((type) => {
                const IconComponent = type.icon;
                const isProcessing = processingType === type.id;
                return (
                  <motion.button
                    key={type.id}
                    onClick={() => handleGenerateByType(type.id)}
                    disabled={!testCases.length || isProcessing}
                    whileHover={{ scale: !testCases.length ? 1 : 1.05 }}
                    whileTap={{ scale: !testCases.length ? 1 : 0.98 }}
                    className={`relative overflow-hidden group p-2 rounded-lg font-medium text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-surface border border-border hover:border-primary/50 text-foreground`}
                  >
                    <div className="flex items-center justify-center gap-1.5 h-full">
                      {isProcessing ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-3 h-3 border border-current border-t-transparent rounded-full" />
                      ) : (
                        <IconComponent className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">{type.label}</span>
                      <span className="sm:hidden text-[10px]">{type.label.substring(0, 3)}</span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>

        {/* Output Panel */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider">
              Generated Test Cases ({testCases.length})
            </label>
            {testCases.length + negativeTestCases.length > 0 && (
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary-dim transition-colors font-medium"
              >
                <Download className="w-3 h-3" /> Export JSON
              </button>
            )}
          </div>
          <div className="h-[440px] overflow-y-auto space-y-2 pr-1">
            <AnimatePresence mode="popLayout">
              {testCases.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <FileText className="w-12 h-12 text-border mx-auto mb-3" />
                    <p className="text-sm text-muted">Test cases will appear here</p>
                    <p className="text-xs text-muted/60 mt-1">Enter SRS text and click Generate</p>
                  </div>
                </motion.div>
              ) : (
                testCases.map((tc, i) => (
                  <motion.div
                    key={tc.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-surface border border-border rounded-lg overflow-hidden hover:border-border-bright transition-colors"
                  >
                    <button
                      onClick={() => setExpandedTC(expandedTC === tc.id ? null : tc.id)}
                      className="w-full flex items-center gap-3 p-3 text-left"
                    >
                      <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{tc.testCaseId}</span>
                      <span className="text-xs text-foreground flex-1 truncate">{tc.scenario}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleTestCaseCoverage(tc.testCaseId); }}
                        className={`px-2 py-1 text-[10px] rounded-full flex items-center gap-1 border transition-colors ${tc.isCovered ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-surface border-border hover:bg-surface-alt text-muted'}`}
                      >
                        <CheckCircle2 className="w-3 h-3" /> {tc.isCovered ? 'Covered' : 'Mark Covered'}
                      </button>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getPriorityColor(tc.priority)}`}>
                        {tc.priority}
                      </span>
                      {expandedTC === tc.id ? <ChevronUp className="w-3.5 h-3.5 text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-muted" />}
                    </button>
                    <AnimatePresence>
                      {expandedTC === tc.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-border"
                        >
                          <div className="p-3 space-y-3 text-xs">
                            <div>
                              <span className="text-muted font-semibold">Requirement:</span>
                              <span className="ml-2 text-foreground font-mono">{tc.requirementId}</span>
                            </div>
                            <div>
                              <span className="text-muted font-semibold">Preconditions:</span>
                              <p className="mt-1 text-foreground/80">{tc.preconditions}</p>
                            </div>
                            <div>
                              <span className="text-muted font-semibold">Steps:</span>
                              <ol className="mt-1 space-y-1">
                                {tc.steps.map((step, si) => (
                                  <li key={si} className="flex gap-2 text-foreground/80">
                                    <span className="text-primary font-mono shrink-0">{si + 1}.</span>
                                    {step}
                                  </li>
                                ))}
                              </ol>
                            </div>
                            <div>
                              <span className="text-muted font-semibold">Expected Result:</span>
                              <p className="mt-1 text-foreground/80">{tc.expectedResults}</p>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <Tag className="w-3 h-3 text-muted" />
                              {tc.tags.map(tag => (
                                <span key={tag} className="text-[10px] bg-surface-alt text-muted px-2 py-0.5 rounded-full">{tag}</span>
                              ))}
                              <span className="ml-auto flex items-center gap-1 text-muted">
                                <Clock className="w-3 h-3" />
                                Risk: {tc.riskScore}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
