export interface TestCase {
  id: string;
  testCaseId: string;
  title?: string;
  scenario: string;
  description?: string;
  requirementId: string;
  requirementDescription?: string;
  preconditions: string;
  steps: string[];
  testData?: string;
  expectedResults: string;
  actualResults?: string;
  priority: 'High' | 'Medium' | 'Low' | 'Critical';
  severity?: 'Blocker' | 'Critical' | 'Major' | 'Minor' | 'Trivial';
  testType?: string;
  category: 'functional' | 'negative' | 'edge' | 'security' | 'boundary' | 'performance' | 'integration' | string;
  executionStatus?: 'Not Run' | 'Pass' | 'Fail' | 'Blocked';
  classification?: 'Positive' | 'Negative';
  automationFeasibility?: 'Automated' | 'Feasible' | 'Manual Only';
  suggestedTool?: 'Playwright' | 'Cypress' | 'Selenium' | 'Postman' | 'Jest';
  riskScore: number;
  riskLevel?: 'Critical' | 'High' | 'Medium' | 'Low';
  requirementCoverage?: 'Full' | 'Partial';
  dependencies?: string[] | string;
  assumptions?: string;
  tags: string[];
  createdAt: string;
  status?: 'Draft' | 'Active' | 'Automated' | 'Deprecated';
  isCovered?: boolean;
}

export interface ExtractedRequirement {
  id: string;
  requirementId: string;
  title: string;
  description: string;
  category: 'Functional' | 'Non-Functional' | 'Security' | 'Performance' | 'Usability' | 'Business Rule';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  userRole?: string;
  inputs?: string[];
  outputs?: string[];
  validationRules?: string[];
  approved: boolean;
  excluded: boolean;
}

export interface StructuredTestDataItem {
  testDataId: string;
  relatedTestCaseId: string;
  fieldName: string;
  value: string;
  category: string;
  expectedValidation: string;
  expectedOutcome: string;
  boundaryClassification?: string;
  requirementReference?: string;
}

export interface AmbiguityIssue {
  id: string;
  phrase: string;
  reason: string;
  suggestion: string;
  rewrittenRequirement?: string;
  category?: 'Vague language' | 'Missing measurable criteria' | 'Incomplete conditions' | 'Conflicting requirements' | 'Missing error handling' | 'Missing security constraints' | 'Unclear performance expectations';
  confidenceScore?: number;
  resolved?: boolean;
  severity: 'high' | 'medium' | 'low';
  lineNumber: number;
}

export interface RiskAssessment {
  securityRisk: number;
  performanceRisk: number;
  functionalRisk: number;
  overallScore: number;
  factors: string[];
  mitigations?: { factor: string; recommendation: string; priority: 'Critical' | 'High' | 'Medium' | 'Low' }[];
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
  suggestedMergedCase?: Partial<TestCase>;
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
  runHints?: string[];
  fileName?: string;
}

