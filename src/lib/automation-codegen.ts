/**
 * Converts natural-language test steps into executable automation actions.
 * Used by Automation Script Generator for framework-specific runnable code.
 */
import type { TestCase, AutomationFramework, GeneratedScript } from './types';

export type AutomationAction =
  | { kind: 'navigate'; url: string; comment: string }
  | { kind: 'fill'; target: string; value: string; by: 'name' | 'label' | 'css' | 'placeholder'; comment: string }
  | { kind: 'click'; target: string; by: 'role' | 'text' | 'css' | 'name'; comment: string }
  | { kind: 'select'; target: string; value: string; comment: string }
  | { kind: 'wait'; ms: number; comment: string }
  | { kind: 'assertText'; text: string; comment: string }
  | { kind: 'assertUrl'; pattern: string; comment: string }
  | { kind: 'assertVisible'; target: string; comment: string }
  | { kind: 'assertNotVisible'; target: string; comment: string }
  | { kind: 'assertTitle'; text: string; comment: string }
  | { kind: 'custom'; comment: string };

const QUOTED = /["'`]([^"'`]+)["'`]/;
const BASE_URL = (import.meta as any).env?.VITE_APP_BASE_URL || 'http://localhost:5174';

function extractQuoted(step: string): string | null {
  const m = step.match(QUOTED);
  return m ? m[1] : null;
}

function fieldGuess(step: string): { name: string; by: 'name' | 'label' | 'placeholder' } {
  const lower = step.toLowerCase();
  if (lower.includes('email')) return { name: 'email', by: 'name' };
  if (lower.includes('username') || lower.includes('user name') || lower.includes('user id')) return { name: 'username', by: 'name' };
  if (lower.includes('password') || lower.includes('passwd')) return { name: 'password', by: 'name' };
  if (lower.includes('phone') || lower.includes('mobile')) return { name: 'phone', by: 'name' };
  if (lower.includes('search')) return { name: 'search', by: 'name' };
  if (lower.includes('name') && !lower.includes('username')) return { name: 'name', by: 'name' };
  if (lower.includes('amount')) return { name: 'amount', by: 'name' };
  if (lower.includes('card')) return { name: 'cardNumber', by: 'name' };
  const quoted = extractQuoted(step);
  if (quoted) return { name: quoted, by: 'label' };
  return { name: 'input', by: 'name' };
}

function defaultValueForField(field: string, scenario: string, category: string): string {
  const neg = category === 'negative' || /invalid|wrong|fail|error/i.test(scenario);
  const map: Record<string, [string, string]> = {
    email: ['qa.valid@example.com', 'bad-format'],
    username: ['qa_user', ''],
    password: ['Valid@12345', 'wrong'],
    name: ['QA Tester', ''],
    phone: ['+15551234567', '123'],
    search: ['test query', ''],
    amount: ['100', '-1'],
    cardNumber: ['4111111111111111', '123'],
    input: ['valid test data', '@@@invalid@@@'],
  };
  const pair = map[field] || map.input;
  return neg ? pair[1] : pair[0];
}

export function parseStepToAction(step: string, tc: TestCase): AutomationAction {
  const lower = step.toLowerCase();
  const comment = step;

  if (/navigate|open|go to|visit|launch|browse/.test(lower)) {
    const quoted = extractQuoted(step);
    let url = quoted || '/';
    if (/login|sign.?in|auth/.test(lower + ' ' + tc.scenario.toLowerCase())) url = quoted || '/login';
    else if (/register|sign.?up/.test(lower)) url = quoted || '/register';
    else if (/dashboard|home/.test(lower)) url = quoted || '/dashboard';
    else if (/search/.test(lower)) url = quoted || '/search';
    if (url.startsWith('http')) return { kind: 'navigate', url, comment };
    return { kind: 'navigate', url: url.startsWith('/') ? url : `/${url}`, comment };
  }

  if (/enter|type|fill|input|provide|set|write/.test(lower) && !/verify|assert|check|ensure/.test(lower)) {
    const field = fieldGuess(step);
    const quoted = extractQuoted(step);
    const value = quoted && !/field|button|page|form/i.test(quoted)
      ? quoted
      : defaultValueForField(field.name, tc.scenario, tc.category);
    return { kind: 'fill', target: field.name, value, by: field.by, comment };
  }

  if (/select|choose|pick/.test(lower) && !/verify/.test(lower)) {
    const quoted = extractQuoted(step);
    return { kind: 'select', target: 'select', value: quoted || 'Option 1', comment };
  }

  if (/click|press|tap|submit|confirm|save|login|sign in|register/.test(lower) && !/verify|assert|ensure/.test(lower)) {
    const quoted = extractQuoted(step);
    if (/login|sign in/.test(lower)) return { kind: 'click', target: 'Login', by: 'role', comment };
    if (/submit|save|confirm|register|sign up/.test(lower)) {
      return { kind: 'click', target: quoted || 'Submit', by: quoted ? 'text' : 'role', comment };
    }
    return { kind: 'click', target: quoted || 'button', by: quoted ? 'text' : 'css', comment };
  }

  if (/wait|pause|delay/.test(lower)) {
    return { kind: 'wait', ms: 1000, comment };
  }

  if (/verify|assert|check|ensure|validate|confirm that|should see|expect/.test(lower)) {
    if (/url|redirect|navigat/.test(lower)) {
      const quoted = extractQuoted(step);
      const pattern = quoted || (/dashboard/.test(lower) ? 'dashboard' : /login/.test(lower) ? 'login' : '.*');
      return { kind: 'assertUrl', pattern, comment };
    }
    if (/not (visible|display|appear|show)|absent|disappear|error.*not/.test(lower)) {
      return { kind: 'assertNotVisible', target: extractQuoted(step) || 'error', comment };
    }
    if (/title/.test(lower)) {
      return { kind: 'assertTitle', text: extractQuoted(step) || tc.scenario.slice(0, 40), comment };
    }
    if (/visible|display|appear|show|message|toast|success|error|text/.test(lower)) {
      const quoted = extractQuoted(step);
      const fromExpected = (tc.expectedResults || '').match(QUOTED)?.[1];
      return { kind: 'assertText', text: quoted || fromExpected || inferAssertText(tc), comment };
    }
    return { kind: 'assertVisible', target: extractQuoted(step) || 'body', comment };
  }

  return { kind: 'custom', comment };
}

function inferAssertText(tc: TestCase): string {
  const exp = (tc.expectedResults || '').toLowerCase();
  if (exp.includes('success')) return 'success';
  if (exp.includes('error') || exp.includes('invalid')) return 'error';
  if (exp.includes('dashboard')) return 'dashboard';
  if (exp.includes('token')) return 'token';
  return 'success';
}

export function buildActionsFromTestCase(tc: TestCase): AutomationAction[] {
  const actions: AutomationAction[] = [];
  const steps = Array.isArray(tc.steps) ? tc.steps : String(tc.steps || '').split(/\n|;/).filter(Boolean);
  const preconds = typeof tc.preconditions === 'string'
    ? [tc.preconditions]
    : (tc.preconditions as unknown as string[]) || [];

  // Ensure we start from an app URL if no navigate step exists
  const hasNavigate = steps.some((s) => /navigate|open|go to|visit|launch|browse/i.test(s));
  if (!hasNavigate) {
    const scenario = tc.scenario.toLowerCase();
    let start = '/';
    if (/login|auth|sign.?in/.test(scenario)) start = '/login';
    else if (/register|sign.?up/.test(scenario)) start = '/register';
    else if (/dashboard/.test(scenario)) start = '/dashboard';
    actions.push({ kind: 'navigate', url: start, comment: `Open application (${preconds[0] || 'app ready'})` });
  }

  for (const step of steps) {
    actions.push(parseStepToAction(step, tc));
  }

  // Always add assertion from expected results if none present
  const hasAssert = actions.some((a) => a.kind.startsWith('assert'));
  if (!hasAssert && tc.expectedResults) {
    actions.push({
      kind: 'assertText',
      text: inferAssertText(tc),
      comment: `Expected: ${tc.expectedResults.slice(0, 120)}`,
    });
  }

  return actions;
}

function sanitizeClassName(id: string) {
  return id.replace(/[^a-zA-Z0-9]/g, '_');
}

function renderPlaywright(tc: TestCase, actions: AutomationAction[]): string {
  const reqId = tc.requirementId || 'REQ-GENERAL';
  const reqDesc = tc.requirementDescription || tc.title || tc.scenario;
  const dataBlock = tc.testData
    ? `\n    // Test Data Parameters\n    const testData = ${JSON.stringify(tc.testData)};\n`
    : '';

  const lines = actions.map((a) => {
    switch (a.kind) {
      case 'navigate':
        return `    // Step: ${a.comment}\n    await page.goto(${JSON.stringify(a.url)});`;
      case 'fill':
        if (a.by === 'name') return `    // Step: ${a.comment}\n    await page.locator('input[name="${a.target}"], [name="${a.target}"]').first().fill(${JSON.stringify(a.value)});`;
        if (a.by === 'placeholder') return `    // Step: ${a.comment}\n    await page.getByPlaceholder(${JSON.stringify(a.target)}).fill(${JSON.stringify(a.value)});`;
        return `    // Step: ${a.comment}\n    await page.getByLabel(${JSON.stringify(a.target)}, { exact: false }).fill(${JSON.stringify(a.value)});`;
      case 'click':
        if (a.by === 'role') return `    // Step: ${a.comment}\n    await page.getByRole('button', { name: /${a.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i }).click();`;
        if (a.by === 'text') return `    // Step: ${a.comment}\n    await page.getByText(${JSON.stringify(a.target)}, { exact: false }).click();`;
        if (a.by === 'name') return `    // Step: ${a.comment}\n    await page.locator('[name="${a.target}"]').click();`;
        return `    // Step: ${a.comment}\n    await page.locator('button[type="submit"], button').first().click();`;
      case 'select':
        return `    // Step: ${a.comment}\n    await page.locator('select').first().selectOption({ label: ${JSON.stringify(a.value)} });`;
      case 'wait':
        return `    // Step: ${a.comment}\n    await page.waitForTimeout(${a.ms});`;
      case 'assertUrl':
        return `    // Assertion: ${a.comment}\n    await expect(page).toHaveURL(new RegExp(${JSON.stringify(a.pattern)}, 'i'));`;
      case 'assertText':
        return `    // Assertion: ${a.comment}\n    await expect(page.getByText(${JSON.stringify(a.text)}, { exact: false })).toBeVisible({ timeout: 10000 });`;
      case 'assertVisible':
        return `    // Assertion: ${a.comment}\n    await expect(page.locator('body')).toContainText(${JSON.stringify(a.target)});`;
      case 'assertNotVisible':
        return `    // Assertion: ${a.comment}\n    await expect(page.getByText(${JSON.stringify(a.target)}, { exact: false })).toHaveCount(0);`;
      case 'assertTitle':
        return `    // Assertion: ${a.comment}\n    await expect(page).toHaveTitle(new RegExp(${JSON.stringify(a.text)}, 'i'));`;
      default:
        return `    // Step: ${a.comment}\n    await page.waitForTimeout(500);`;
    }
  });

  return `import { test, expect } from '@playwright/test';

/**
 * ============================================================================
 * Requirement: ${reqId} — ${reqDesc}
 * Test Case:   ${tc.testCaseId} — ${tc.title || tc.scenario}
 * Priority:    ${tc.priority} | Severity: ${tc.severity || 'Major'} | Category: ${tc.category}
 * Expected:    ${tc.expectedResults}
 * Preconditions: ${typeof tc.preconditions === 'string' ? tc.preconditions : JSON.stringify(tc.preconditions)}
 *
 * Execution (Playwright CLI):
 *   npx playwright test ${sanitizeClassName(tc.testCaseId)}.spec.ts --headed
 * ============================================================================
 */
test.describe(${JSON.stringify(`${reqId}: ${tc.testCaseId}`)}, () => {
  test(${JSON.stringify(tc.scenario.slice(0, 120))}, async ({ page }) => {
    test.setTimeout(60000);
${dataBlock}
${lines.join('\n\n')}
  });
});
`;
}

function renderCypress(tc: TestCase, actions: AutomationAction[]): string {
  const reqId = tc.requirementId || 'REQ-GENERAL';
  const reqDesc = tc.requirementDescription || tc.title || tc.scenario;
  const dataBlock = tc.testData
    ? `\n    // Test Data Parameters\n    const testData = ${JSON.stringify(tc.testData)};\n`
    : '';

  const lines = actions.map((a) => {
    switch (a.kind) {
      case 'navigate':
        return `    // Step: ${a.comment}\n    cy.visit(${JSON.stringify(a.url)});`;
      case 'fill':
        if (a.by === 'name') return `    // Step: ${a.comment}\n    cy.get('input[name="${a.target}"], [name="${a.target}"]').first().clear().type(${JSON.stringify(a.value)});`;
        return `    // Step: ${a.comment}\n    cy.contains('label', ${JSON.stringify(a.target)}).parent().find('input').clear().type(${JSON.stringify(a.value)});`;
      case 'click':
        if (a.by === 'role' || a.by === 'text') return `    // Step: ${a.comment}\n    cy.contains('button', /${a.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i).click();`;
        return `    // Step: ${a.comment}\n    cy.get('button[type="submit"], button').first().click();`;
      case 'select':
        return `    // Step: ${a.comment}\n    cy.get('select').first().select(${JSON.stringify(a.value)});`;
      case 'wait':
        return `    // Step: ${a.comment}\n    cy.wait(${a.ms});`;
      case 'assertUrl':
        return `    // Assertion: ${a.comment}\n    cy.url().should('match', /${a.pattern}/i);`;
      case 'assertText':
        return `    // Assertion: ${a.comment}\n    cy.contains(${JSON.stringify(a.text)}, { matchCase: false }).should('be.visible');`;
      case 'assertVisible':
        return `    // Assertion: ${a.comment}\n    cy.contains(${JSON.stringify(a.target)}).should('exist');`;
      case 'assertNotVisible':
        return `    // Assertion: ${a.comment}\n    cy.contains(${JSON.stringify(a.target)}, { matchCase: false }).should('not.exist');`;
      case 'assertTitle':
        return `    // Assertion: ${a.comment}\n    cy.title().should('match', /${a.text}/i);`;
      default:
        return `    // Step: ${a.comment}\n    cy.wait(500);`;
    }
  });

  return `/**
 * ============================================================================
 * Requirement: ${reqId} — ${reqDesc}
 * Test Case:   ${tc.testCaseId} — ${tc.title || tc.scenario}
 * Priority:    ${tc.priority} | Category: ${tc.category}
 * Expected:    ${tc.expectedResults}
 *
 * Execution (Cypress CLI):
 *   npx cypress run --spec cypress/e2e/${sanitizeClassName(tc.testCaseId)}.cy.js
 * ============================================================================
 */
describe(${JSON.stringify(`${reqId} - ${tc.testCaseId}: ${tc.scenario.slice(0, 70)}`)}, () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('verifies requirement execution steps and assertions', () => {
${dataBlock}
${lines.join('\n\n')}
  });
});
`;
}

function renderSeleniumPython(tc: TestCase, actions: AutomationAction[]): string {
  const reqId = tc.requirementId || 'REQ-GENERAL';
  const reqDesc = tc.requirementDescription || tc.title || tc.scenario;
  const cls = sanitizeClassName(tc.testCaseId);
  const dataBlock = tc.testData
    ? `\n        # Test Data Parameters\n        test_data = ${JSON.stringify(tc.testData)}\n`
    : '';

  const lines = actions.map((a) => {
    switch (a.kind) {
      case 'navigate': {
        const url = a.url.startsWith('http') ? a.url : `${BASE_URL}${a.url}`;
        return `        # Step: ${a.comment}\n        driver.get(${JSON.stringify(url)})`;
      }
      case 'fill':
        return `        # Step: ${a.comment}\n        el = driver.find_element(By.CSS_SELECTOR, 'input[name="${a.target}"], [name="${a.target}"]')\n        el.clear()\n        el.send_keys(${JSON.stringify(a.value)})`;
      case 'click':
        if (a.by === 'role' || a.by === 'text') {
          return `        # Step: ${a.comment}\n        driver.find_element(By.XPATH, "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${a.target.toLowerCase()}')]").click()`;
        }
        return `        # Step: ${a.comment}\n        driver.find_element(By.CSS_SELECTOR, "button[type='submit'], button").click()`;
      case 'select':
        return `        # Step: ${a.comment}\n        from selenium.webdriver.support.ui import Select\n        Select(driver.find_element(By.TAG_NAME, "select")).select_by_visible_text(${JSON.stringify(a.value)})`;
      case 'wait':
        return `        # Step: ${a.comment}\n        time.sleep(${(a.ms / 1000).toFixed(1)})`;
      case 'assertUrl':
        return `        # Assertion: ${a.comment}\n        assert re.search(${JSON.stringify(a.pattern)}, driver.current_url, re.I), f"Expected URL to contain ${a.pattern}, got {driver.current_url}"`;
      case 'assertText':
      case 'assertVisible':
        return `        # Assertion: ${a.comment}\n        assert ${JSON.stringify(a.kind === 'assertText' ? a.text : a.target)}.lower() in driver.page_source.lower(), f"Expected text '${a.kind === 'assertText' ? a.text : a.target}' in page source"`;
      case 'assertNotVisible':
        return `        # Assertion: ${a.comment}\n        assert ${JSON.stringify(a.target)}.lower() not in driver.page_source.lower(), f"Unexpected text '${a.target}' found in page source"`;
      case 'assertTitle':
        return `        # Assertion: ${a.comment}\n        assert re.search(${JSON.stringify(a.text)}, driver.title, re.I), f"Expected title to match '${a.text}', got {driver.title}"`;
      default:
        return `        # Step: ${a.comment}\n        time.sleep(0.5)`;
    }
  });

  return `"""
==============================================================================
Requirement: ${reqId} — ${reqDesc}
Test Case:   ${tc.testCaseId} — ${tc.title || tc.scenario}
Priority:    ${tc.priority} | Category: ${tc.category}
Expected:    ${tc.expectedResults}
Preconditions: ${typeof tc.preconditions === 'string' ? tc.preconditions : JSON.stringify(tc.preconditions)}

Run (PyTest):
  pip install selenium pytest
  pytest ${cls}_test.py -q -v
==============================================================================
"""
import re
import time
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options


class Test_${cls}:
    def setup_method(self):
        options = Options()
        options.add_argument("--window-size=1280,720")
        options.add_argument("--no-sandbox")
        self.driver = webdriver.Chrome(options=options)

    def teardown_method(self):
        if hasattr(self, 'driver') and self.driver:
            self.driver.quit()

    def test_${cls.toLowerCase()}(self):
        driver = self.driver
${dataBlock}
${lines.join('\n\n')}
`;
}

function renderSeleniumJava(tc: TestCase, actions: AutomationAction[]): string {
  const reqId = tc.requirementId || 'REQ-GENERAL';
  const reqDesc = tc.requirementDescription || tc.title || tc.scenario;
  const cls = sanitizeClassName(tc.testCaseId) + 'Test';
  const dataBlock = tc.testData
    ? `\n        // Test Data Parameters\n        String testData = ${JSON.stringify(tc.testData)};\n`
    : '';

  const lines = actions.map((a) => {
    switch (a.kind) {
      case 'navigate': {
        const url = a.url.startsWith('http') ? a.url : `${BASE_URL}${a.url}`;
        return `        // Step: ${a.comment}\n        driver.get(${JSON.stringify(url)});`;
      }
      case 'fill':
        return `        // Step: ${a.comment}\n        WebElement input_${a.target.replace(/\W/g, '_')} = driver.findElement(By.cssSelector("input[name='${a.target}'], [name='${a.target}']"));\n        input_${a.target.replace(/\W/g, '_')}.clear();\n        input_${a.target.replace(/\W/g, '_')}.sendKeys(${JSON.stringify(a.value)});`;
      case 'click':
        if (a.by === 'role' || a.by === 'text') {
          return `        // Step: ${a.comment}\n        driver.findElement(By.xpath("//button[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${a.target.toLowerCase()}')]")).click();`;
        }
        return `        // Step: ${a.comment}\n        driver.findElement(By.cssSelector("button[type='submit'], button")).click();`;
      case 'select':
        return `        // Step: ${a.comment}\n        new Select(driver.findElement(By.tagName("select"))).selectByVisibleText(${JSON.stringify(a.value)});`;
      case 'wait':
        return `        // Step: ${a.comment}\n        Thread.sleep(${a.ms});`;
      case 'assertUrl':
        return `        // Assertion: ${a.comment}\n        assertTrue(driver.getCurrentUrl().toLowerCase().matches(".*" + ${JSON.stringify(a.pattern.toLowerCase())} + ".*"), "Current URL did not match expected pattern");`;
      case 'assertText':
      case 'assertVisible':
        return `        // Assertion: ${a.comment}\n        assertTrue(driver.getPageSource().toLowerCase().contains(${JSON.stringify((a.kind === 'assertText' ? a.text : a.target).toLowerCase())}), "Expected text not found in page source");`;
      case 'assertNotVisible':
        return `        // Assertion: ${a.comment}\n        assertFalse(driver.getPageSource().toLowerCase().contains(${JSON.stringify(a.target.toLowerCase())}), "Forbidden text was found in page source");`;
      case 'assertTitle':
        return `        // Assertion: ${a.comment}\n        assertTrue(driver.getTitle().toLowerCase().contains(${JSON.stringify(a.text.toLowerCase())}), "Page title did not contain expected text");`;
      default:
        return `        // Step: ${a.comment}\n        Thread.sleep(500);`;
    }
  });

  return `package com.enterprise.automation.tests;

import org.junit.jupiter.api.*;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.Select;
import static org.junit.jupiter.api.Assertions.*;

/**
 * ============================================================================
 * Requirement: ${reqId} — ${reqDesc}
 * Test Case:   ${tc.testCaseId} — ${tc.title || tc.scenario}
 * Priority:    ${tc.priority} | Category: ${tc.category}
 * Expected:    ${tc.expectedResults}
 * Preconditions: ${typeof tc.preconditions === 'string' ? tc.preconditions : JSON.stringify(tc.preconditions)}
 *
 * Execution (Maven CLI):
 *   mvn test -Dtest=${cls}
 * ============================================================================
 */
public class ${cls} {
    private WebDriver driver;

    @BeforeEach
    public void setUp() {
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--window-size=1280,720");
        options.addArguments("--headless=new");
        driver = new ChromeDriver(options);
    }

    @Test
    @DisplayName(${JSON.stringify(`${reqId}: ${tc.scenario.slice(0, 90)}`)})
    public void executeTestCase() throws InterruptedException {
${dataBlock}
${lines.join('\n\n')}
    }

    @AfterEach
    public void tearDown() {
        if (driver != null) {
            driver.quit();
        }
    }
}
`;
}

export function generateExecutableAutomationScript(
  testCase: TestCase,
  framework: AutomationFramework
): GeneratedScript {
  const actions = buildActionsFromTestCase(testCase);
  const generators: Record<AutomationFramework, () => string> = {
    playwright: () => renderPlaywright(testCase, actions),
    cypress: () => renderCypress(testCase, actions),
    'selenium-python': () => renderSeleniumPython(testCase, actions),
    'selenium-java': () => renderSeleniumJava(testCase, actions),
  };
  const langMap: Record<AutomationFramework, string> = {
    playwright: 'typescript',
    cypress: 'javascript',
    'selenium-python': 'python',
    'selenium-java': 'java',
  };
  const fileMap: Record<AutomationFramework, string> = {
    playwright: `${sanitizeClassName(testCase.testCaseId)}.spec.ts`,
    cypress: `${sanitizeClassName(testCase.testCaseId)}.cy.js`,
    'selenium-python': `${sanitizeClassName(testCase.testCaseId)}_test.py`,
    'selenium-java': `${sanitizeClassName(testCase.testCaseId)}Test.java`,
  };
  const hints: Record<AutomationFramework, string[]> = {
    playwright: ['npm i -D @playwright/test', 'npx playwright install chromium', `npx playwright test ${fileMap.playwright}`],
    cypress: ['npm i -D cypress', `npx cypress run --spec cypress/e2e/${fileMap.cypress}`],
    'selenium-python': ['pip install selenium pytest', `pytest ${fileMap['selenium-python']} -q`],
    'selenium-java': ['Add selenium + junit5 deps', `mvn -Dtest=${sanitizeClassName(testCase.testCaseId)}Test test`],
  };

  return {
    framework,
    testCaseId: testCase.testCaseId,
    code: generators[framework](),
    language: langMap[framework],
    fileName: fileMap[framework],
    runHints: hints[framework],
  };
}
