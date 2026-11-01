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
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#F0F9FF]">
      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border-2 border-sky-200">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white shadow-md shadow-sky-500/10">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2 tracking-tight">
              SRS Input & Intelligent Generator
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-black bg-[#FDF2F8] text-[#BE185D] border-2 border-[#FCE7F3]">
                AI-Grounded
              </span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5 font-bold">
              Analyze requirements, select target test categories, and generate comprehensive, grounded test suites with automated traceability.
            </p>
          </div>
        </div>

        {/* Global Toolbar buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {allCases.length > 0 && previousSuite.length > 0 && (
            <button
              onClick={() => setComparingSuites(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-black rounded-xl bg-white border-2 border-purple-200 text-[#7C3AED] hover:border-[#8B5CF6] transition-colors shadow-xs cursor-pointer"
            >
              <GitCompare className="w-3.5 h-3.5 text-[#8B5CF6]" />
              Compare Versions ({previousSuite.length} vs {allCases.length})
            </button>
          )}

          {allCases.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-black rounded-xl bg-[#DCFCE7] text-[#16A34A] border-2 border-emerald-300 hover:opacity-90 transition-all shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel (.xlsx)
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-black rounded-xl bg-[#E0F2FE] text-[#0284C7] border-2 border-sky-300 hover:opacity-90 transition-all shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-black rounded-xl bg-[#F3E8FF] text-[#7C3AED] border-2 border-purple-300 hover:opacity-90 transition-all shadow-xs cursor-pointer"
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
          <div className="bg-white border-2 border-sky-300 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#0EA5E9]" />
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
                  className="text-xs text-[#0284C7] hover:underline font-black flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload PDF/TXT
                </button>
              </div>
            </div>

            <textarea
              value={srsText}
              onChange={(e) => setSrsText(e.target.value)}
              placeholder="Paste your Software Requirement Specification (SRS) or User Stories here...&#10;&#10;Example:&#10;REQ-001: The system shall allow users to register with email and password...&#10;REQ-002: User login must lock account after 5 failed attempts..."
              className="w-full h-44 bg-[#F8FCFF] border-2 border-sky-100 rounded-xl p-3.5 text-xs text-[#0F172A] placeholder-[#64748B]/70 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] font-mono font-medium leading-relaxed resize-none"
            />

            {/* Presets & Quick Actions */}
            <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-[#64748B] font-extrabold uppercase">Sample:</span>
                <button
                  type="button"
                  onClick={() => { setSrsText(SAMPLE_SRS); handleExtractRequirements(SAMPLE_SRS); }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-[#FAF5FF] border-2 border-purple-200 text-[#7C3AED] font-black hover:border-[#8B5CF6] transition-colors cursor-pointer"
                >
                  Enterprise Auth & Admin
                </button>
                <button
                  type="button"
                  onClick={() => { setSrsText(ECOMMERCE_SRS); handleExtractRequirements(ECOMMERCE_SRS); }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-[#F0F9FF] border-2 border-sky-200 text-[#0284C7] font-black hover:border-[#0EA5E9] transition-colors cursor-pointer"
                >
                  E-Commerce & Checkout
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleExtractRequirements()}
                className="text-xs px-3.5 py-1.5 rounded-xl bg-white border-2 border-purple-300 text-[#7C3AED] font-black hover:bg-[#FAF5FF] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                Extract Requirements ({extractedRequirements.length})
              </button>
            </div>
          </div>

          {/* Extracted Requirements Review Accordion */}
          {extractedRequirements.length > 0 && (
            <div className="bg-white border-2 border-purple-200 rounded-2xl p-4.5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#16A34A]" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A]">
                    2. Extracted Requirements ({extractedRequirements.filter(r => !r.excluded).length} Active)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReqReview(!showReqReview)}
                  className="text-xs text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 font-black cursor-pointer"
                >
                  {showReqReview ? 'Collapse' : 'Expand'}
                  {showReqReview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {showReqReview && (
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {extractedRequirements.map((req) => (
                    <div
                      key={req.id}
                      className={`p-3 rounded-xl border-2 text-xs transition-all ${
                        req.excluded
                          ? 'opacity-50 bg-[#F8FAFC] border-dashed border-[#CBD5E1]'
                          : 'bg-white border-slate-200 hover:border-purple-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => updateExtractedRequirement(req.id, { excluded: !req.excluded })}
                            className="text-[#64748B] hover:text-[#8B5CF6] cursor-pointer"
                            title={req.excluded ? 'Include requirement' : 'Exclude requirement'}
                          >
                            {req.excluded ? <Square className="w-4 h-4" /> : <CheckSquare className="w-4 h-4 text-[#16A34A]" />}
                          </button>
                          <span className="font-mono font-black text-[#7C3AED] bg-purple-50 px-2 py-0.5 rounded border border-purple-200">{req.requirementId}</span>
                          <span className="font-black text-[#0F172A] truncate text-xs">{req.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#E0F2FE] text-[#0284C7] border border-sky-200">
                            {req.category}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                            req.priority === 'Critical' ? 'bg-[#FDF2F8] text-[#BE185D] border-pink-200' :
                            req.priority === 'High' ? 'bg-[#FEF3C7] text-[#D97706] border-amber-200' :
                            'bg-[#DCFCE7] text-[#16A34A] border-emerald-200'
                          }`}>
                            {req.priority}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingReq(req)}
                            className="p-1 hover:bg-[#F3E8FF] text-[#7C3AED] rounded-lg transition-colors cursor-pointer"
                            title="Edit requirement"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#64748B] font-medium mt-1.5 line-clamp-1">{req.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Generate Test Cases by Type Selection Panel */}
          <div className="bg-white border-2 border-purple-300 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A]">
                  3. Generate Test Cases by Type
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllTypes}
                  className="text-xs text-[#8B5CF6] font-black hover:underline cursor-pointer"
                >
                  Select All ({ALL_TEST_CASE_TYPES.length})
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleClearAllTypes}
                  className="text-xs text-[#64748B] font-black hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#64748B] font-extrabold">Presets:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset('smoke')}
                className="text-xs px-3 py-1 rounded-full bg-[#FDF2F8] border-2 border-[#FCE7F3] hover:border-[#EC4899] text-[#BE185D] font-black transition-colors cursor-pointer"
              >
                🔥 Smoke Suite
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('regression')}
                className="text-xs px-3 py-1 rounded-full bg-[#F0F9FF] border-2 border-[#E0F2FE] hover:border-[#0EA5E9] text-[#0284C7] font-black transition-colors cursor-pointer"
              >
                🔄 Regression Suite
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('security')}
                className="text-xs px-3 py-1 rounded-full bg-[#FAF5FF] border-2 border-[#EDE9FE] hover:border-[#8B5CF6] text-[#7C3AED] font-black transition-colors cursor-pointer"
              >
                🛡️ Security & Auth
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('boundary')}
                className="text-xs px-3 py-1 rounded-full bg-[#FDF2F8] border-2 border-[#FCE7F3] hover:border-[#EC4899] text-[#BE185D] font-black transition-colors cursor-pointer"
              >
                📐 Boundary & Edge
              </button>
            </div>

            {/* 23 Test Types Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {ALL_TEST_CASE_TYPES.map((type) => {
                const isSelected = selectedTypes.includes(type.id);
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleToggleSelectType(type.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-left border-2 text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#FAF5FF] border-[#8B5CF6] text-[#7C3AED] font-black shadow-xs'
                        : 'bg-white border-[#E2E8F0] text-slate-700 hover:border-sky-300 font-bold'
                    }`}
                  >
                    <span className="truncate">{type.label}</span>
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-[#CBD5E1] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Generation Filters */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#E2E8F0] text-xs">
              <div>
                <label className="text-[11px] text-[#64748B] uppercase font-black block mb-1">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full bg-white border-2 border-[#CBD5E1] rounded-xl p-2 text-xs text-[#0F172A] font-bold focus:border-[#0EA5E9]"
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical Only</option>
                  <option value="high">High Only</option>
                  <option value="medium">Medium Only</option>
                  <option value="low">Low Only</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[#64748B] uppercase font-black block mb-1">Classification</label>
                <select
                  value={classificationFilter}
                  onChange={(e) => setClassificationFilter(e.target.value)}
                  className="w-full bg-white border-2 border-[#CBD5E1] rounded-xl p-2 text-xs text-[#0F172A] font-bold focus:border-[#0EA5E9]"
                >
                  <option value="both">Both (+ and -)</option>
                  <option value="positive">Positive Only</option>
                  <option value="negative">Negative Only</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[#64748B] uppercase font-black block mb-1">Execution</label>
                <select
                  value={automationFilter}
                  onChange={(e) => setAutomationFilter(e.target.value)}
                  className="w-full bg-white border-2 border-[#CBD5E1] rounded-xl p-2 text-xs text-[#0F172A] font-bold focus:border-[#0EA5E9]"
                >
                  <option value="both">All Feasibilities</option>
                  <option value="automation">Automated Only</option>
                  <option value="manual">Manual Only</option>
                </select>
              </div>
            </div>

            {/* Primary Generation Trigger with Gradient */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isProcessing || !srsText.trim() || selectedTypes.length === 0}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] hover:opacity-95 text-white font-black text-sm py-4 px-6 rounded-2xl transition-all shadow-md shadow-sky-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full"
                  />
                  <span>Generating {selectedTypes.length} Selected Test Types...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4.5 h-4.5" />
                  <span>Generate All Selected Test Cases ({selectedTypes.length} Types)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column (7 cols): Test Case Management & Rich Results */}
        <div className="xl:col-span-7 space-y-4">
          {/* Results Summary & Search Bar */}
          <div className="bg-white border-2 border-sky-200 rounded-2xl p-4.5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-black text-base text-[#0F172A]">
                  Generated Test Cases ({filteredCases.length} of {allCases.length})
                </span>
                {allCases.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#DCFCE7] text-[#16A34A] border border-emerald-200">
                    ISTQB Grounded
                  </span>
                )}
              </div>

              {selectedTcIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#7C3AED] font-black">{selectedTcIds.size} selected</span>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="px-3 py-1 text-xs font-black rounded-xl bg-[#FDF2F8] text-[#BE185D] border border-pink-200 hover:bg-pink-100 cursor-pointer"
                  >
                    Delete Selected
                  </button>
                </div>
              )}
            </div>

            {/* Search and Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
                <input
                  type="text"
                  placeholder="Search by TC-ID, title, requirement..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#F8FCFF] border-2 border-slate-200 focus:border-[#0EA5E9] rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-[#0F172A] placeholder-[#64748B]/70 outline-none"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-[#F8FCFF] border-2 border-slate-200 focus:border-[#0EA5E9] rounded-xl px-2.5 py-2 text-xs font-bold text-[#0F172A] outline-none"
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
                className="bg-[#F8FCFF] border-2 border-slate-200 focus:border-[#0EA5E9] rounded-xl px-2.5 py-2 text-xs font-bold text-[#0F172A] outline-none"
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
                  className="w-1/2 bg-[#F8FCFF] border-2 border-slate-200 focus:border-[#0EA5E9] rounded-xl px-1.5 py-2 text-xs font-bold text-[#0F172A] outline-none"
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
                  className="w-1/2 bg-[#F8FCFF] border-2 border-slate-200 focus:border-[#0EA5E9] rounded-xl px-1.5 py-2 text-xs font-bold text-[#0F172A] outline-none"
                >
                  <option value="priority">Priority</option>
                  <option value="id">TC-ID</option>
                  <option value="type">Type</option>
                </select>
              </div>
            </div>
          </div>

          {/* Test Cases List */}
          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {filteredCases.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-sky-300 rounded-2xl p-12 text-center shadow-xs">
                <FileText className="w-12 h-12 text-sky-400 mx-auto mb-3" />
                <h4 className="text-base font-black text-[#0F172A]">No Test Cases to Display</h4>
                <p className="text-xs text-[#64748B] font-bold mt-1 max-w-sm mx-auto">
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
                    className={`bg-white border-2 rounded-2xl p-4.5 transition-all shadow-xs ${
                      isSelected
                        ? 'border-[#8B5CF6] ring-2 ring-[#8B5CF6]/30 shadow-md'
                        : 'border-slate-200 hover:border-[#0EA5E9] hover:shadow-sm'
                    }`}
                  >
                    {/* Top Header Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleSelectTc(tc.testCaseId)}
                          className="mt-0.5 text-[#64748B] hover:text-[#8B5CF6] cursor-pointer"
                        >
                          {isSelected ? <CheckSquare className="w-4.5 h-4.5 text-[#8B5CF6]" /> : <Square className="w-4.5 h-4.5" />}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-xs text-[#7C3AED] bg-[#FAF5FF] border border-purple-200 px-2.5 py-0.5 rounded-lg">
                              {tc.testCaseId}
                            </span>
                            <span className="text-xs font-mono font-bold text-[#64748B]">
                              {tc.requirementId}
                            </span>
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                              tc.classification === 'Negative'
                                ? 'bg-[#FDF2F8] text-[#BE185D] border-pink-200'
                                : 'bg-[#DCFCE7] text-[#16A34A] border-emerald-200'
                            }`}>
                              {tc.classification || (tc.category === 'negative' ? 'NEGATIVE' : 'POSITIVE')}
                            </span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-[#E0F2FE] text-[#0284C7] border border-sky-200">
                              {tc.testType || tc.category}
                            </span>
                          </div>

                          <h4 className="text-base font-black text-[#0F172A] mt-2 leading-snug">
                            {tc.title || tc.scenario}
                          </h4>
                        </div>
                      </div>

                      {/* Priority and Toggle */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg border ${
                          tc.priority === 'Critical' ? 'bg-[#FDF2F8] text-[#BE185D] border-pink-300' :
                          tc.priority === 'High' ? 'bg-[#FEF3C7] text-[#D97706] border-amber-300' :
                          tc.priority === 'Medium' ? 'bg-[#FFF7ED] text-[#EA580C] border-orange-200' :
                          'bg-[#DCFCE7] text-[#16A34A] border-emerald-300'
                        }`}>
                          {tc.priority}
                        </span>

                        <button
                          type="button"
                          onClick={() => setExpandedTC(isExpanded ? null : tc.id)}
                          className="p-1 rounded-lg hover:bg-slate-100 text-[#64748B] transition-colors cursor-pointer"
                          title="Expand details"
                        >
                          {isExpanded ? <ChevronUp className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Preconditions snippet */}
                    <p className="text-xs text-[#64748B] mt-2.5 pl-7.5 line-clamp-2">
                      <strong className="text-[#0F172A] font-black">Preconditions: </strong>
                      <span className="font-medium text-slate-700">{tc.preconditions}</span>
                    </p>

                    {/* Expandable Section with full details */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t-2 border-slate-100 space-y-3 pl-7.5 text-xs"
                      >
                        {/* Numbered Steps */}
                        <div>
                          <p className="font-black text-xs text-[#0F172A] mb-1.5 flex items-center gap-1">
                            Execution Steps ({tc.steps.length}):
                          </p>
                          <div className="space-y-1.5 bg-[#F8FCFF] p-3.5 rounded-xl border-2 border-sky-100 font-mono text-xs">
                            {tc.steps.map((st, sIdx) => (
                              <div key={sIdx} className="text-[#0F172A] font-medium">
                                {st}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Test Data & Expected Results Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-[#FAF5FF] p-3 rounded-xl border-2 border-purple-200">
                            <span className="text-[10px] font-black uppercase text-[#7C3AED] block mb-1">
                              Associated Test Data
                            </span>
                            <span className="text-xs text-[#0F172A] font-mono font-bold">
                              {tc.testData || 'Default compliant inputs'}
                            </span>
                          </div>

                          <div className="bg-[#F0FDF4] p-3 rounded-xl border-2 border-emerald-200">
                            <span className="text-[10px] font-black uppercase text-[#16A34A] block mb-1">
                              Expected Results
                            </span>
                            <span className="text-xs text-[#16A34A] font-bold">
                              {tc.expectedResults}
                            </span>
                          </div>
                        </div>

                        {/* Automation Metadata */}
                        <div className="flex items-center gap-4 text-xs text-[#64748B] font-bold flex-wrap pt-1">
                          <span>Feasibility: <strong className="text-[#0F172A] font-black">{tc.automationFeasibility || 'Automated'}</strong></span>
                          <span>Tool: <strong className="text-[#0284C7] font-black">{tc.suggestedTool || 'Playwright'}</strong></span>
                          <span>Risk Level: <strong className="text-[#D97706] font-black">{tc.riskLevel || 'Medium'}</strong></span>
                          <span>Coverage: <strong className="text-[#16A34A] font-black">{tc.requirementCoverage || 'Full'}</strong></span>
                        </div>
                      </motion.div>
                    )}

                    {/* Bottom Action Footer */}
                    <div className="mt-3.5 pt-3 border-t-2 border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-2">
                        {/* Connected Workflow: Send to AI Test Data Generator */}
                        <button
                          type="button"
                          onClick={() => handleSendToTestDataGen(tc)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF5FF] text-[#7C3AED] font-black border-2 border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
                          title="Generate context-aware test data for this exact test case"
                        >
                          <FlaskConical className="w-3.5 h-3.5" />
                          <span>Generate Test Data</span>
                        </button>

                        {/* Connected Workflow: Send to Automation Generator */}
                        <button
                          type="button"
                          onClick={() => handleSendToScriptGen(tc)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0F9FF] text-[#0284C7] font-black border-2 border-sky-200 hover:bg-sky-100 transition-colors cursor-pointer"
                          title="Generate automation script from this test case"
                        >
                          <Code2 className="w-3.5 h-3.5" />
                          <span>Generate Script</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectingTC(tc)}
                          className="p-1.5 hover:bg-slate-100 text-[#64748B] rounded-lg cursor-pointer"
                          title="Inspect all 23 fields"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTC(tc)}
                          className="p-1.5 hover:bg-purple-50 text-[#7C3AED] rounded-lg cursor-pointer"
                          title="Edit test case"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRegenerateSingleTC(tc)}
                          className="p-1.5 hover:bg-sky-50 text-[#0284C7] rounded-lg cursor-pointer"
                          title="Regenerate single case"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            removeTestCase(tc.testCaseId);
                            toast.success(`Removed ${tc.testCaseId}`);
                          }}
                          className="p-1.5 hover:bg-pink-50 text-[#BE185D] rounded-lg cursor-pointer"
                          title="Delete test case"
                        >
                          <Trash2 className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 border-2 border-purple-200"
          >
            <div className="flex items-center justify-between pb-3 border-b-2 border-purple-100">
              <div>
                <span className="font-mono text-xs text-[#7C3AED] font-black bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200">{inspectingTC.testCaseId}</span>
                <h3 className="text-base font-black text-[#0F172A] mt-1">{inspectingTC.title || inspectingTC.scenario}</h3>
              </div>
              <button type="button" onClick={() => setInspectingTC(null)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
                <X className="w-5 h-5 text-[#64748B]" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#F8FCFF] border-2 border-slate-200">
                <span className="text-[10px] text-[#64748B] font-black uppercase block mb-0.5">1. Test Case ID</span>
                <span className="font-mono font-black text-[#7C3AED]">{inspectingTC.testCaseId}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FCFF] border-2 border-slate-200">
                <span className="text-[10px] text-[#64748B] font-black uppercase block mb-0.5">2. Test Type</span>
                <span className="font-black text-[#0284C7]">{inspectingTC.testType || inspectingTC.category}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FCFF] border-2 border-slate-200">
                <span className="text-[10px] text-[#64748B] font-black uppercase block mb-0.5">3. Related Requirement ID</span>
                <span className="font-mono font-black text-[#0F172A]">{inspectingTC.requirementId}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FCFF] border-2 border-slate-200">
                <span className="text-[10px] text-[#64748B] font-black uppercase block mb-0.5">4. Priority & Severity</span>
                <span className="font-black text-[#D97706]">{inspectingTC.priority} / {inspectingTC.severity || 'Major'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FCFF] border-2 border-slate-200 col-span-2">
                <span className="text-[10px] text-[#64748B] font-black uppercase block mb-0.5">5. Requirement Description</span>
                <span className="text-[#0F172A] font-bold">{inspectingTC.requirementDescription || 'Specified in active SRS'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FCFF] border-2 border-slate-200 col-span-2">
                <span className="text-[10px] text-[#64748B] font-black uppercase block mb-0.5">6. Preconditions</span>
                <span className="text-[#0F172A] font-bold">{inspectingTC.preconditions}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FCFF] border-2 border-slate-200 col-span-2">
                <span className="text-[10px] text-[#64748B] font-black uppercase block mb-0.5">7. Test Steps (Numbered)</span>
                <div className="space-y-1 font-mono text-xs mt-1 text-[#0F172A] font-medium">
                  {inspectingTC.steps.map((st, i) => (
                    <div key={i}>{st}</div>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FCFF] border-2 border-slate-200 col-span-2">
                <span className="text-[10px] text-[#64748B] font-black uppercase block mb-0.5">8. Test Data Parameters</span>
                <span className="font-mono text-[#0284C7] font-black">{inspectingTC.testData || 'Valid persona seeds'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FCFF] border-2 border-slate-200 col-span-2">
                <span className="text-[10px] text-[#64748B] font-black uppercase block mb-0.5">9. Expected Results</span>
                <span className="text-[#16A34A] font-black">{inspectingTC.expectedResults}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FCFF] border-2 border-slate-200">
                <span className="text-[10px] text-[#64748B] font-black uppercase block mb-0.5">10. Automation Feasibility</span>
                <span className="font-black text-[#0F172A]">{inspectingTC.automationFeasibility || 'Automated'} ({inspectingTC.suggestedTool || 'Playwright'})</span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FCFF] border-2 border-slate-200">
                <span className="text-[10px] text-[#64748B] font-black uppercase block mb-0.5">11. Execution Status</span>
                <span className="font-black text-[#64748B]">{inspectingTC.executionStatus || 'Not Run'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleSendToTestDataGen(inspectingTC);
                  setInspectingTC(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#0EA5E9] text-white text-xs font-black hover:opacity-95 shadow-md shadow-purple-500/20 cursor-pointer"
              >
                Launch in AI Test Data Generator
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: Edit Test Case */}
      {editingTC && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 border-2 border-purple-200"
          >
            <div className="flex items-center justify-between pb-3 border-b-2 border-purple-100">
              <h3 className="text-base font-black text-[#0F172A]">Edit {editingTC.testCaseId}</h3>
              <button type="button" onClick={() => setEditingTC(null)} className="cursor-pointer">
                <X className="w-5 h-5 text-[#64748B]" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-black uppercase text-[#64748B] block mb-1">Scenario / Title</label>
                <input
                  type="text"
                  value={editingTC.scenario}
                  onChange={(e) => setEditingTC({ ...editingTC, scenario: e.target.value })}
                  className="w-full bg-[#F8FCFF] border-2 border-slate-200 focus:border-[#0EA5E9] rounded-xl p-3 text-xs font-bold text-[#0F172A] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-[#64748B] block mb-1">Preconditions</label>
                <input
                  type="text"
                  value={editingTC.preconditions}
                  onChange={(e) => setEditingTC({ ...editingTC, preconditions: e.target.value })}
                  className="w-full bg-[#F8FCFF] border-2 border-slate-200 focus:border-[#0EA5E9] rounded-xl p-3 text-xs font-bold text-[#0F172A] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-[#64748B] block mb-1">Expected Results</label>
                <textarea
                  value={editingTC.expectedResults}
                  onChange={(e) => setEditingTC({ ...editingTC, expectedResults: e.target.value })}
                  className="w-full h-20 bg-[#F8FCFF] border-2 border-slate-200 focus:border-[#0EA5E9] rounded-xl p-3 text-xs font-bold text-[#0F172A] resize-none outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black uppercase text-[#64748B] block mb-1">Priority</label>
                  <select
                    value={editingTC.priority}
                    onChange={(e) => setEditingTC({ ...editingTC, priority: e.target.value as any })}
                    className="w-full bg-[#F8FCFF] border-2 border-slate-200 rounded-xl p-2.5 text-xs font-bold text-[#0F172A] outline-none"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase text-[#64748B] block mb-1">Execution Status</label>
                  <select
                    value={editingTC.executionStatus || 'Not Run'}
                    onChange={(e) => setEditingTC({ ...editingTC, executionStatus: e.target.value as any })}
                    className="w-full bg-[#F8FCFF] border-2 border-slate-200 rounded-xl p-2.5 text-xs font-bold text-[#0F172A] outline-none"
                  >
                    <option value="Not Run">Not Run</option>
                    <option value="Pass">Pass</option>
                    <option value="Fail">Fail</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingTC(null)}
                className="px-4 py-2 rounded-xl border-2 border-slate-200 text-xs font-black text-[#64748B] hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  updateTestCase(editingTC.testCaseId, editingTC);
                  setEditingTC(null);
                  toast.success('Test case updated successfully');
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#8B5CF6] text-white text-xs font-black hover:opacity-95 shadow-md shadow-sky-500/20 cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: Compare Two Test Suite Versions (Diff Viewer) */}
      {comparingSuites && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 border-2 border-purple-200"
          >
            <div className="flex items-center justify-between pb-3 border-b-2 border-purple-100">
              <div className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-[#8B5CF6]" />
                <h3 className="text-base font-black text-[#0F172A]">
                  Test Suite Version Diff (Previous: {previousSuite.length} vs Current: {allCases.length})
                </h3>
              </div>
              <button type="button" onClick={() => setComparingSuites(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-[#64748B]" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-[#F8FCFF] p-4 rounded-xl border-2 border-slate-200 space-y-2">
                <h4 className="font-black text-[#64748B] uppercase text-xs">Previous Snapshot Cases</h4>
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {previousSuite.map((tc, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-white border-2 border-slate-200 text-xs font-bold text-[#0F172A]">
                      <span className="text-[#64748B] font-black">{tc.testCaseId}: </span>
                      <span>{tc.scenario}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#FAF5FF] p-4 rounded-xl border-2 border-purple-200 space-y-2">
                <h4 className="font-black text-[#7C3AED] uppercase text-xs">Current Active Suite Cases</h4>
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {allCases.map((tc, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-white border-2 border-purple-300 text-xs font-bold text-[#0F172A]">
                      <span className="text-[#7C3AED] font-black">{tc.testCaseId}: </span>
                      <span>{tc.scenario}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setComparingSuites(false)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#0EA5E9] text-white text-xs font-black hover:opacity-95 shadow-md shadow-purple-500/20 cursor-pointer"
              >
                Close Comparison
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Extracted Requirement Modal */}
      {editingReq && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border-2 border-purple-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-purple-100">
              <h3 className="font-black text-base text-[#0F172A] flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#8B5CF6]" />
                Edit Extracted Requirement: {editingReq.requirementId}
              </h3>
              <button type="button" onClick={() => setEditingReq(null)} className="text-[#64748B] hover:text-[#0F172A] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-black uppercase text-[#64748B] block mb-1">Requirement Title</label>
                <input
                  type="text"
                  value={editingReq.title}
                  onChange={(e) => setEditingReq({ ...editingReq, title: e.target.value })}
                  className="w-full bg-[#F8FCFF] border-2 border-slate-200 focus:border-[#0EA5E9] rounded-xl px-3 py-2 text-xs font-bold text-[#0F172A] outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-black uppercase text-[#64748B] block mb-1">Description / Spec Clause</label>
                <textarea
                  value={editingReq.description}
                  onChange={(e) => setEditingReq({ ...editingReq, description: e.target.value })}
                  rows={4}
                  className="w-full bg-[#F8FCFF] border-2 border-slate-200 focus:border-[#0EA5E9] rounded-xl p-3 text-xs font-bold text-[#0F172A] outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black uppercase text-[#64748B] block mb-1">Priority</label>
                  <select
                    value={editingReq.priority}
                    onChange={(e) => setEditingReq({ ...editingReq, priority: e.target.value as any })}
                    className="w-full bg-[#F8FCFF] border-2 border-slate-200 rounded-xl p-2.5 text-xs font-bold text-[#0F172A] outline-none"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-[#64748B] block mb-1">Category</label>
                  <select
                    value={editingReq.category}
                    onChange={(e) => setEditingReq({ ...editingReq, category: e.target.value as any })}
                    className="w-full bg-[#F8FCFF] border-2 border-slate-200 rounded-xl p-2.5 text-xs font-bold text-[#0F172A] outline-none"
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
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingReq(null)}
                className="px-4 py-2 text-xs font-black text-[#64748B] hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  updateExtractedRequirement(editingReq.id, editingReq);
                  setEditingReq(null);
                  toast.success(`Updated requirement ${editingReq.requirementId}`);
                }}
                className="px-5 py-2 text-xs font-black text-white bg-gradient-to-r from-[#8B5CF6] to-[#0EA5E9] hover:opacity-95 rounded-xl shadow-md shadow-purple-500/20 cursor-pointer"
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
