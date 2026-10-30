import { useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Sparkles, Download, Trash2, ChevronDown, ChevronUp,
  Upload, FileSpreadsheet, FlaskConical, Code2, Search,
  CheckSquare, Square, RefreshCw, Edit3, X, Eye,
  Layers, Check, GitCompare, UserCheck
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import {
  extractDetailedRequirements,
  generateTestCasesByType,
  ALL_TEST_CASE_TYPES,
  detectAmbiguities,
  assessRisk,
  generateTraceabilityMatrix,
  detectDuplicates,
  calculateCoverage
} from '../lib/ai-engine';
import { testCaseAPI } from '../lib/api';
import type { TestCase, ExtractedRequirement } from '../lib/types';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

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

const ECOMMERCE_SRS = `REQ-EC-01: Customers can browse catalog items with filters for category, price range, and star ratings.
REQ-EC-02: Authenticated users can add items to shopping cart, update quantities, and apply promotional coupon codes.
REQ-EC-03: The checkout flow must validate billing and shipping addresses and compute regional tax rates.
REQ-EC-04: Credit card payments must be processed via Stripe/PCI-DSS gateway with 3D Secure verification.
REQ-EC-05: System must decrement inventory in real-time and lock stock for 15 minutes during active checkout.`;

export default function SRSInput() {
  const {
    srsText,
    setSrsText,
    setTestCases,
    setAmbiguities,
    setRiskAssessment,
    setTraceability,
    setDuplicates,
    setCoverage,
    setNegativeTestCases,
    isProcessing,
    setIsProcessing,
    testCases,
    negativeTestCases,
    addSrsHistory,
    projectId,
    extractedRequirements,
    setExtractedRequirements,
    updateExtractedRequirement,
    setSelectedTestCaseForDataGen,
    setActiveFeature,
    updateTestCase,
    removeTestCase
  } = useAppStore();

  const [expandedTC, setExpandedTC] = useState<string | null>(null);
  const [editingTC, setEditingTC] = useState<TestCase | null>(null);
  const [inspectingTC, setInspectingTC] = useState<TestCase | null>(null);
  const [comparingSuites, setComparingSuites] = useState(false);
  const [previousSuite, setPreviousSuite] = useState<TestCase[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Requirements extraction view state
  const [showReqReview, setShowReqReview] = useState(true);
  const [editingReq, setEditingReq] = useState<ExtractedRequirement | null>(null);

  // Type selection panel state
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    'functional', 'positive', 'negative', 'boundary', 'security', 'api'
  ]);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('both');
  const [automationFilter, setAutomationFilter] = useState<string>('both');

  // Search & filter state for test case list
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState<'id' | 'priority' | 'type'>('priority');

  // Multi-select for bulk actions
  const [selectedTcIds, setSelectedTcIds] = useState<Set<string>>(new Set());

  // Auto-extract requirements if srsText changes and none exist
  const handleExtractRequirements = (textToExtract?: string) => {
    const raw = textToExtract || srsText;
    if (!raw.trim()) {
      toast.error('Please enter SRS text or import a document first.');
      return;
    }
    const reqs = extractDetailedRequirements(raw);
    setExtractedRequirements(reqs);
    setShowReqReview(true);
    toast.success(`Extracted ${reqs.length} structured requirements`);
  };

  const handleToggleSelectType = (typeId: string) => {
    setSelectedTypes(prev =>
      prev.includes(typeId) ? prev.filter(t => t !== typeId) : [...prev, typeId]
    );
  };

  const handleSelectAllTypes = () => {
    setSelectedTypes(ALL_TEST_CASE_TYPES.map(t => t.id));
  };

  const handleClearAllTypes = () => {
    setSelectedTypes([]);
  };

  const handleApplyPreset = (preset: 'smoke' | 'regression' | 'security' | 'boundary' | 'all') => {
    if (preset === 'all') {
      setSelectedTypes(ALL_TEST_CASE_TYPES.map(t => t.id));
    } else if (preset === 'smoke') {
      setSelectedTypes(['smoke', 'sanity', 'functional', 'positive']);
    } else if (preset === 'regression') {
      setSelectedTypes(['regression', 'functional', 'integration', 'e2e', 'api', 'database']);
    } else if (preset === 'security') {
      setSelectedTypes(['security', 'negative', 'error_handling', 'boundary']);
    } else if (preset === 'boundary') {
      setSelectedTypes(['boundary', 'equivalence', 'validation', 'edge']);
    }
    toast.info(`Applied ${preset.toUpperCase()} preset`);
  };

  // Main generator using selected types
  const handleGenerate = async () => {
    if (!srsText.trim()) {
      toast.error('Please enter SRS text first.');
      return;
    }
    if (selectedTypes.length === 0) {
      toast.error('Please select at least one test case type.');
      return;
    }

    // Save current suite as previous for diff comparison
    if (testCases.length > 0) {
      setPreviousSuite([...testCases, ...negativeTestCases]);
    }

    setIsProcessing(true);

    try {
      // 1. Ensure requirements are extracted
      let activeReqs = extractedRequirements;
      if (!activeReqs || activeReqs.length === 0) {
        activeReqs = extractDetailedRequirements(srsText);
        setExtractedRequirements(activeReqs);
      }

      // 2. Generate cases based on selected types and active requirements
      const generated = await generateTestCasesByType(srsText, selectedTypes, {
        priorityFilter,
        classificationFilter,
        automationFilter,
        requirements: activeReqs,
      });

      // Split positive/functional from negative/boundary
      const regular = generated.filter(tc => (tc.category || '').toLowerCase() !== 'negative');
      const negative = generated.filter(tc => (tc.category || '').toLowerCase() === 'negative');

      setTestCases(regular);
      setNegativeTestCases(negative);

      // Run companion analytics in background
      const [ambig, risk, trace, dups, cov] = await Promise.all([
        detectAmbiguities(srsText),
        assessRisk(srsText, generated),
        generateTraceabilityMatrix(srsText, generated),
        detectDuplicates(generated),
        calculateCoverage(srsText, generated),
      ]);

      setAmbiguities(ambig);
      setRiskAssessment(risk);
      setTraceability(trace);
      setDuplicates(dups);
      setCoverage(cov);

      // Save to audit history
      addSrsHistory({
        id: uuidv4(),
        title: `Test Suite: ${activeReqs[0]?.title || 'SRS Requirements'}`,
        srsText,
        createdAt: new Date().toISOString(),
        testCaseCount: generated.length,
        testCasesSnapshot: generated,
        projectId,
      });

      // Persist to backend if accessible
      try {
        await Promise.all(
          generated.slice(0, 10).map(tc =>
            testCaseAPI.create({
              testCaseId: tc.testCaseId,
              scenario: tc.scenario,
              preconditions: [tc.preconditions],
              steps: tc.steps,
              expectedResults: tc.expectedResults,
              priority: tc.priority,
              category: tc.category,
              projectId,
            }).catch(() => {})
          )
        );
      } catch {
        // Safe offline fallback
      }

      toast.success(`Generated ${generated.length} test cases across ${selectedTypes.length} types!`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to generate test cases: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Navigate to AI Test Data Generator with selected TC
  const handleSendToTestDataGen = (tc: TestCase) => {
    setSelectedTestCaseForDataGen(tc);
    setActiveFeature('test-data');
    toast.success(`Loaded "${tc.testCaseId}" into AI Test Data Generator`);
  };

  // Navigate to Automation Script Gen with selected TC
  const handleSendToScriptGen = (tc: TestCase) => {
    setActiveFeature('automation');
    toast.info(`Switched to Automation Script Generator for "${tc.testCaseId}"`);
  };

  // Regeneration of single test case
  const handleRegenerateSingleTC = (tc: TestCase) => {
    const updatedSteps = [
      `1. Initialize clean state for ${tc.requirementId}`,
      `2. Supply validated input set for scenario: ${tc.scenario}`,
      `3. Dispatch execution trigger under ${tc.testType || tc.category} harness`,
      `4. Verify assertion matches expected results: ${tc.expectedResults.substring(0, 60)}...`,
      `5. Audit persistent database ledger and confirmation event`
    ];
    updateTestCase(tc.testCaseId, {
      steps: updatedSteps,
      createdAt: new Date().toISOString(),
      status: 'Active',
    });
    toast.success(`Regenerated steps for ${tc.testCaseId}`);
  };

  // File import (.pdf, .txt, .docx)
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
      let text = '';
      if (file.name.endsWith('.pdf')) {
        text = await extractTextFromPDF(file);
      } else {
        text = await file.text();
      }
      if (!text.trim()) {
        toast.error('Imported file appears to be empty.');
        return;
      }
      setSrsText(text);
      handleExtractRequirements(text);
      toast.success(`Imported ${file.name} successfully`);
    } catch (err: any) {
      toast.error('Failed to import file: ' + (err?.message || 'Parsing error'));
    }
  };

  // Exports
  const allCases = useMemo(() => [...testCases, ...negativeTestCases], [testCases, negativeTestCases]);

  const handleExportJSON = () => {
    if (allCases.length === 0) return;
    const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), count: allCases.length, testCases: allCases }, null, 2)], { type: 'application/json' });
    saveAs(blob, `test-suite-${Date.now()}.json`);
    toast.success('Downloaded JSON export');
  };

  const handleExportExcel = () => {
    if (allCases.length === 0) return;
    const rows = allCases.map(tc => ({
      'Test Case ID': tc.testCaseId,
      'Title': tc.title || tc.scenario,
      'Requirement ID': tc.requirementId,
      'Requirement Desc': tc.requirementDescription || '',
      'Scenario': tc.scenario,
      'Preconditions': tc.preconditions,
      'Steps': Array.isArray(tc.steps) ? tc.steps.join(' | ') : tc.steps,
      'Test Data': tc.testData || '',
      'Expected Results': tc.expectedResults,
      'Priority': tc.priority,
      'Severity': tc.severity || 'Major',
      'Test Type': tc.testType || tc.category,
      'Classification': tc.classification || 'Positive',
      'Automation Tool': tc.suggestedTool || 'Playwright',
      'Execution Status': tc.executionStatus || 'Not Run',
      'Risk Score': tc.riskScore,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Test Suite');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `test-suite-${Date.now()}.xlsx`);
    toast.success('Downloaded Excel (.xlsx) export');
  };

  const handleExportCSV = () => {
    if (allCases.length === 0) return;
    const headers = ['Test Case ID', 'Title', 'Requirement ID', 'Scenario', 'Preconditions', 'Expected Results', 'Priority', 'Test Type', 'Classification'];
    const rows = allCases.map(tc => [
      `"${tc.testCaseId}"`,
      `"${(tc.title || tc.scenario).replace(/"/g, '""')}"`,
      `"${tc.requirementId}"`,
      `"${tc.scenario.replace(/"/g, '""')}"`,
      `"${tc.preconditions.replace(/"/g, '""')}"`,
      `"${tc.expectedResults.replace(/"/g, '""')}"`,
      `"${tc.priority}"`,
      `"${tc.testType || tc.category}"`,
      `"${tc.classification || 'Positive'}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `test-suite-${Date.now()}.csv`);
    toast.success('Downloaded CSV export');
  };

  // Filtered and sorted test cases
  const filteredCases = useMemo(() => {
    return allCases.filter(tc => {
      const matchSearch = !searchQuery ||
        tc.testCaseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tc.scenario.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tc.requirementId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tc.title && tc.title.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchType = filterType === 'all' || (tc.testType && tc.testType.toLowerCase() === filterType.toLowerCase()) || tc.category === filterType;
      const matchPriority = filterPriority === 'all' || tc.priority.toLowerCase() === filterPriority.toLowerCase();
      const matchStatus = filterStatus === 'all' || (tc.executionStatus && tc.executionStatus.toLowerCase() === filterStatus.toLowerCase());

      return matchSearch && matchType && matchPriority && matchStatus;
    }).sort((a, b) => {
      if (sortBy === 'priority') {
        const order: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
      }
      if (sortBy === 'type') {
        return (a.testType || a.category).localeCompare(b.testType || b.category);
      }
      return a.testCaseId.localeCompare(b.testCaseId);
    });
  }, [allCases, searchQuery, filterType, filterPriority, filterStatus, sortBy]);

  // Bulk actions
  const toggleSelectTc = (id: string) => {
    setSelectedTcIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    selectedTcIds.forEach(id => removeTestCase(id));
    setSelectedTcIds(new Set());
    toast.success(`Removed ${selectedTcIds.size} test cases`);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#f0f9ff] dark:bg-slate-900 transition-colors">
      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#e0f2fe] dark:bg-sky-950/50 text-[#0ea5e9]">
              <FileText className="w-6 h-6" />
            </span>
            SRS Input & Intelligent Test Case Generator
          </h2>
          <p className="text-sm text-[#64748b] dark:text-slate-400 mt-1">
            Analyze requirements, select target test categories, and generate comprehensive, grounded test suites with automated traceability.
          </p>
        </div>

        {/* Global Toolbar buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {allCases.length > 0 && previousSuite.length > 0 && (
            <button
              onClick={() => setComparingSuites(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-[#e2e8f0] dark:border-slate-700 text-[#172033] dark:text-white hover:border-[#7c3aed] transition-colors shadow-xs"
            >
              <GitCompare className="w-3.5 h-3.5 text-[#7c3aed]" />
              Compare Versions ({previousSuite.length} vs {allCases.length})
            </button>
          )}

          {allCases.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#dcfce7] dark:bg-emerald-950/40 text-[#16a34a] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 hover:opacity-90 transition-all shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel (.xlsx)
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#e0f2fe] dark:bg-sky-950/40 text-[#0ea5e9] dark:text-sky-400 border border-sky-200 dark:border-sky-800/40 hover:opacity-90 transition-all shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#f3e8ff] dark:bg-purple-950/40 text-[#7c3aed] dark:text-purple-400 border border-purple-200 dark:border-purple-800/40 hover:opacity-90 transition-all shadow-xs"
              >
                <Code2 className="w-3.5 h-3.5" />
                JSON
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Main Grid: Left Input & Type Panel | Right Results Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column (5 cols): SRS Input, Extraction Review & Types */}
        <div className="xl:col-span-5 space-y-5">
          {/* SRS Document Input Card */}
          <div className="bg-white dark:bg-slate-800 border border-[#e2e8f0] dark:border-slate-700 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#172033] dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#7c3aed]" />
                1. Software Requirement Specification
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleImportFile(f);
                    e.currentTarget.value = '';
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-[#0ea5e9] hover:underline font-semibold flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" /> Upload PDF/TXT
                </button>
              </div>
            </div>

            <textarea
              value={srsText}
              onChange={(e) => setSrsText(e.target.value)}
              placeholder="Paste your Software Requirement Specification (SRS) or User Stories here...&#10;&#10;Example:&#10;REQ-001: The system shall allow users to register with email and password...&#10;REQ-002: User login must lock account after 5 failed attempts..."
              className="w-full h-44 bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-xl p-3.5 text-xs text-[#172033] dark:text-slate-200 placeholder-[#64748b]/60 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/20 focus:border-[#7c3aed] font-mono leading-relaxed resize-none"
            />

            {/* Presets & Quick Actions */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-[#64748b] font-medium">Sample:</span>
                <button
                  onClick={() => { setSrsText(SAMPLE_SRS); handleExtractRequirements(SAMPLE_SRS); }}
                  className="text-[11px] px-2 py-1 rounded-md bg-[#f3e8ff] dark:bg-purple-950/40 text-[#7c3aed] dark:text-purple-300 font-medium hover:bg-purple-200 transition-colors"
                >
                  Enterprise Auth & Admin
                </button>
                <button
                  onClick={() => { setSrsText(ECOMMERCE_SRS); handleExtractRequirements(ECOMMERCE_SRS); }}
                  className="text-[11px] px-2 py-1 rounded-md bg-[#e0f2fe] dark:bg-sky-950/40 text-[#0ea5e9] dark:text-sky-300 font-medium hover:bg-sky-200 transition-colors"
                >
                  E-Commerce & Checkout
                </button>
              </div>

              <button
                onClick={() => handleExtractRequirements()}
                className="text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#7c3aed] text-[#7c3aed] font-semibold hover:bg-[#f3e8ff] transition-all flex items-center gap-1 shadow-xs"
              >
                <Layers className="w-3.5 h-3.5" />
                Extract Requirements ({extractedRequirements.length})
              </button>
            </div>
          </div>

          {/* Extracted Requirements Review Accordion */}
          {extractedRequirements.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-[#e2e8f0] dark:border-slate-700 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#16a34a]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033] dark:text-slate-300">
                    2. Extracted Requirements ({extractedRequirements.filter(r => !r.excluded).length} Active)
                  </h3>
                </div>
                <button
                  onClick={() => setShowReqReview(!showReqReview)}
                  className="text-xs text-[#64748b] hover:text-[#172033] flex items-center gap-1 font-medium"
                >
                  {showReqReview ? 'Collapse' : 'Expand'}
                  {showReqReview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showReqReview && (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {extractedRequirements.map((req) => (
                    <div
                      key={req.id}
                      className={`p-2.5 rounded-xl border text-xs transition-all ${
                        req.excluded
                          ? 'opacity-50 bg-[#f8fafc] border-dashed border-[#e2e8f0]'
                          : 'bg-white dark:bg-slate-900 border-[#e2e8f0] dark:border-slate-700 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            onClick={() => updateExtractedRequirement(req.id, { excluded: !req.excluded })}
                            className="text-[#64748b] hover:text-[#7c3aed]"
                            title={req.excluded ? 'Include requirement' : 'Exclude requirement'}
                          >
                            {req.excluded ? <Square className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5 text-[#16a34a]" />}
                          </button>
                          <span className="font-mono font-bold text-[#7c3aed]">{req.requirementId}</span>
                          <span className="font-semibold text-[#172033] dark:text-slate-200 truncate">{req.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#e0f2fe] text-[#0ea5e9]">
                            {req.category}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            req.priority === 'Critical' ? 'bg-[#fee2e2] text-[#dc2626]' :
                            req.priority === 'High' ? 'bg-[#fef3c7] text-[#f59e0b]' :
                            'bg-[#dcfce7] text-[#16a34a]'
                          }`}>
                            {req.priority}
                          </span>
                          <button
                            onClick={() => setEditingReq(req)}
                            className="p-1 hover:bg-[#f3e8ff] text-[#7c3aed] rounded"
                            title="Edit requirement"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#64748b] dark:text-slate-400 mt-1 line-clamp-1">{req.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Generate Test Cases by Type Selection Panel */}
          <div className="bg-white dark:bg-slate-800 border border-[#e2e8f0] dark:border-slate-700 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#7c3aed]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033] dark:text-slate-300">
                  3. Generate Test Cases by Type
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllTypes}
                  className="text-xs text-[#7c3aed] font-semibold hover:underline"
                >
                  Select All ({ALL_TEST_CASE_TYPES.length})
                </button>
                <span className="text-[#e2e8f0]">•</span>
                <button
                  onClick={handleClearAllTypes}
                  className="text-xs text-[#64748b] font-semibold hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-[#64748b] font-medium">Presets:</span>
              <button
                onClick={() => handleApplyPreset('smoke')}
                className="text-[11px] px-2 py-0.5 rounded-full bg-[#f8fafc] border border-[#e2e8f0] hover:border-[#7c3aed] text-[#172033] font-medium"
              >
                🔥 Smoke Suite
              </button>
              <button
                onClick={() => handleApplyPreset('regression')}
                className="text-[11px] px-2 py-0.5 rounded-full bg-[#f8fafc] border border-[#e2e8f0] hover:border-[#7c3aed] text-[#172033] font-medium"
              >
                🔄 Regression Suite
              </button>
              <button
                onClick={() => handleApplyPreset('security')}
                className="text-[11px] px-2 py-0.5 rounded-full bg-[#f8fafc] border border-[#e2e8f0] hover:border-[#7c3aed] text-[#172033] font-medium"
              >
                🛡️ Security & Pen-test
              </button>
              <button
                onClick={() => handleApplyPreset('boundary')}
                className="text-[11px] px-2 py-0.5 rounded-full bg-[#f8fafc] border border-[#e2e8f0] hover:border-[#7c3aed] text-[#172033] font-medium"
              >
                📐 Boundary & Edge
              </button>
            </div>

            {/* 23 Test Types Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {ALL_TEST_CASE_TYPES.map((type) => {
                const isSelected = selectedTypes.includes(type.id);
                return (
                  <button
                    key={type.id}
                    onClick={() => handleToggleSelectType(type.id)}
                    className={`flex items-center justify-between p-2 rounded-xl text-left border text-[11px] font-medium transition-all ${
                      isSelected
                        ? 'bg-[#f3e8ff] dark:bg-purple-950/40 border-[#7c3aed] text-[#7c3aed] dark:text-purple-300 font-semibold shadow-2xs'
                        : 'bg-[#f8fafc] dark:bg-slate-900 border-[#e2e8f0] dark:border-slate-700 text-[#64748b] hover:border-[#cbd5e1]'
                    }`}
                  >
                    <span className="truncate">{type.label}</span>
                    {isSelected ? (
                      <Check className="w-3 h-3 text-[#7c3aed] shrink-0" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-[#cbd5e1] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Generation Filters */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#e2e8f0] dark:border-slate-700 text-xs">
              <div>
                <label className="text-[10px] text-[#64748b] uppercase font-semibold block mb-1">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-lg p-1.5 text-xs text-[#172033] dark:text-white"
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical Only</option>
                  <option value="high">High Only</option>
                  <option value="medium">Medium Only</option>
                  <option value="low">Low Only</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[#64748b] uppercase font-semibold block mb-1">Classification</label>
                <select
                  value={classificationFilter}
                  onChange={(e) => setClassificationFilter(e.target.value)}
                  className="w-full bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-lg p-1.5 text-xs text-[#172033] dark:text-white"
                >
                  <option value="both">Both (+ and -)</option>
                  <option value="positive">Positive Only</option>
                  <option value="negative">Negative Only</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[#64748b] uppercase font-semibold block mb-1">Execution</label>
                <select
                  value={automationFilter}
                  onChange={(e) => setAutomationFilter(e.target.value)}
                  className="w-full bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-lg p-1.5 text-xs text-[#172033] dark:text-white"
                >
                  <option value="both">All Feasibilities</option>
                  <option value="automation">Automated Only</option>
                  <option value="manual">Manual Only</option>
                </select>
              </div>
            </div>

            {/* Primary Generation Trigger */}
            <button
              onClick={handleGenerate}
              disabled={isProcessing || !srsText.trim() || selectedTypes.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] hover:from-[#0284c7] hover:to-[#0369a1] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md shadow-sky-600/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                  <span>Generating {selectedTypes.length} Selected Test Types...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate All Selected Types ({selectedTypes.length} Types)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column (7 cols): Test Case Management & Rich Results */}
        <div className="xl:col-span-7 space-y-4">
          {/* Results Summary & Search Bar */}
          <div className="bg-white dark:bg-slate-800 border border-[#e2e8f0] dark:border-slate-700 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#172033] dark:text-white">
                  Generated Test Cases ({filteredCases.length} of {allCases.length})
                </span>
                {allCases.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#dcfce7] text-[#16a34a]">
                    ISTQB Grounded
                  </span>
                )}
              </div>

              {selectedTcIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#7c3aed] font-semibold">{selectedTcIds.size} selected</span>
                  <button
                    onClick={handleBulkDelete}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#fee2e2] text-[#dc2626] hover:bg-red-200"
                  >
                    Delete Selected
                  </button>
                </div>
              )}
            </div>

            {/* Search and Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <div className="relative sm:col-span-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#64748b]" />
                <input
                  type="text"
                  placeholder="Search by TC-ID, title, requirement..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-[#172033] dark:text-white placeholder-[#64748b]"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-xl px-2 py-2 text-xs text-[#172033] dark:text-white"
              >
                <option value="all">All Types</option>
                <option value="Functional">Functional</option>
                <option value="Positive">Positive</option>
                <option value="Negative">Negative</option>
                <option value="Boundary">Boundary</option>
                <option value="Security">Security</option>
                <option value="API">API</option>
                <option value="Regression">Regression</option>
                <option value="Smoke">Smoke</option>
              </select>

              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-xl px-2 py-2 text-xs text-[#172033] dark:text-white"
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <div className="flex gap-1.5 sm:col-span-5 md:col-span-1">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-1/2 bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-xl px-1.5 py-2 text-xs text-[#172033] dark:text-white"
                  title="Execution Status"
                >
                  <option value="all">Status: All</option>
                  <option value="Not Run">Not Run</option>
                  <option value="Pass">Pass</option>
                  <option value="Fail">Fail</option>
                  <option value="Blocked">Blocked</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-1/2 bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-xl px-1.5 py-2 text-xs text-[#172033] dark:text-white"
                >
                  <option value="priority">Priority</option>
                  <option value="id">TC-ID</option>
                  <option value="type">Type</option>
                </select>
              </div>
            </div>
          </div>

          {/* Test Cases List */}
          <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
            {filteredCases.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 border border-[#e2e8f0] dark:border-slate-700 rounded-2xl p-12 text-center">
                <FileText className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
                <h4 className="text-sm font-bold text-[#172033] dark:text-white">No Test Cases to Display</h4>
                <p className="text-xs text-[#64748b] mt-1">
                  Select your test types on the left and click "Generate All Selected Types" to synthesize test cases.
                </p>
              </div>
            ) : (
              filteredCases.map((tc) => {
                const isExpanded = expandedTC === tc.id;
                const isSelected = selectedTcIds.has(tc.testCaseId);

                return (
                  <motion.div
                    key={tc.id}
                    layout
                    className={`bg-white dark:bg-slate-800 border rounded-2xl p-4 transition-all shadow-xs ${
                      isSelected
                        ? 'border-[#7c3aed] ring-1 ring-[#7c3aed]/30'
                        : 'border-[#e2e8f0] dark:border-slate-700 hover:border-[#cbd5e1]'
                    }`}
                  >
                    {/* Top Header Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <button
                          onClick={() => toggleSelectTc(tc.testCaseId)}
                          className="mt-0.5 text-[#64748b] hover:text-[#7c3aed]"
                        >
                          {isSelected ? <CheckSquare className="w-4 h-4 text-[#7c3aed]" /> : <Square className="w-4 h-4" />}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs text-[#7c3aed] bg-[#f3e8ff] dark:bg-purple-950/50 px-2 py-0.5 rounded-md">
                              {tc.testCaseId}
                            </span>
                            <span className="text-[11px] font-mono text-[#64748b] dark:text-slate-400">
                              {tc.requirementId}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              tc.classification === 'Negative'
                                ? 'bg-[#fee2e2] text-[#dc2626]'
                                : 'bg-[#dcfce7] text-[#16a34a]'
                            }`}>
                              {tc.classification || (tc.category === 'negative' ? 'NEGATIVE' : 'POSITIVE')}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#e0f2fe] text-[#0ea5e9]">
                              {tc.testType || tc.category}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-[#172033] dark:text-white mt-1.5 leading-snug">
                            {tc.title || tc.scenario}
                          </h4>
                        </div>
                      </div>

                      {/* Priority and Toggle */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          tc.priority === 'Critical' ? 'bg-[#fee2e2] text-[#dc2626]' :
                          tc.priority === 'High' ? 'bg-[#fef3c7] text-[#f59e0b]' :
                          tc.priority === 'Medium' ? 'bg-[#fff7ed] text-[#f97316]' :
                          'bg-[#dcfce7] text-[#16a34a]'
                        }`}>
                          {tc.priority}
                        </span>

                        <button
                          onClick={() => setExpandedTC(isExpanded ? null : tc.id)}
                          className="p-1 rounded-lg hover:bg-[#f8fafc] text-[#64748b]"
                          title="Expand details"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Preconditions snippet */}
                    <p className="text-xs text-[#64748b] dark:text-slate-400 mt-2 pl-6 line-clamp-2">
                      <strong className="text-[#172033] dark:text-slate-300">Preconditions: </strong>
                      {tc.preconditions}
                    </p>

                    {/* Expandable Section with full details */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t border-[#e2e8f0] dark:border-slate-700 space-y-3 pl-6 text-xs"
                      >
                        {/* Numbered Steps */}
                        <div>
                          <p className="font-bold text-[#172033] dark:text-slate-200 mb-1.5 flex items-center gap-1">
                            Execution Steps ({tc.steps.length}):
                          </p>
                          <div className="space-y-1 bg-[#f8fafc] dark:bg-slate-900 p-3 rounded-xl border border-[#e2e8f0] dark:border-slate-700 font-mono text-[11px]">
                            {tc.steps.map((st, sIdx) => (
                              <div key={sIdx} className="text-[#172033] dark:text-slate-300">
                                {st}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Test Data & Expected Results Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-[#f8fafc] dark:bg-slate-900 p-2.5 rounded-xl border border-[#e2e8f0] dark:border-slate-700">
                            <span className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">
                              Associated Test Data
                            </span>
                            <span className="text-xs text-[#172033] dark:text-slate-200 font-mono">
                              {tc.testData || 'Default compliant inputs'}
                            </span>
                          </div>

                          <div className="bg-[#f8fafc] dark:bg-slate-900 p-2.5 rounded-xl border border-[#e2e8f0] dark:border-slate-700">
                            <span className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">
                              Expected Results
                            </span>
                            <span className="text-xs text-[#16a34a] font-medium">
                              {tc.expectedResults}
                            </span>
                          </div>
                        </div>

                        {/* Automation Metadata */}
                        <div className="flex items-center gap-4 text-[11px] text-[#64748b] flex-wrap">
                          <span>Feasibility: <strong className="text-[#172033]">{tc.automationFeasibility || 'Automated'}</strong></span>
                          <span>Tool: <strong className="text-[#0ea5e9]">{tc.suggestedTool || 'Playwright'}</strong></span>
                          <span>Risk Level: <strong className="text-[#f59e0b]">{tc.riskLevel || 'Medium'}</strong></span>
                          <span>Coverage: <strong className="text-[#16a34a]">{tc.requirementCoverage || 'Full'}</strong></span>
                        </div>
                      </motion.div>
                    )}

                    {/* Bottom Action Footer */}
                    <div className="mt-3 pt-3 border-t border-[#e2e8f0] dark:border-slate-700 flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-2">
                        {/* Connected Workflow: Send to AI Test Data Generator */}
                        <button
                          onClick={() => handleSendToTestDataGen(tc)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f3e8ff] dark:bg-purple-950/40 text-[#7c3aed] font-semibold border border-purple-200 dark:border-purple-800/40 hover:bg-purple-200 transition-colors cursor-pointer"
                          title="Generate context-aware test data for this exact test case"
                        >
                          <FlaskConical className="w-3.5 h-3.5" />
                          <span>Generate Test Data</span>
                        </button>

                        {/* Connected Workflow: Send to Automation Generator */}
                        <button
                          onClick={() => handleSendToScriptGen(tc)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e0f2fe] dark:bg-sky-950/40 text-[#0ea5e9] font-semibold border border-sky-200 dark:border-sky-800/40 hover:bg-sky-200 transition-colors cursor-pointer"
                          title="Generate automation script from this test case"
                        >
                          <Code2 className="w-3.5 h-3.5" />
                          <span>Generate Script</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setInspectingTC(tc)}
                          className="p-1.5 hover:bg-[#f8fafc] text-[#64748b] rounded-lg"
                          title="Inspect all 23 fields"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingTC(tc)}
                          className="p-1.5 hover:bg-[#f8fafc] text-[#7c3aed] rounded-lg"
                          title="Edit test case"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRegenerateSingleTC(tc)}
                          className="p-1.5 hover:bg-[#f8fafc] text-[#0ea5e9] rounded-lg"
                          title="Regenerate single case"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            removeTestCase(tc.testCaseId);
                            toast.success(`Removed ${tc.testCaseId}`);
                          }}
                          className="p-1.5 hover:bg-[#fee2e2] text-[#dc2626] rounded-lg"
                          title="Delete test case"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal: Full 23-Field Inspection Drawer */}
      {inspectingTC && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto space-y-4 border border-[#e2e8f0] dark:border-slate-700"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] dark:border-slate-700">
              <div>
                <span className="font-mono text-xs text-[#7c3aed] font-bold">{inspectingTC.testCaseId}</span>
                <h3 className="text-base font-bold text-[#172033] dark:text-white">{inspectingTC.title || inspectingTC.scenario}</h3>
              </div>
              <button onClick={() => setInspectingTC(null)} className="p-1 hover:bg-[#f8fafc] rounded-lg">
                <X className="w-5 h-5 text-[#64748b]" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700">
                <span className="text-[10px] text-[#64748b] font-bold uppercase block">1. Test Case ID</span>
                <span className="font-mono font-semibold text-[#7c3aed]">{inspectingTC.testCaseId}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700">
                <span className="text-[10px] text-[#64748b] font-bold uppercase block">2. Test Type</span>
                <span className="font-semibold text-[#0ea5e9]">{inspectingTC.testType || inspectingTC.category}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700">
                <span className="text-[10px] text-[#64748b] font-bold uppercase block">3. Related Requirement ID</span>
                <span className="font-mono font-semibold text-[#172033] dark:text-white">{inspectingTC.requirementId}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700">
                <span className="text-[10px] text-[#64748b] font-bold uppercase block">4. Priority & Severity</span>
                <span className="font-semibold text-[#f59e0b]">{inspectingTC.priority} / {inspectingTC.severity || 'Major'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 col-span-2">
                <span className="text-[10px] text-[#64748b] font-bold uppercase block">5. Requirement Description</span>
                <span className="text-[#172033] dark:text-slate-200">{inspectingTC.requirementDescription || 'Specified in active SRS'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 col-span-2">
                <span className="text-[10px] text-[#64748b] font-bold uppercase block">6. Preconditions</span>
                <span className="text-[#172033] dark:text-slate-200">{inspectingTC.preconditions}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 col-span-2">
                <span className="text-[10px] text-[#64748b] font-bold uppercase block">7. Test Steps (Numbered)</span>
                <div className="space-y-1 font-mono text-[11px] mt-1 text-[#172033] dark:text-slate-300">
                  {inspectingTC.steps.map((st, i) => (
                    <div key={i}>{st}</div>
                  ))}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 col-span-2">
                <span className="text-[10px] text-[#64748b] font-bold uppercase block">8. Test Data Parameters</span>
                <span className="font-mono text-[#0ea5e9]">{inspectingTC.testData || 'Valid persona seeds'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 col-span-2">
                <span className="text-[10px] text-[#64748b] font-bold uppercase block">9. Expected Results</span>
                <span className="text-[#16a34a] font-medium">{inspectingTC.expectedResults}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700">
                <span className="text-[10px] text-[#64748b] font-bold uppercase block">10. Automation Feasibility</span>
                <span className="font-semibold text-[#172033] dark:text-white">{inspectingTC.automationFeasibility || 'Automated'} ({inspectingTC.suggestedTool || 'Playwright'})</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700">
                <span className="text-[10px] text-[#64748b] font-bold uppercase block">11. Execution Status</span>
                <span className="font-semibold text-[#64748b]">{inspectingTC.executionStatus || 'Not Run'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  handleSendToTestDataGen(inspectingTC);
                  setInspectingTC(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9]"
              >
                Launch in AI Test Data Generator
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: Edit Test Case */}
      {editingTC && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 border border-[#e2e8f0] dark:border-slate-700"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] dark:border-slate-700">
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">Edit {editingTC.testCaseId}</h3>
              <button onClick={() => setEditingTC(null)}>
                <X className="w-4 h-4 text-[#64748b]" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">Scenario / Title</label>
                <input
                  type="text"
                  value={editingTC.scenario}
                  onChange={(e) => setEditingTC({ ...editingTC, scenario: e.target.value })}
                  className="w-full bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-xl p-2.5 text-xs text-[#172033] dark:text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">Preconditions</label>
                <input
                  type="text"
                  value={editingTC.preconditions}
                  onChange={(e) => setEditingTC({ ...editingTC, preconditions: e.target.value })}
                  className="w-full bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-xl p-2.5 text-xs text-[#172033] dark:text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">Expected Results</label>
                <textarea
                  value={editingTC.expectedResults}
                  onChange={(e) => setEditingTC({ ...editingTC, expectedResults: e.target.value })}
                  className="w-full h-20 bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-xl p-2.5 text-xs text-[#172033] dark:text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">Priority</label>
                  <select
                    value={editingTC.priority}
                    onChange={(e) => setEditingTC({ ...editingTC, priority: e.target.value as any })}
                    className="w-full bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-xl p-2 text-xs text-[#172033] dark:text-white"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">Execution Status</label>
                  <select
                    value={editingTC.executionStatus || 'Not Run'}
                    onChange={(e) => setEditingTC({ ...editingTC, executionStatus: e.target.value as any })}
                    className="w-full bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-xl p-2 text-xs text-[#172033] dark:text-white"
                  >
                    <option value="Not Run">Not Run</option>
                    <option value="Pass">Pass</option>
                    <option value="Fail">Fail</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingTC(null)}
                className="px-4 py-2 rounded-xl border border-[#e2e8f0] text-xs font-semibold text-[#64748b]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateTestCase(editingTC.testCaseId, editingTC);
                  setEditingTC(null);
                  toast.success('Test case updated successfully');
                }}
                className="px-4 py-2 rounded-xl bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9]"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: Compare Two Test Suite Versions (Diff Viewer) */}
      {comparingSuites && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto space-y-4 border border-[#e2e8f0] dark:border-slate-700"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] dark:border-slate-700">
              <div className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-[#7c3aed]" />
                <h3 className="text-sm font-bold text-[#172033] dark:text-white">
                  Test Suite Version Diff (Previous: {previousSuite.length} vs Current: {allCases.length})
                </h3>
              </div>
              <button onClick={() => setComparingSuites(false)}>
                <X className="w-5 h-5 text-[#64748b]" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-[#f8fafc] dark:bg-slate-900 p-4 rounded-xl border border-[#e2e8f0] dark:border-slate-700 space-y-2">
                <h4 className="font-bold text-[#64748b] uppercase text-[11px]">Previous Snapshot Cases</h4>
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {previousSuite.map((tc, idx) => (
                    <div key={idx} className="p-2 rounded bg-white dark:bg-slate-800 border border-[#e2e8f0]">
                      <span className="text-[#64748b] font-bold">{tc.testCaseId}: </span>
                      <span>{tc.scenario}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#f8fafc] dark:bg-slate-900 p-4 rounded-xl border border-[#e2e8f0] dark:border-slate-700 space-y-2">
                <h4 className="font-bold text-[#7c3aed] uppercase text-[11px]">Current Active Suite Cases</h4>
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {allCases.map((tc, idx) => (
                    <div key={idx} className="p-2 rounded bg-white dark:bg-slate-800 border border-[#7c3aed]/30">
                      <span className="text-[#7c3aed] font-bold">{tc.testCaseId}: </span>
                      <span>{tc.scenario}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setComparingSuites(false)}
                className="px-4 py-2 rounded-xl bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9]"
              >
                Close Comparison
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Extracted Requirement Modal */}
      {editingReq && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#e2e8f0] dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] dark:border-slate-700">
              <h3 className="font-bold text-sm text-[#172033] dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#7c3aed]" />
                Edit Extracted Requirement: {editingReq.requirementId}
              </h3>
              <button onClick={() => setEditingReq(null)} className="text-[#64748b] hover:text-[#172033]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#64748b] block mb-1">Requirement Title</label>
                <input
                  type="text"
                  value={editingReq.title}
                  onChange={(e) => setEditingReq({ ...editingReq, title: e.target.value })}
                  className="w-full bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-[#172033] dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748b] block mb-1">Description / Spec Clause</label>
                <textarea
                  value={editingReq.description}
                  onChange={(e) => setEditingReq({ ...editingReq, description: e.target.value })}
                  rows={4}
                  className="w-full bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-xl p-3 text-xs text-[#172033] dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#64748b] block mb-1">Priority</label>
                  <select
                    value={editingReq.priority}
                    onChange={(e) => setEditingReq({ ...editingReq, priority: e.target.value as any })}
                    className="w-full bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-xl p-2 text-xs text-[#172033] dark:text-white"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#64748b] block mb-1">Category</label>
                  <select
                    value={editingReq.category}
                    onChange={(e) => setEditingReq({ ...editingReq, category: e.target.value as any })}
                    className="w-full bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-700 rounded-xl p-2 text-xs text-[#172033] dark:text-white"
                  >
                    <option value="Functional">Functional</option>
                    <option value="Security">Security</option>
                    <option value="Performance">Performance</option>
                    <option value="Integration">Integration</option>
                    <option value="Database">Database</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingReq(null)}
                className="px-3 py-1.5 text-xs text-[#64748b] hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateExtractedRequirement(editingReq.id, editingReq);
                  setEditingReq(null);
                  toast.success(`Updated requirement ${editingReq.requirementId}`);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-[#7c3aed] hover:bg-[#6d28d9] rounded-xl shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
