import { v4 as uuidv4 } from 'uuid';
import type { TestCase, AmbiguityIssue, RiskAssessment, TraceabilityEntry, DuplicatePair, CoverageData, AutomationFramework, GeneratedScript, ExtractedRequirement } from './types';
import { generateExecutableAutomationScript } from './automation-codegen';

export const ALL_TEST_CASE_TYPES = [
  { id: 'functional', label: 'Functional Test Cases', category: 'functional', defaultClassification: 'Positive' as const, suggestedTool: 'Playwright' as const },
  { id: 'positive', label: 'Positive Test Cases', category: 'functional', defaultClassification: 'Positive' as const, suggestedTool: 'Playwright' as const },
  { id: 'negative', label: 'Negative Test Cases', category: 'negative', defaultClassification: 'Negative' as const, suggestedTool: 'Cypress' as const },
  { id: 'boundary', label: 'Boundary Value Analysis', category: 'boundary', defaultClassification: 'Negative' as const, suggestedTool: 'Playwright' as const },
  { id: 'equivalence', label: 'Equivalence Partitioning', category: 'boundary', defaultClassification: 'Positive' as const, suggestedTool: 'Playwright' as const },
  { id: 'validation', label: 'Validation Test Cases', category: 'functional', defaultClassification: 'Negative' as const, suggestedTool: 'Playwright' as const },
  { id: 'ui_ux', label: 'UI/UX Test Cases', category: 'functional', defaultClassification: 'Positive' as const, suggestedTool: 'Cypress' as const },
  { id: 'integration', label: 'Integration Test Cases', category: 'integration', defaultClassification: 'Positive' as const, suggestedTool: 'Postman' as const },
  { id: 'system', label: 'System Test Cases', category: 'functional', defaultClassification: 'Positive' as const, suggestedTool: 'Playwright' as const },
  { id: 'regression', label: 'Regression Test Cases', category: 'functional', defaultClassification: 'Positive' as const, suggestedTool: 'Selenium' as const },
  { id: 'smoke', label: 'Smoke Test Cases', category: 'functional', defaultClassification: 'Positive' as const, suggestedTool: 'Playwright' as const },
  { id: 'sanity', label: 'Sanity Test Cases', category: 'functional', defaultClassification: 'Positive' as const, suggestedTool: 'Playwright' as const },
  { id: 'e2e', label: 'End-to-End Test Cases', category: 'functional', defaultClassification: 'Positive' as const, suggestedTool: 'Playwright' as const },
  { id: 'api', label: 'API Test Cases', category: 'integration', defaultClassification: 'Positive' as const, suggestedTool: 'Postman' as const },
  { id: 'database', label: 'Database Test Cases', category: 'integration', defaultClassification: 'Positive' as const, suggestedTool: 'Jest' as const },
  { id: 'security', label: 'Security Test Cases', category: 'security', defaultClassification: 'Negative' as const, suggestedTool: 'Postman' as const },
  { id: 'performance', label: 'Performance Test Cases', category: 'performance', defaultClassification: 'Positive' as const, suggestedTool: 'Postman' as const },
  { id: 'compatibility', label: 'Compatibility Test Cases', category: 'edge', defaultClassification: 'Positive' as const, suggestedTool: 'Selenium' as const },
  { id: 'accessibility', label: 'Accessibility Test Cases', category: 'edge', defaultClassification: 'Positive' as const, suggestedTool: 'Playwright' as const },
  { id: 'error_handling', label: 'Error Handling Test Cases', category: 'negative', defaultClassification: 'Negative' as const, suggestedTool: 'Cypress' as const },
  { id: 'exploratory', label: 'Exploratory Testing Scenarios', category: 'edge', defaultClassification: 'Positive' as const, suggestedTool: 'Playwright' as const },
  { id: 'edge', label: 'Edge Case Test Cases', category: 'edge', defaultClassification: 'Negative' as const, suggestedTool: 'Playwright' as const },
  { id: 'uat', label: 'User Acceptance Test Cases', category: 'functional', defaultClassification: 'Positive' as const, suggestedTool: 'Cypress' as const },
];

const VAGUE_WORDS = [
  'appropriate', 'adequate', 'reasonable', 'sufficient', 'fast', 'slow',
  'user-friendly', 'intuitive', 'easy', 'simple', 'complex', 'various',
  'several', 'many', 'few', 'some', 'etc', 'and so on', 'as needed',
  'if necessary', 'as appropriate', 'timely', 'quickly', 'efficiently',
  'effectively', 'properly', 'correctly', 'good', 'bad', 'nice', 'better',
  'best', 'optimal', 'normal', 'regular', 'standard', 'typical', 'usual',
  'flexible', 'scalable', 'robust', 'seamless', 'smooth', 'minimal',
  'maximum', 'significant', 'large', 'small', 'approximately', 'roughly',
  'about', 'around', 'nearly', 'almost', 'mostly', 'generally', 'usually',
  'often', 'sometimes', 'may', 'might', 'could', 'should', 'possibly'
];

const SECURITY_KEYWORDS = [
  'authentication', 'authorization', 'password', 'encryption', 'token',
  'session', 'login', 'logout', 'access control', 'permission', 'role',
  'admin', 'security', 'ssl', 'tls', 'https', 'certificate', 'oauth',
  'jwt', 'api key', 'secret', 'credential', 'vulnerability', 'injection',
  'xss', 'csrf', 'sanitize', 'validate', 'firewall', 'audit'
];

const PERFORMANCE_KEYWORDS = [
  'performance', 'speed', 'latency', 'throughput', 'response time',
  'load', 'concurrent', 'scalability', 'cache', 'optimization',
  'bandwidth', 'memory', 'cpu', 'database', 'query', 'index',
  'timeout', 'retry', 'batch', 'async', 'parallel', 'queue'
];

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function extractDetailedRequirements(srsText: string): ExtractedRequirement[] {
  const lines = srsText.split('\n').filter(l => l.trim());
  const requirements: ExtractedRequirement[] = [];
  let reqCounter = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.length < 15) continue;

    const reqMatch = trimmed.match(/^(REQ[-_]?\d+|R\d+|FR[-_]?\d+|NFR[-_]?\d+|US[-_]?\d+)[:\s-]*(.*)/i);
    const reqId = reqMatch ? reqMatch[1].toUpperCase() : `REQ-${String(reqCounter).padStart(3, '0')}`;
    const desc = reqMatch ? (reqMatch[2].trim() || trimmed) : trimmed;
    reqCounter++;

    const lower = desc.toLowerCase();
    let category: ExtractedRequirement['category'] = 'Functional';
    if (SECURITY_KEYWORDS.some(kw => lower.includes(kw))) category = 'Security';
    else if (PERFORMANCE_KEYWORDS.some(kw => lower.includes(kw))) category = 'Performance';
    else if (lower.includes('ui') || lower.includes('interface') || lower.includes('screen') || lower.includes('display')) category = 'Usability';
    else if (lower.includes('rule') || lower.includes('must be') || lower.includes('policy') || lower.includes('limit')) category = 'Business Rule';
    else if (lower.includes('shall not') || lower.includes('system must handle')) category = 'Non-Functional';

    let priority: ExtractedRequirement['priority'] = 'Medium';
    if (category === 'Security' || lower.includes('must') || lower.includes('critical') || lower.includes('mandatory')) priority = 'High';
    if (lower.includes('financial') || lower.includes('payment') || lower.includes('transaction') || lower.includes('pci-dss')) priority = 'Critical';
    if (lower.includes('optional') || lower.includes('may') || lower.includes('nice to have')) priority = 'Low';

    // Extract role
    let userRole = 'Standard User';
    if (lower.includes('admin')) userRole = 'Administrator';
    else if (lower.includes('manager')) userRole = 'Manager';
    else if (lower.includes('guest') || lower.includes('anonymous')) userRole = 'Guest';
    else if (lower.includes('qa') || lower.includes('tester')) userRole = 'QA';

    // Inputs & outputs detection
    const inputs: string[] = [];
    if (/email/.test(lower)) inputs.push('Email Address');
    if (/password/.test(lower)) inputs.push('Password');
    if (/name/.test(lower)) inputs.push('Full Name');
    if (/phone|mobile/.test(lower)) inputs.push('Phone Number');
    if (/amount|payment|price/.test(lower)) inputs.push('Transaction Amount');
    if (/search|query/.test(lower)) inputs.push('Search Query');
    if (/file|document|upload/.test(lower)) inputs.push('File Attachment');
    if (inputs.length === 0) inputs.push('Target Parameter Set');

    const outputs: string[] = [];
    if (/token|jwt/.test(lower)) outputs.push('JWT Auth Token');
    if (/dashboard/.test(lower)) outputs.push('Rendered Dashboard View');
    if (/notification|email/.test(lower)) outputs.push('Email Notification');
    if (/confirmation|success/.test(lower)) outputs.push('Transaction Receipt / Status');
    if (outputs.length === 0) outputs.push('Operation Status & Audit Log');

    const validationRules: string[] = [];
    if (/at least \d+ characters/i.test(desc)) {
      const match = desc.match(/at least (\d+) characters/i);
      validationRules.push(`Min length: ${match ? match[1] : '8'} characters`);
    }
    if (/uppercase|special/i.test(desc)) validationRules.push('Must contain uppercase and special characters');
    if (/lock.*after \d+/i.test(desc)) validationRules.push('Lockout policy on consecutive failures');
    if (validationRules.length === 0) validationRules.push('Strict type, non-empty, and format validation');

    const title = desc.length > 55 ? `${desc.substring(0, 52)}...` : desc;

    requirements.push({
      id: uuidv4(),
      requirementId: reqId,
      title,
      description: desc,
      category,
      priority,
      userRole,
      inputs,
      outputs,
      validationRules,
      approved: true,
      excluded: false,
    });
  }

  if (requirements.length === 0) {
    requirements.push({
      id: uuidv4(),
      requirementId: 'REQ-001',
      title: 'Primary System Requirement',
      description: srsText.substring(0, 200),
      category: 'Functional',
      priority: 'High',
      userRole: 'Standard User',
      inputs: ['User Credentials', 'Action Parameters'],
      outputs: ['System Response'],
      validationRules: ['Strict input schema validation'],
      approved: true,
      excluded: false,
    });
  }

  return requirements;
}

export function extractRequirements(srsText: string): { id: string; text: string }[] {
  const reqs = extractDetailedRequirements(srsText);
  return reqs.map(r => ({ id: r.requirementId, text: r.description }));
}

export function determinePriority(text: string): 'High' | 'Medium' | 'Low' {
  const lower = text.toLowerCase();
  const hasSecurityKw = SECURITY_KEYWORDS.some(kw => lower.includes(kw));
  const hasCriticalWords = ['must', 'critical', 'essential', 'mandatory', 'required', 'shall'].some(w => lower.includes(w));
  const hasHighFreq = ['always', 'every', 'all users', 'real-time', 'immediately'].some(w => lower.includes(w));

  if (hasSecurityKw || hasCriticalWords) return 'High';
  if (hasHighFreq || lower.includes('should') || lower.includes('important')) return 'Medium';
  return 'Low';
}

function calculateRiskScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 20;
  SECURITY_KEYWORDS.forEach(kw => { if (lower.includes(kw)) score += 8; });
  PERFORMANCE_KEYWORDS.forEach(kw => { if (lower.includes(kw)) score += 5; });
  if (lower.includes('database') || lower.includes('data')) score += 10;
  if (lower.includes('payment') || lower.includes('transaction')) score += 15;
  if (lower.includes('user input') || lower.includes('form')) score += 7;
  return Math.min(100, score);
}

export async function generateTestCasesByType(
  srsText: string,
  selectedTypeIds: string[] = ['functional', 'positive', 'negative', 'boundary'],
  options?: {
    countPerType?: number;
    priorityFilter?: string;
    classificationFilter?: string;
    automationFilter?: string;
    requirements?: ExtractedRequirement[];
  }
): Promise<TestCase[]> {
  await delay(600);
  const activeReqs = (options?.requirements && options.requirements.length > 0)
    ? options.requirements.filter(r => !r.excluded)
    : extractDetailedRequirements(srsText);

  const testCases: TestCase[] = [];
  let tcCounter = 1;
  const typesToGenerate = selectedTypeIds.length > 0
    ? ALL_TEST_CASE_TYPES.filter(t => selectedTypeIds.includes(t.id))
    : ALL_TEST_CASE_TYPES.slice(0, 4);

  for (const req of activeReqs) {
    const feature = summarizeFeature(req.description);
    const risk = calculateRiskScore(req.description);

    for (const typeObj of typesToGenerate) {
      const typeLabel = typeObj.label;
      const tcId = `TC-${req.requirementId.replace(/[^A-Z0-9]/gi, '')}-${String(tcCounter++).padStart(3, '0')}`;
      const classification = typeObj.defaultClassification;

      // Filter by classification if requested
      if (options?.classificationFilter && options.classificationFilter !== 'both' && options.classificationFilter.toLowerCase() !== classification.toLowerCase()) {
        continue;
      }

      // Priority calculation
      let priority: TestCase['priority'] = req.priority === 'Critical' ? 'Critical' : (req.priority as 'High' | 'Medium' | 'Low');
      if (typeObj.id === 'security' || typeObj.id === 'smoke') priority = 'Critical';
      if (typeObj.id === 'negative' || typeObj.id === 'error_handling') priority = 'High';

      // Priority filter check
      if (options?.priorityFilter && options.priorityFilter !== 'all' && options.priorityFilter.toLowerCase() !== priority.toLowerCase()) {
        continue;
      }

      // Severity
      let severity: TestCase['severity'] = 'Major';
      if (priority === 'Critical') severity = 'Blocker';
      else if (priority === 'High') severity = 'Critical';
      else if (priority === 'Low') severity = 'Minor';

      // Automation feasibility
      let automationFeasibility: TestCase['automationFeasibility'] = 'Automated';
      if (typeObj.id === 'exploratory' || typeObj.id === 'ui_ux') automationFeasibility = 'Feasible';
      if (typeObj.id === 'uat') automationFeasibility = 'Manual Only';

      if (options?.automationFilter && options.automationFilter !== 'both') {
        if (options.automationFilter === 'manual' && automationFeasibility === 'Automated') continue;
        if (options.automationFilter === 'automation' && automationFeasibility === 'Manual Only') continue;
      }

      const scenario = `Verify ${feature} under ${typeLabel}`;
      const testDataDesc = buildSampleTestData(req, typeObj.id);

      testCases.push({
        id: uuidv4(),
        testCaseId: tcId,
        title: `${typeLabel}: ${feature}`,
        scenario,
        description: `Execute comprehensive validation for requirement ${req.requirementId} focusing on ${typeLabel.toLowerCase()} expectations and quality constraints.`,
        requirementId: req.requirementId,
        requirementDescription: req.description,
        preconditions: generatePrecondition(req.description),
        steps: buildTypeSpecificSteps(req, typeObj.id),
        testData: testDataDesc,
        expectedResults: buildTypeSpecificExpected(req, typeObj.id),
        actualResults: '',
        priority,
        severity,
        testType: typeLabel,
        category: typeObj.category,
        executionStatus: 'Not Run',
        classification,
        automationFeasibility,
        suggestedTool: typeObj.suggestedTool,
        riskScore: risk,
        riskLevel: risk >= 75 ? 'Critical' : risk >= 50 ? 'High' : risk >= 30 ? 'Medium' : 'Low',
        requirementCoverage: 'Full',
        dependencies: [`Backend service for ${req.requirementId}`],
        assumptions: 'Test environment has seed configuration and valid service mocks enabled.',
        tags: [typeObj.id, req.category.toLowerCase(), classification.toLowerCase()],
        createdAt: new Date().toISOString(),
        status: 'Active',
        isCovered: true,
      });
    }
  }

  return testCases;
}

function buildSampleTestData(req: ExtractedRequirement, typeId: string): string {
  if (typeId === 'boundary') {
    return 'Min value: 8 chars | Min-1: 7 chars | Max value: 128 chars | Max+1: 129 chars';
  }
  if (typeId === 'negative' || typeId === 'error_handling') {
    return 'Invalid format: "null@empty", special chars: "<script>", whitespace only: "   "';
  }
  if (typeId === 'security') {
    return 'SQLi payload: "\' OR \'1\'=\'1", XSS: "<img src=x onerror=alert(1)>", Expired Bearer Token';
  }
  if (typeId === 'performance') {
    return 'Concurrent threads: 250 users | Payload batch size: 1000 items | Timeout: 500ms';
  }
  return `Valid payload: { user: "${req.userRole}", timestamp: "${new Date().toISOString()}", parameters: "compliant" }`;
}

function buildTypeSpecificSteps(req: ExtractedRequirement, typeId: string): string[] {
  const steps: string[] = [];
  steps.push(`1. Verify system is in clean state for requirement ${req.requirementId}`);
  steps.push(`2. Authenticate as persona "${req.userRole}"`);

  if (typeId === 'boundary') {
    steps.push('3. Supply input at exact minimum valid threshold and dispatch action');
    steps.push('4. Supply input 1 step below minimum and verify rejection');
    steps.push('5. Supply input at exact maximum valid threshold and dispatch action');
    steps.push('6. Supply input 1 step above maximum and verify rejection');
  } else if (typeId === 'security') {
    steps.push('3. Send request without authorization header to verify 401/403 barrier');
    steps.push('4. Inject SQL/XSS parameter payloads into user-controlled input fields');
    steps.push('5. Attempt role escalation to access restricted administrative resources');
    steps.push('6. Verify session invalidation and audit logging for suspicious attempts');
  } else if (typeId === 'negative' || typeId === 'error_handling') {
    steps.push('3. Leave mandatory input fields empty and submit action');
    steps.push('4. Provide malformed / invalid schema payload to endpoint');
    steps.push('5. Simulate upstream service timeout / network disconnect');
    steps.push('6. Verify clear, non-leaking user-facing error messages');
  } else if (typeId === 'performance') {
    steps.push('3. Warm up endpoint caches with baseline health probes');
    steps.push('4. Ramp up concurrent virtual users to peak traffic volume');
    steps.push('5. Measure 95th percentile latency, CPU utilization, and throughput');
    steps.push('6. Verify zero dropped connections and graceful degradation');
  } else if (typeId === 'api') {
    steps.push('3. Construct valid JSON request body following Swagger/OpenAPI spec');
    steps.push('4. Set required headers (Content-Type: application/json, Authorization)');
    steps.push('5. Dispatch HTTP request and validate 2xx status response');
    steps.push('6. Assert response JSON schema matches defined entity contracts');
  } else {
    steps.push(`3. Enter verified inputs matching specification: ${req.inputs?.join(', ') || 'Valid values'}`);
    steps.push('4. Click primary confirmation action / trigger execution');
    steps.push(`5. Verify output artifacts generated: ${req.outputs?.join(', ') || 'Successful state'}`);
    steps.push('6. Confirm persistent database record matches expected state');
  }

  return steps;
}

function buildTypeSpecificExpected(req: ExtractedRequirement, typeId: string): string {
  if (typeId === 'boundary') {
    return `Min and max boundary values are processed successfully. Out-of-bounds values are rejected with strict validation errors. Zero data corruption.`;
  }
  if (typeId === 'security') {
    return `Unauthorized access blocked immediately (401/403). Injected attack vectors are neutralized. Security event logged with IP and persona.`;
  }
  if (typeId === 'negative' || typeId === 'error_handling') {
    return `Invalid inputs and network timeouts are rejected gracefully. Informative error messages displayed without stack traces or sensitive internals.`;
  }
  if (typeId === 'performance') {
    return `Response time remains within SLA (< 200ms p95). System handles concurrent requests without memory leak or thread deadlocks.`;
  }
  if (typeId === 'api') {
    return `API returns HTTP 200/201 with valid JSON schema. Headers include security constraints (CSP, HSTS). Persisted state is accurate.`;
  }
  return `1. Primary workflow for ${req.title} executes smoothly. 2. Persisted state matches expected output. 3. Audit trail records successful action.`;
}

export async function generateTestCases(srsText: string): Promise<TestCase[]> {
  return generateTestCasesByType(srsText, ['functional', 'positive', 'negative', 'boundary', 'security']);
}

function summarizeFeature(text: string): string {
  const cleaned = text.replace(/^(the system shall|system must|users? (should|must|can)|admin users must)\s+/i, '').trim();
  return cleaned.length > 70 ? `${cleaned.slice(0, 70)}...` : cleaned;
}

export function buildExpected(text: string, type: string): string {
  const feature = summarizeFeature(text);
  if (type === 'positive') {
    return `1) ${feature} completes successfully. 2) UI/API returns success indicator. 3) Persisted state matches submitted valid data. 4) No unexpected errors in logs.`;
  }
  if (type === 'negative') {
    return `1) Request/action is rejected. 2) Clear field-level or API error message is shown. 3) No partial/invalid data is persisted. 4) HTTP/status or UI state remains consistent with failure.`;
  }
  if (type === 'boundary') {
    return `1) Min and max valid boundary values are accepted. 2) Just-outside boundary values are rejected with validation errors. 3) System remains stable (no crash).`;
  }
  return `1) Unauthorized/malicious attempts are blocked. 2) No sensitive data leakage. 3) Security event is logged. 4) Session/token integrity preserved.`;
}

export function buildAtomicSteps(text: string, type: string): string[] {
  const lower = text.toLowerCase();
  const isLogin = /login|sign.?in|authenticate|credentials/.test(lower);
  const isRegister = /register|sign.?up|create account/.test(lower);
  const isSearch = /search|filter|query/.test(lower);
  const isPayment = /payment|transaction|checkout/.test(lower);
  const isApi = /api|endpoint|rest|jwt|token/.test(lower);

  if (type === 'positive') {
    if (isLogin) {
      return [
        'Navigate to "/login"',
        'Enter valid email "qa.valid@example.com" in the email field',
        'Enter valid password "Valid@12345" in the password field',
        'Click the "Login" button',
        'Verify URL contains "dashboard" or home page is displayed',
        'Verify success indicator or authenticated user menu is visible',
      ];
    }
    if (isRegister) {
      return [
        'Navigate to "/register"',
        'Enter name "QA Tester"',
        'Enter unique email "qa.user+{timestamp}@example.com"',
        'Enter password "Valid@12345"',
        'Click the "Register" / "Sign Up" button',
        'Verify account creation success message is displayed',
      ];
    }
    if (isSearch) {
      return [
        'Navigate to the search page',
        'Enter search query "test"',
        'Click Search / press Enter',
        'Verify results list is displayed',
        'Verify each result is relevant to query "test"',
      ];
    }
    if (isPayment) {
      return [
        'Navigate to checkout/payment page',
        'Enter amount "100"',
        'Enter card number "4111111111111111"',
        'Enter CVV "123"',
        'Click "Pay" / "Submit Payment"',
        'Verify payment success confirmation is displayed',
      ];
    }
    if (isApi) {
      return [
        'Obtain a valid authentication token',
        'Send request to the target API endpoint with valid payload',
        'Verify response status is 2xx',
        'Verify response body contains expected fields',
        'Verify server audit/log entry is created',
      ];
    }
    return [
      'Navigate to the feature under test',
      'Prepare and enter valid test data in all required fields',
      'Click the primary action / Submit button',
      'Verify success message or expected outcome is displayed',
      'Verify persisted data matches input',
    ];
  }

  if (type === 'negative') {
    if (isLogin) {
      return [
        'Navigate to "/login"',
        'Enter email "qa.valid@example.com"',
        'Enter invalid password "wrong"',
        'Click the "Login" button',
        'Verify error message about invalid credentials is displayed',
        'Verify user is not redirected to dashboard',
      ];
    }
    return [
      'Navigate to the feature under test',
      'Leave required fields empty or enter invalid values',
      'Attempt to submit the form / execute the action',
      'Verify validation/error messages are displayed',
      'Verify no invalid data is saved',
    ];
  }

  if (type === 'boundary') {
    if (/password/.test(lower)) {
      return [
        'Navigate to password/input form',
        'Enter password with length just below minimum (e.g. 7 chars if min=8)',
        'Attempt submit and verify rejection',
        'Enter password at exact minimum length with required character classes',
        'Verify acceptance at minimum boundary',
        'Enter excessively long password beyond max length and verify rejection/truncation policy',
      ];
    }
    return [
      'Navigate to the input form',
      'Enter minimum allowed value and submit — verify acceptance',
      'Enter maximum allowed value and submit — verify acceptance',
      'Enter value just below minimum — verify rejection',
      'Enter value just above maximum — verify rejection',
    ];
  }

  // security
  return [
    'Attempt to access the feature without authentication',
    'Verify access is denied (401/403 or login redirect)',
    'Login with a low-privilege user',
    'Attempt to access another user\'s resource / admin action',
    'Submit payload containing XSS/SQL injection strings in input fields',
    'Verify malicious input is rejected or safely encoded and no script executes',
    'Verify security/audit log captures the failed attempt',
  ];
}

function generatePrecondition(text: string): string {
  const lower = text.toLowerCase();
  const conditions: string[] = ['System is accessible and running'];
  if (lower.includes('login') || lower.includes('auth') || lower.includes('user')) conditions.push('User is authenticated with valid credentials');
  if (lower.includes('database') || lower.includes('data')) conditions.push('Test database is populated with required test data');
  if (lower.includes('api') || lower.includes('service')) conditions.push('Backend API services are available and responding');
  if (lower.includes('admin')) conditions.push('User has administrator privileges');
  if (lower.includes('payment') || lower.includes('transaction')) conditions.push('Payment gateway sandbox is configured');
  return conditions.join('. ') + '.';
}

export function extractTags(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();
  if (lower.includes('login') || lower.includes('auth')) tags.push('authentication');
  if (lower.includes('api')) tags.push('api');
  if (lower.includes('ui') || lower.includes('interface') || lower.includes('display')) tags.push('ui');
  if (lower.includes('database') || lower.includes('data')) tags.push('data');
  if (lower.includes('performance') || lower.includes('speed')) tags.push('performance');
  if (lower.includes('payment')) tags.push('payment');
  if (lower.includes('notification') || lower.includes('email') || lower.includes('alert')) tags.push('notification');
  if (tags.length === 0) tags.push('general');
  return tags;
}

export async function detectAmbiguities(srsText: string): Promise<AmbiguityIssue[]> {
  await delay(1000);
  const lines = srsText.split('\n');
  const issues: AmbiguityIssue[] = [];

  const getCategory = (word: string): AmbiguityIssue['category'] => {
    if (['fast', 'slow', 'performant', 'quick'].includes(word)) return 'Unclear performance expectations';
    if (['secure', 'protected', 'safe'].includes(word)) return 'Missing security constraints';
    if (['error', 'handle', 'fail'].includes(word)) return 'Missing error handling';
    if (['many', 'several', 'few', 'some', 'various', 'multiple'].includes(word)) return 'Missing measurable criteria';
    if (['etc', 'and so on', 'as needed', 'if necessary'].includes(word)) return 'Incomplete conditions';
    return 'Vague language';
  };

  const generateRewritten = (originalLine: string, phrase: string, suggestion: string): string => {
    let replaced = originalLine;
    if (phrase === 'fast') replaced = originalLine.replace(/fast/gi, 'within 200ms at 95th percentile');
    else if (phrase === 'user-friendly') replaced = originalLine.replace(/user-friendly/gi, 'conforming to WCAG 2.1 AA and 3-step navigation');
    else if (phrase === 'appropriate') replaced = originalLine.replace(/appropriate/gi, 'specifically designated according to role access policies');
    else if (phrase === 'etc' || phrase === 'and so on') replaced = originalLine.replace(/,?\s*(etc|and so on)\.?/gi, ' [explicitly: read, write, delete]');
    else if (phrase === 'should' || phrase === 'could') replaced = originalLine.replace(/\b(should|could)\b/gi, 'shall');
    else replaced = `${originalLine.trim()} (Requirement Metric: ${suggestion.replace(/^Replace.*with /, '')})`;
    return replaced.trim();
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();

    VAGUE_WORDS.forEach(word => {
      if (lower.includes(word)) {
        const existing = issues.find(i => i.lineNumber === idx + 1 && i.phrase === word);
        if (!existing) {
          const suggestion = getAmbiguitySuggestion(word);
          issues.push({
            id: uuidv4(),
            phrase: word,
            reason: getAmbiguityReason(word),
            suggestion,
            rewrittenRequirement: generateRewritten(trimmed, word, suggestion),
            category: getCategory(word),
            confidenceScore: Math.floor(Math.random() * 8) + 91,
            resolved: false,
            severity: getAmbiguitySeverity(word),
            lineNumber: idx + 1,
          });
        }
      }
    });

    // Check for passive voice
    if (/\b(is|are|was|were|be|been|being)\s+(\w+ed|\w+en)\b/i.test(trimmed)) {
      issues.push({
        id: uuidv4(),
        phrase: 'Passive voice detected',
        reason: 'Passive voice obscures the explicit system actor or user role',
        suggestion: 'Rewrite using active voice: "The system shall..." instead of passive constructs',
        rewrittenRequirement: `The system shall execute: ${trimmed.replace(/\b(it is expected that|is expected to be)\b/gi, '')}`,
        category: 'Vague language',
        confidenceScore: 92,
        resolved: false,
        severity: 'medium',
        lineNumber: idx + 1,
      });
    }

    // Check for missing quantifiers
    if (/\b(many|several|few|some|various|multiple)\b/i.test(trimmed) && !/\d/.test(trimmed)) {
      issues.push({
        id: uuidv4(),
        phrase: 'Missing specific quantity',
        reason: 'Subjective quantifiers make boundary and load testing impossible to certify',
        suggestion: 'Specify concrete numerical thresholds (e.g., minimum 100 concurrent requests, maximum 500 records)',
        rewrittenRequirement: trimmed.replace(/\b(many|several|few|some|various|multiple)\b/gi, 'at least 100'),
        category: 'Missing measurable criteria',
        confidenceScore: 96,
        resolved: false,
        severity: 'high',
        lineNumber: idx + 1,
      });
    }
  });

  return issues.slice(0, 50);
}

function getAmbiguityReason(word: string): string {
  const reasons: Record<string, string> = {
    'appropriate': 'Subjective term - what is appropriate varies by stakeholder',
    'fast': 'No measurable criteria - define specific response time',
    'user-friendly': 'Subjective UX term - define specific usability criteria',
    'easy': 'Subjective - define specific interaction steps',
    'etc': 'Incomplete specification - all items should be explicitly listed',
    'should': 'Ambiguous obligation - use "shall" for mandatory, "may" for optional',
    'may': 'Unclear if this is a permission or possibility',
    'could': 'Unclear if this is a capability or suggestion',
  };
  return reasons[word] || `The term "${word}" is vague and open to interpretation. Define specific, measurable criteria.`;
}

function getAmbiguitySuggestion(word: string): string {
  const suggestions: Record<string, string> = {
    'appropriate': 'Define specific acceptance criteria with measurable thresholds',
    'fast': 'Specify exact response time: "within 200ms" or "under 2 seconds"',
    'user-friendly': 'Define specific usability metrics: task completion rate, error rate, learnability',
    'easy': 'Specify maximum number of steps or time to complete',
    'etc': 'List all items explicitly. If the list is dynamic, define the pattern.',
    'should': 'Use "shall" for mandatory requirements, "may" for optional features',
    'may': 'Clarify: Is this a permission ("is allowed to") or possibility ("might")?',
    'could': 'Clarify: Is this a required capability or a nice-to-have suggestion?',
  };
  return suggestions[word] || `Replace "${word}" with specific, measurable, and testable criteria.`;
}

function getAmbiguitySeverity(word: string): 'high' | 'medium' | 'low' {
  const highSeverity = ['etc', 'and so on', 'as needed', 'if necessary', 'appropriate'];
  const mediumSeverity = ['should', 'may', 'could', 'might', 'possibly', 'fast', 'slow', 'user-friendly'];
  if (highSeverity.includes(word)) return 'high';
  if (mediumSeverity.includes(word)) return 'medium';
  return 'low';
}

export async function assessRisk(srsText: string, testCases: TestCase[]): Promise<RiskAssessment> {
  await delay(800);
  const lower = srsText.toLowerCase();
  const factors: string[] = [];

  let securityRisk = 15;
  let performanceRisk = 15;
  let functionalRisk = 20;

  SECURITY_KEYWORDS.forEach(kw => {
    if (lower.includes(kw)) { securityRisk += 6; factors.push(`Security keyword detected: ${kw}`); }
  });

  PERFORMANCE_KEYWORDS.forEach(kw => {
    if (lower.includes(kw)) { performanceRisk += 5; factors.push(`Performance concern: ${kw}`); }
  });

  if (lower.includes('payment') || lower.includes('financial')) { securityRisk += 20; factors.push('Financial transactions increase security risk'); }
  if (lower.includes('personal data') || lower.includes('pii') || lower.includes('gdpr')) { securityRisk += 15; factors.push('Personal data handling requires compliance'); }
  if (lower.includes('real-time') || lower.includes('concurrent')) { performanceRisk += 15; factors.push('Real-time/concurrent requirements increase performance risk'); }
  if (lower.includes('third-party') || lower.includes('integration') || lower.includes('external')) { functionalRisk += 15; factors.push('External integrations add functional complexity'); }
  if (lower.includes('migration') || lower.includes('legacy')) { functionalRisk += 12; factors.push('Legacy system interaction increases risk'); }

  const highPriorityCount = testCases.filter(tc => tc.priority === 'High').length;
  if (highPriorityCount > testCases.length * 0.5) { functionalRisk += 10; factors.push('High proportion of critical test cases'); }

  securityRisk = Math.min(100, securityRisk);
  performanceRisk = Math.min(100, performanceRisk);
  functionalRisk = Math.min(100, functionalRisk);
  const overallScore = Math.round((securityRisk * 0.4 + performanceRisk * 0.3 + functionalRisk * 0.3));

  return {
    securityRisk: Math.min(100, securityRisk),
    performanceRisk: Math.min(100, performanceRisk),
    functionalRisk: Math.min(100, functionalRisk),
    overallScore: Math.min(100, overallScore),
    factors: [...new Set(factors)].slice(0, 15),
  };
}

export async function generateTraceabilityMatrix(srsText: string, testCases: TestCase[]): Promise<TraceabilityEntry[]> {
  await delay(600);
  const requirements = extractRequirements(srsText);
  return requirements.map(req => {
    const mappedCases = testCases.filter(tc => tc.requirementId === req.id);
    return {
      requirementId: req.id,
      requirementText: req.text,
      testCaseIds: mappedCases.map(tc => tc.testCaseId),
      coverage: mappedCases.length > 0 ? Math.min(100, mappedCases.length * 33) : 0,
    };
  });
}

export async function detectDuplicates(testCases: TestCase[]): Promise<DuplicatePair[]> {
  await delay(1000);
  const duplicates: DuplicatePair[] = [];

  for (let i = 0; i < testCases.length; i++) {
    for (let j = i + 1; j < testCases.length; j++) {
      const similarity = calculateSimilarity(testCases[i].scenario, testCases[j].scenario);
      if (similarity > 0.6) {
        duplicates.push({
          testCase1Id: testCases[i].testCaseId,
          testCase2Id: testCases[j].testCaseId,
          similarity: Math.round(similarity * 100),
          reason: similarity > 0.85 ? 'Near-identical scenarios' : similarity > 0.7 ? 'Highly similar test objectives' : 'Overlapping test coverage',
        });
      }
    }
  }

  return duplicates;
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

export async function calculateCoverage(srsText: string, testCases: TestCase[]): Promise<CoverageData> {
  await delay(500);
  const requirements = extractRequirements(srsText);
  const coveredReqIds = new Set(testCases.filter(tc => tc.isCovered).map(tc => tc.requirementId));
  const missingRequirements = requirements.filter(r => !coveredReqIds.has(r.id)).map(r => r.id);

  const categories = ['functional', 'negative', 'edge', 'security', 'boundary'] as const;
  const categoryBreakdown = categories.map(cat => {
    const count = testCases.filter(tc => tc.category === cat).length;
    return { category: cat, count, percentage: testCases.length > 0 ? Math.round((count / testCases.length) * 100) : 0 };
  }).filter(c => c.count > 0);

  return {
    totalRequirements: requirements.length,
    coveredRequirements: requirements.length - missingRequirements.length,
    coveragePercentage: requirements.length > 0 ? Math.round(((requirements.length - missingRequirements.length) / requirements.length) * 100) : 0,
    missingRequirements,
    categoryBreakdown,
  };
}

export async function generateNegativeTestCases(srsText: string): Promise<TestCase[]> {
  await delay(1200);
  const requirements = extractRequirements(srsText);
  const testCases: TestCase[] = [];
  let tcCounter = 500;

  for (const req of requirements) {
    const lower = req.text.toLowerCase();

    // Boundary test case
    testCases.push({
      id: uuidv4(),
      testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
      scenario: `Boundary value analysis for: ${req.text.substring(0, 60)}`,
      preconditions: 'System is running. Test data with boundary values is prepared.',
      steps: [
        'Identify all input fields related to the requirement',
        'Test with minimum boundary value (min)',
        'Test with minimum boundary - 1 (min-1)',
        'Test with minimum boundary + 1 (min+1)',
        'Test with maximum boundary value (max)',
        'Test with maximum boundary + 1 (max+1)',
        'Test with maximum boundary - 1 (max-1)',
        'Verify system behavior for each boundary condition'
      ],
      expectedResults: 'System accepts values within valid range and rejects values outside boundaries with appropriate error messages.',
      priority: 'Medium',
      riskScore: 45,
      requirementId: req.id,
      category: 'boundary',
      tags: ['boundary', 'negative'],
      createdAt: new Date().toISOString(),
    });

    // Invalid input test case
    testCases.push({
      id: uuidv4(),
      testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
      scenario: `Invalid input handling for: ${req.text.substring(0, 60)}`,
      preconditions: 'System is running. Invalid test data is prepared.',
      steps: [
        'Navigate to the feature under test',
        'Enter null/empty values in required fields',
        'Enter special characters (!@#$%^&*) in text fields',
        'Enter extremely long strings (10000+ characters)',
        'Enter SQL injection patterns (\' OR 1=1 --)',
        'Enter XSS payloads (<script>alert(1)</script>)',
        'Enter negative numbers in positive-only fields',
        'Verify error handling for each invalid input'
      ],
      expectedResults: 'System gracefully handles all invalid inputs. No crashes, no security vulnerabilities exposed. Proper error messages displayed.',
      priority: 'High',
      riskScore: 70,
      requirementId: req.id,
      category: 'negative',
      tags: ['negative', 'security', 'validation'],
      createdAt: new Date().toISOString(),
    });

    // Security edge case
    if (lower.includes('login') || lower.includes('auth') || lower.includes('password') || lower.includes('user')) {
      testCases.push({
        id: uuidv4(),
        testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
        scenario: `Security edge case for: ${req.text.substring(0, 60)}`,
        preconditions: 'Security testing tools are available. Multiple test accounts exist.',
        steps: [
          'Attempt brute force login with multiple incorrect passwords',
          'Test session fixation by reusing old session tokens',
          'Test concurrent sessions from different locations',
          'Attempt privilege escalation by modifying request parameters',
          'Test for information leakage in error messages',
          'Verify account lockout after failed attempts',
          'Test password reset flow for vulnerabilities'
        ],
        expectedResults: 'Account locks after configured failed attempts. Sessions are properly managed. No information leakage. Privilege escalation is prevented.',
        priority: 'High',
        riskScore: 85,
        requirementId: req.id,
        category: 'security',
        tags: ['security', 'edge-case'],
        createdAt: new Date().toISOString(),
      });
    }
  }

  return testCases;
}

export function generateAutomationScript(testCase: TestCase, framework: AutomationFramework): GeneratedScript {
  return generateExecutableAutomationScript(testCase, framework);
}

export function generateAPIEndpoints(): object {
  return {
    version: '1.0.0',
    baseUrl: '/api/v1',
    endpoints: [
      { method: 'POST', path: '/test-cases/generate', description: 'Generate test cases from SRS text', body: { srsText: 'string' }, response: { testCases: 'TestCase[]' } },
      { method: 'POST', path: '/ambiguity/detect', description: 'Detect ambiguities in SRS text', body: { srsText: 'string' }, response: { issues: 'AmbiguityIssue[]' } },
      { method: 'POST', path: '/risk/assess', description: 'Assess risk for requirements', body: { srsText: 'string', testCases: 'TestCase[]' }, response: { assessment: 'RiskAssessment' } },
      { method: 'GET', path: '/test-cases', description: 'Get all test cases', response: { testCases: 'TestCase[]' } },
      { method: 'GET', path: '/test-cases/:id', description: 'Get test case by ID', response: { testCase: 'TestCase' } },
      { method: 'POST', path: '/test-cases/prioritize', description: 'Prioritize test cases', body: { testCases: 'TestCase[]' }, response: { prioritized: 'TestCase[]' } },
      { method: 'POST', path: '/scripts/generate', description: 'Generate automation script', body: { testCaseId: 'string', framework: 'string' }, response: { script: 'GeneratedScript' } },
      { method: 'POST', path: '/traceability/generate', description: 'Generate traceability matrix', body: { srsText: 'string', testCases: 'TestCase[]' }, response: { matrix: 'TraceabilityEntry[]' } },
      { method: 'POST', path: '/duplicates/detect', description: 'Detect duplicate test cases', body: { testCases: 'TestCase[]' }, response: { duplicates: 'DuplicatePair[]' } },
      { method: 'GET', path: '/coverage', description: 'Get test coverage analysis', response: { coverage: 'CoverageData' } },
      { method: 'POST', path: '/negative-cases/generate', description: 'Generate negative & edge cases', body: { srsText: 'string' }, response: { testCases: 'TestCase[]' } },
      { method: 'POST', path: '/webhook/trigger', description: 'Webhook trigger for CI/CD', body: { event: 'string', payload: 'object' }, response: { status: 'string', jobId: 'string' } },
    ],
    webhooks: {
      onTestGenerated: { url: '/webhook/test-generated', payload: { testCases: 'TestCase[]', timestamp: 'string' } },
      onRiskAssessed: { url: '/webhook/risk-assessed', payload: { assessment: 'RiskAssessment', timestamp: 'string' } },
    },
  };
}
