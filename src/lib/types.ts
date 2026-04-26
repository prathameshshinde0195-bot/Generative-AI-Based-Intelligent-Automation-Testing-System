export interface TestCase {
  id: string;
  testCaseId: string;
  scenario: string;
  preconditions: string;
  steps: string[];
  expectedResults: string;
  priority: 'High' | 'Medium' | 'Low';
  riskScore: number;
  requirementId: string;
  category: 'functional' | 'negative' | 'edge' | 'security' | 'boundary';
  tags: string[];
  createdAt: string;
  isCovered?: boolean;
}

export interface AmbiguityIssue {
  id: string;
  phrase: string;
  reason: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
  lineNumber: number;
}

export interface RiskAssessment {
  securityRisk: number;
  performanceRisk: number;
  functionalRisk: number;
  overallScore: number;
  factors: string[];
}

export interface TraceabilityEntry {
  requirementId: string;
  requirementText: string;
  testCaseIds: string[];
  coverage: number;
}

export interface DuplicatePair {
  testCase1Id: string;
  testCase2Id: string;
  similarity: number;
  reason: string;
}

export interface CoverageData {
  totalRequirements: number;
  coveredRequirements: number;
  coveragePercentage: number;
  missingRequirements: string[];
  categoryBreakdown: { category: string; count: number; percentage: number }[];
}

export type AutomationFramework = 'selenium-java' | 'selenium-python' | 'cypress' | 'playwright';

export interface GeneratedScript {
  framework: AutomationFramework;
  testCaseId: string;
  code: string;
  language: string;
}
