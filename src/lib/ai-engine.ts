import { v4 as uuidv4 } from 'uuid';
import type { TestCase, AmbiguityIssue, RiskAssessment, TraceabilityEntry, DuplicatePair, CoverageData, AutomationFramework, GeneratedScript } from './types';

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

function extractRequirements(srsText: string): { id: string; text: string }[] {
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

  if (requirements.length === 0) {
    requirements.push({ id: 'REQ-001', text: srsText.substring(0, 200) });
  }

  return requirements;
}

function determinePriority(text: string): 'High' | 'Medium' | 'Low' {
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

export async function generateTestCases(srsText: string): Promise<TestCase[]> {
  await delay(1500);
  const requirements = extractRequirements(srsText);
  const testCases: TestCase[] = [];
  let tcCounter = 1;

  for (const req of requirements) {
    const priority = determinePriority(req.text);
    const risk = calculateRiskScore(req.text);
    const lower = req.text.toLowerCase();

    // Positive test case
    testCases.push({
      id: uuidv4(),
      testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
      scenario: `Verify ${req.text.substring(0, 80)}`,
      preconditions: generatePrecondition(req.text),
      steps: generateSteps(req.text, 'positive'),
      expectedResults: `System successfully processes the requirement: ${req.text.substring(0, 60)}. All validations pass and expected output is displayed.`,
      priority,
      riskScore: risk,
      requirementId: req.id,
      category: 'functional',
      tags: extractTags(req.text),
      createdAt: new Date().toISOString(),
    });

    // Validation test case
    if (lower.includes('input') || lower.includes('form') || lower.includes('field') || lower.includes('enter')) {
      testCases.push({
        id: uuidv4(),
        testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
        scenario: `Validate input constraints for: ${req.text.substring(0, 60)}`,
        preconditions: generatePrecondition(req.text),
        steps: generateSteps(req.text, 'validation'),
        expectedResults: 'System displays appropriate validation messages for invalid inputs. Form submission is prevented until all validations pass.',
        priority: 'High',
        riskScore: Math.min(100, risk + 15),
        requirementId: req.id,
        category: 'functional',
        tags: [...extractTags(req.text), 'validation'],
        createdAt: new Date().toISOString(),
      });
    }

    // Security test case
    if (SECURITY_KEYWORDS.some(kw => lower.includes(kw))) {
      testCases.push({
        id: uuidv4(),
        testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
        scenario: `Security verification for: ${req.text.substring(0, 60)}`,
        preconditions: 'Security testing environment is configured. Test user accounts with various permission levels are available.',
        steps: generateSteps(req.text, 'security'),
        expectedResults: 'System enforces security controls. Unauthorized access attempts are blocked. Security logs are generated for audit.',
        priority: 'High',
        riskScore: Math.min(100, risk + 20),
        requirementId: req.id,
        category: 'security',
        tags: [...extractTags(req.text), 'security'],
        createdAt: new Date().toISOString(),
      });
    }
  }

  return testCases;
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

function generateSteps(text: string, type: string): string[] {
  const lower = text.toLowerCase();
  if (type === 'positive') {
    const steps = ['Navigate to the relevant module/page'];
    if (lower.includes('login')) {
      steps.push('Enter valid username in the username field', 'Enter valid password in the password field', 'Click the Login button', 'Verify successful login and redirection to dashboard');
    } else if (lower.includes('form') || lower.includes('input') || lower.includes('enter')) {
      steps.push('Locate the input form', 'Enter valid data in all required fields', 'Review the entered information', 'Submit the form', 'Verify success message and data persistence');
    } else if (lower.includes('search') || lower.includes('filter')) {
      steps.push('Locate the search/filter functionality', 'Enter valid search criteria', 'Execute the search', 'Verify results match the search criteria', 'Verify result count and pagination');
    } else if (lower.includes('report') || lower.includes('export')) {
      steps.push('Navigate to the reports section', 'Select report parameters', 'Generate the report', 'Verify report data accuracy', 'Export and verify file format');
    } else {
      steps.push('Identify the feature under test', 'Prepare valid test data', 'Execute the primary action', 'Verify the expected outcome', 'Validate data integrity');
    }
    return steps;
  } else if (type === 'validation') {
    return [
      'Navigate to the input form',
      'Leave required fields empty and attempt submission',
      'Verify required field validation messages appear',
      'Enter invalid format data (e.g., letters in numeric fields)',
      'Verify format validation messages appear',
      'Enter data exceeding maximum length limits',
      'Verify length validation is enforced',
      'Enter valid data in all fields and submit successfully'
    ];
  } else {
    return [
      'Attempt access without authentication',
      'Verify unauthorized access is blocked with appropriate error',
      'Login with valid credentials',
      'Attempt to access resources beyond assigned permissions',
      'Verify role-based access control is enforced',
      'Test for common vulnerabilities (SQL injection, XSS)',
      'Verify security headers and encryption are in place',
      'Review audit logs for security events'
    ];
  }
}

function extractTags(text: string): string[] {
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

  lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    VAGUE_WORDS.forEach(word => {
      if (lower.includes(word)) {
        const existing = issues.find(i => i.lineNumber === idx + 1 && i.phrase === word);
        if (!existing) {
          issues.push({
            id: uuidv4(),
            phrase: word,
            reason: getAmbiguityReason(word),
            suggestion: getAmbiguitySuggestion(word),
            severity: getAmbiguitySeverity(word),
            lineNumber: idx + 1,
          });
        }
      }
    });

    // Check for passive voice
    if (/\b(is|are|was|were|be|been|being)\s+(\w+ed|\w+en)\b/i.test(line)) {
      issues.push({
        id: uuidv4(),
        phrase: 'Passive voice detected',
        reason: 'Passive voice can obscure who is responsible for the action',
        suggestion: 'Rewrite using active voice: "The system shall..." instead of "It is expected that..."',
        severity: 'medium',
        lineNumber: idx + 1,
      });
    }

    // Check for missing quantifiers
    if (/\b(many|several|few|some|various|multiple)\b/i.test(line) && !/\d/.test(line)) {
      issues.push({
        id: uuidv4(),
        phrase: 'Missing specific quantity',
        reason: 'Vague quantifiers make requirements untestable',
        suggestion: 'Replace with specific numbers: "The system shall support at least 100 concurrent users"',
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
  const generators: Record<AutomationFramework, () => string> = {
    'selenium-java': () => generateSeleniumJava(testCase),
    'selenium-python': () => generateSeleniumPython(testCase),
    'cypress': () => generateCypress(testCase),
    'playwright': () => generatePlaywright(testCase),
  };

  const langMap: Record<AutomationFramework, string> = {
    'selenium-java': 'java',
    'selenium-python': 'python',
    'cypress': 'javascript',
    'playwright': 'typescript',
  };

  return {
    framework,
    testCaseId: testCase.testCaseId,
    code: generators[framework](),
    language: langMap[framework],
  };
}

function generateSeleniumJava(tc: TestCase): string {
  const className = tc.testCaseId.replace(/-/g, '_');

  const stepCode = tc.steps.map((s, i) => {
    let code = `        // Step ${i + 1}: ${s}\n`;
    const lower = s.toLowerCase();

    if (lower.includes('navigate')) code += `        driver.get("http://localhost:5173/");`;
    else if (lower.includes('username')) code += `        driver.findElement(By.name("username")).sendKeys("admin");`;
    else if (lower.includes('password')) code += `        driver.findElement(By.name("password")).sendKeys("password123");`;
    else if (lower.includes('click') && lower.includes('login')) code += `        driver.findElement(By.xpath("//button[contains(text(), 'Login') or contains(translate(text(), 'L', 'l'), 'login')]")).click();`;
    else if (lower.includes('verify') && (lower.includes('success') || lower.includes('dashboard'))) code += `        assertTrue(driver.getCurrentUrl().contains("dashboard") || driver.getPageSource().toLowerCase().contains("dashboard"));`;
    else if (lower.includes('enter') || lower.includes('input')) code += `        driver.findElement(By.tagName("input")).sendKeys("test data");`;
    else if (lower.includes('click') || lower.includes('submit')) code += `        driver.findElement(By.xpath("//button[@type='submit']")).click();`;
    else if (lower.includes('verify')) code += `        assertTrue(!driver.getPageSource().contains("Error"));`;
    else code += `        Thread.sleep(1000);`;

    return code;
  }).join('\n\n');

  return `import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.By;
import org.openqa.selenium.chrome.ChromeDriver;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Test Case: ${tc.testCaseId}
 * Scenario: ${tc.scenario}
 */
public class ${className}Test {
    private WebDriver driver;

    @BeforeEach
    public void setUp() {
        System.setProperty("webdriver.chrome.driver", "path/to/chromedriver");
        driver = new ChromeDriver();
        driver.manage().window().maximize();
    }

    @Test
    @DisplayName("${tc.scenario}")
    public void test_${className.toLowerCase()}() throws InterruptedException {
${stepCode}
    }

    @AfterEach
    public void tearDown() {
        if (driver != null) {
            driver.quit();
        }
    }
}`;
}

function generateSeleniumPython(tc: TestCase): string {
  const methodName = tc.testCaseId.replace(/-/g, '_').toLowerCase();

  const stepCode = tc.steps.map((s, i) => {
    let code = `        # Step ${i + 1}: ${s}\n`;
    const lower = s.toLowerCase();

    if (lower.includes('navigate')) code += `        driver.get("http://localhost:5173/")\n        time.sleep(1)`;
    else if (lower.includes('username')) code += `        driver.find_element("name", "username").send_keys("admin")`;
    else if (lower.includes('password')) code += `        driver.find_element("name", "password").send_keys("password123")`;
    else if (lower.includes('click') && lower.includes('login')) code += `        driver.find_element("xpath", "//button[contains(translate(text(), 'L', 'l'), 'login')]").click()`;
    else if (lower.includes('verify') && (lower.includes('success') || lower.includes('dashboard'))) code += `        assert "dashboard" in driver.current_url.lower() or "dashboard" in driver.page_source.lower()`;
    else if (lower.includes('enter') || lower.includes('input') || lower.includes('provide')) code += `        inputs = driver.find_elements("tag name", "input")\n        for inp in inputs:\n            inp.send_keys("test data")`;
    else if (lower.includes('click') || lower.includes('submit')) code += `        driver.find_element("xpath", "//button[@type='submit']").click()`;
    else if (lower.includes('verify')) code += `        time.sleep(2)\n        assert "Error" not in driver.page_source`;
    else code += `        time.sleep(1)`;

    return code;
  }).join('\n\n');

  return `import pytest
import time
from selenium import webdriver

class Test${tc.testCaseId.replace(/-/g, '')}:
    def test_${methodName}(self):
        driver = webdriver.Chrome()
${stepCode}
        driver.quit()`;
}

function generateCypress(tc: TestCase): string {
  const stepCode = tc.steps.map((s, i) => {
    let code = `    // Step ${i + 1}: ${s}\n`;
    const lower = s.toLowerCase();

    if (lower.includes('navigate')) code += `    cy.visit('/');`;
    else if (lower.includes('username')) code += `    cy.get('input[name="username"]').type('admin');`;
    else if (lower.includes('password')) code += `    cy.get('input[name="password"]').type('password123');`;
    else if (lower.includes('click') && lower.includes('login')) code += `    cy.contains('button', /login/i).click();`;
    else if (lower.includes('verify') && (lower.includes('success') || lower.includes('dashboard'))) code += `    cy.url().should('include', '/dashboard');`;
    else if (lower.includes('enter') || lower.includes('input')) code += `    cy.get('input').first().type('test data');`;
    else if (lower.includes('click') || lower.includes('submit')) code += `    cy.get('button[type="submit"]').click();`;
    else if (lower.includes('verify')) code += `    cy.contains('error', { matchCase: false }).should('not.exist');`;
    else code += `    cy.wait(1000);`;

    return code;
  }).join('\n\n');

  return `describe("${tc.testCaseId}: ${tc.scenario}", () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it("should execute test successfully", () => {
${stepCode}
  });
});`;
}

function generatePlaywright(tc: TestCase): string {
  const stepCode = tc.steps.map((s, i) => {
    let code = `    // Step ${i + 1}: ${s}\n`;
    const lower = s.toLowerCase();

    if (lower.includes('navigate')) code += `    await page.goto('/');`;
    else if (lower.includes('username')) code += `    await page.locator('input[name="username"]').fill('admin');`;
    else if (lower.includes('password')) code += `    await page.locator('input[name="password"]').fill('password123');`;
    else if (lower.includes('click') && lower.includes('login')) code += `    await page.getByRole('button', { name: /login/i }).click();`;
    else if (lower.includes('verify') && (lower.includes('success') || lower.includes('dashboard'))) code += `    await expect(page).toHaveURL(/.*dashboard/);`;
    else if (lower.includes('enter') || lower.includes('input')) code += `    await page.locator('input').first().fill('test data');`;
    else if (lower.includes('click') || lower.includes('submit')) code += `    await page.locator('button[type="submit"]').click();`;
    else if (lower.includes('verify')) code += `    await expect(page.locator('text=error')).not.toBeVisible();`;
    else code += `    await page.waitForTimeout(1000);`;

    return code;
  }).join('\n\n');

  return `import { test, expect } from '@playwright/test';

test.describe("${tc.testCaseId}", () => {
  test("${tc.scenario}", async ({ page }) => {
${stepCode}
  });
});`;
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
