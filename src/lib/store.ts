import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TestCase, AmbiguityIssue, RiskAssessment, TraceabilityEntry, DuplicatePair, CoverageData, ExtractedRequirement } from './types';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'QA' | 'Viewer';
  profilePicture?: string;
  authProvider?: 'local' | 'google';
  isEmailVerified?: boolean;
  preferences?: {
    theme: 'light' | 'dark';
    notifications: boolean;
    emailNotifications: boolean;
  };
}

export interface SRSHistory {
  id: string;
  title: string;
  srsText: string;
  createdAt: string;
  testCaseCount: number;
  testCasesSnapshot?: TestCase[];
  projectId?: string;
}

interface AppState {
  // Authentication
  user: User | null;
  setUser: (user: User | null) => void;
  token: string | null;
  setToken: (token: string | null) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (val: boolean) => void;

  // UI State
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  activeFeature: string;
  setActiveFeature: (feature: string) => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;

  // SRS Input & Requirements
  srsText: string;
  setSrsText: (text: string) => void;
  extractedRequirements: ExtractedRequirement[];
  setExtractedRequirements: (reqs: ExtractedRequirement[]) => void;
  updateExtractedRequirement: (id: string, updates: Partial<ExtractedRequirement>) => void;

  // Connected Test Case & Test Data workflow
  selectedTestCaseForDataGen: TestCase | null;
  setSelectedTestCaseForDataGen: (tc: TestCase | null) => void;
  activeTestTypes: string[];
  setActiveTestTypes: (types: string[]) => void;

  // SRS History
  srsHistory: SRSHistory[];
  setSrsHistory: (entries: SRSHistory[]) => void;
  addSrsHistory: (entry: SRSHistory) => void;
  removeSrsHistory: (id: string) => void;
  loadSrsHistory: (entry: SRSHistory) => void;
  clearUserScopedData: () => void;

  // Generated Data
  testCases: TestCase[];
  setTestCases: (cases: TestCase[]) => void;
  addTestCases: (cases: TestCase[]) => void;
  updateTestCase: (testCaseId: string, updates: Partial<TestCase>) => void;
  removeTestCase: (testCaseId: string) => void;
  negativeTestCases: TestCase[];
  setNegativeTestCases: (cases: TestCase[]) => void;
  toggleTestCaseCoverage: (testCaseId: string) => void;
  ambiguities: AmbiguityIssue[];
  setAmbiguities: (issues: AmbiguityIssue[]) => void;
  riskAssessment: RiskAssessment | null;
  setRiskAssessment: (risk: RiskAssessment) => void;
  traceability: TraceabilityEntry[];
  setTraceability: (entries: TraceabilityEntry[]) => void;
  duplicates: DuplicatePair[];
  setDuplicates: (pairs: DuplicatePair[]) => void;
  coverage: CoverageData | null;
  setCoverage: (data: CoverageData) => void;

  // Project
  projectId: string;
  setProjectId: (id: string) => void;
  resetProjectData: () => void;

  // Notifications
  showNotification: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Authentication
      user: null,
      setUser: (user) => set({ user }),
      token: null,
      setToken: (token) => set({ token }),
      isAuthenticated: false,
      setIsAuthenticated: (val) => set({ isAuthenticated: val }),

      // UI
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      activeFeature: 'dashboard',
      setActiveFeature: (feature) => set({ activeFeature: feature }),
      isProcessing: false,
      setIsProcessing: (val) => set({ isProcessing: val }),

      // SRS & Requirements
      srsText: '',
      setSrsText: (text) => set({ srsText: text }),
      extractedRequirements: [],
      setExtractedRequirements: (reqs) => set({ extractedRequirements: reqs }),
      updateExtractedRequirement: (id, updates) => set((state) => ({
        extractedRequirements: state.extractedRequirements.map((r) =>
          r.id === id || r.requirementId === id ? { ...r, ...updates } : r
        ),
      })),

      // Connected Workflow Selection
      selectedTestCaseForDataGen: null,
      setSelectedTestCaseForDataGen: (tc) => set({ selectedTestCaseForDataGen: tc }),
      activeTestTypes: ['functional', 'security', 'boundary', 'negative'],
      setActiveTestTypes: (types) => set({ activeTestTypes: types }),

      // SRS History
      srsHistory: [],
      setSrsHistory: (entries) => set({ srsHistory: entries }),
      addSrsHistory: (entry) => set((state) => ({ srsHistory: [entry, ...state.srsHistory.filter((h) => h.id !== entry.id)].slice(0, 50) })),
      removeSrsHistory: (id) => set((state) => ({ srsHistory: state.srsHistory.filter(h => h.id !== id) })),
      loadSrsHistory: (entry) => set({
        srsText: entry.srsText,
        ...(Array.isArray(entry.testCasesSnapshot) && entry.testCasesSnapshot.length
          ? {
              testCases: entry.testCasesSnapshot.filter((tc) => (tc.category || '').toLowerCase() !== 'negative'),
              negativeTestCases: entry.testCasesSnapshot.filter((tc) => (tc.category || '').toLowerCase() === 'negative'),
            }
          : {}),
      }),
      clearUserScopedData: () =>
        set({
          srsHistory: [],
          srsText: '',
          extractedRequirements: [],
          selectedTestCaseForDataGen: null,
          testCases: [],
          negativeTestCases: [],
          ambiguities: [],
          riskAssessment: null,
          traceability: [],
          duplicates: [],
          coverage: null,
        }),

      // Generated Data
      testCases: [],
      setTestCases: (cases) => set({ testCases: cases }),
      addTestCases: (cases) => set((state) => ({ testCases: [...state.testCases, ...cases] })),
      updateTestCase: (testCaseId, updates) => set((state) => ({
        testCases: state.testCases.map((tc) => tc.testCaseId === testCaseId ? { ...tc, ...updates } : tc),
        negativeTestCases: state.negativeTestCases.map((tc) => tc.testCaseId === testCaseId ? { ...tc, ...updates } : tc),
      })),
      removeTestCase: (testCaseId) => set((state) => ({
        testCases: state.testCases.filter(tc => tc.testCaseId !== testCaseId),
        negativeTestCases: state.negativeTestCases.filter(tc => tc.testCaseId !== testCaseId),
        duplicates: state.duplicates.filter(d => d.testCase1Id !== testCaseId && d.testCase2Id !== testCaseId)
      })),
      negativeTestCases: [],
      setNegativeTestCases: (cases) => set({ negativeTestCases: cases }),
      toggleTestCaseCoverage: (testCaseId) => {
        set((state) => {
          const testCases = state.testCases.map(tc => tc.testCaseId === testCaseId ? { ...tc, isCovered: !tc.isCovered } : tc);
          const negativeTestCases = state.negativeTestCases.map(tc => tc.testCaseId === testCaseId ? { ...tc, isCovered: !tc.isCovered } : tc);

          if (state.srsText) {
            import('./ai-engine').then(({ calculateCoverage }) => {
              calculateCoverage(state.srsText, [...testCases, ...negativeTestCases])
                .then(cov => set({ coverage: cov }));
            });
          }

          return { testCases, negativeTestCases };
        });
      },
      ambiguities: [],
      setAmbiguities: (issues) => set({ ambiguities: issues }),
      riskAssessment: null,
      setRiskAssessment: (risk) => set({ riskAssessment: risk }),
      traceability: [],
      setTraceability: (entries) => set({ traceability: entries }),
      duplicates: [],
      setDuplicates: (pairs) => set({ duplicates: pairs }),
      coverage: null,
      setCoverage: (data) => set({ coverage: data }),

      // Project
      projectId: 'default',
      setProjectId: (id) =>
        set((state) => {
          const nextId = id?.trim() || 'default';
          if (state.projectId === nextId) return {};
          return {
            projectId: nextId,
            // Clear per-project data to avoid mixing results between projects
            srsText: '',
            srsHistory: [],
            extractedRequirements: [],
            selectedTestCaseForDataGen: null,
            testCases: [],
            negativeTestCases: [],
            ambiguities: [],
            riskAssessment: null,
            traceability: [],
            duplicates: [],
            coverage: null,
          };
        }),
      resetProjectData: () =>
        set({
          srsText: '',
          extractedRequirements: [],
          selectedTestCaseForDataGen: null,
          testCases: [],
          negativeTestCases: [],
          ambiguities: [],
          riskAssessment: null,
          traceability: [],
          duplicates: [],
          coverage: null,
        }),

      // Notifications
      showNotification: (msg, type) => {
        console.log(`[${type}] ${msg}`);
      },
    }),
    {
      name: 'app-store',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        theme: state.theme,
        projectId: state.projectId,
        // srsHistory is per-user on the server — do not share via localStorage across accounts
      }),
    }
  )
);
