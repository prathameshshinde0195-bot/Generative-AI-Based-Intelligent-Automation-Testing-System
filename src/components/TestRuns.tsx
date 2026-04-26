import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, FlaskConical, Play, RefreshCw, Square, Terminal, XCircle } from 'lucide-react';
import { getResolvedApiBaseUrl, testCaseAPI, testRunAPI } from '../lib/api';
import { useAppStore } from '../lib/store';
import { toast } from 'sonner';

type TcCheckResult = {
  testCaseId: string;
  scenario: string;
  variantLabel?: string;
  endpoint: string;
  method: string;
  expectedStatus: number;
  actualStatus: number | null;
  expectedText?: string;
  textMatched: boolean;
  passed: boolean;
  message: string;
  requestSnippet?: string;
  responseSnippet?: string;
  retriesUsed?: number;
};

type RealtimeVariant = {
  label: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: Record<string, unknown> | null;
  headers?: Record<string, string> | null;
  query?: Record<string, string> | null;
  expectedStatus: number;
  expectedText?: string;
  assertionType?: 'status' | 'text' | 'status+text' | 'jsonPath';
  assertionJsonPath?: string;
  assertionExpectedValue?: string;
  maxRetries?: number;
};

type RealtimeConfig = {
  targetBaseUrl?: string;
  variants?: RealtimeVariant[];
  checks?: Array<{
    testCaseId: string;
    scenario?: string;
    endpoint: string;
    method: string;
    expectedStatus: number;
    expectedText?: string;
    variants?: RealtimeVariant[];
  }>;
};

type TestRun = {
  runId: string;
  framework: string;
  runType?: 'command' | 'realtime-tc';
  command?: string;
  status: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  externalUrl?: string;
  realtimeConfig?: RealtimeConfig;
  tcCheckSummary?: { total: number; passed: number; failed: number };
  tcCheckResults?: TcCheckResult[];
};

type LiteTestCase = {
  id: string;
  testCaseId: string;
  scenario: string;
};

type StoreTestCaseLite = {
  id?: string;
  testCaseId?: string;
  scenario?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: string }).message || fallback);
  }
  return fallback;
}

function formatDuration(ms?: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function downloadTextFile(filename: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function TestRuns() {
  const generatedTestCases = useAppStore((s) => s.testCases) as StoreTestCaseLite[];
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [testCases, setTestCases] = useState<LiteTestCase[]>([]);
  const [selectedTcIds, setSelectedTcIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<TestRun | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'connected' | 'disconnected'>('disconnected');

  const [runType, setRunType] = useState<'command' | 'realtime-tc'>('command');
  const [framework, setFramework] = useState<'playwright' | 'cypress' | 'selenium' | 'other'>('playwright');
  const [command, setCommand] = useState('npx playwright test');
  const [execute, setExecute] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [targetBaseUrl, setTargetBaseUrl] = useState('http://localhost:5000');
  const [endpointPath, setEndpointPath] = useState('/api/version');
  const [autoPrepareData, setAutoPrepareData] = useState(true);
  const [variants, setVariants] = useState<RealtimeVariant[]>([
    { label: 'valid-login', method: 'POST', body: { email: 'valid@example.com', password: 'Valid@123' }, expectedStatus: 200, expectedText: 'token', assertionType: 'status+text', maxRetries: 1 },
    { label: 'invalid-password', method: 'POST', body: { email: 'valid@example.com', password: 'wrong' }, expectedStatus: 401, expectedText: 'Invalid', assertionType: 'status+text', maxRetries: 0 },
  ]);

  const load = async (keepSelection = true) => {
    setIsLoading(true);
    try {
      const res = await testRunAPI.list();
      const list = (res?.data || []) as TestRun[];
      setRuns(list);
      if (keepSelection && selected) {
        const updated = list.find((r) => r.runId === selected.runId) || null;
        setSelected(updated);
      }
      return list;
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to load test runs'));
      return [] as TestRun[];
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load(false);
    void loadTestCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTestCases = async () => {
    try {
      const res = await testCaseAPI.getAll({ limit: 100 });
      const list = (res?.data || []) as Array<{ _id?: string; id?: string; testCaseId?: string; scenario?: string }>;
      const backendMapped = list.map((tc) => ({
        id: String(tc._id || tc.id),
        testCaseId: String(tc.testCaseId || ''),
        scenario: String(tc.scenario || ''),
      })).filter((tc) => tc.testCaseId);

      const localMapped = generatedTestCases.map((tc, idx) => ({
        id: String(tc.id || `local-${idx}-${tc.testCaseId || ''}`),
        testCaseId: String(tc.testCaseId || ''),
        scenario: String(tc.scenario || ''),
      })).filter((tc) => tc.testCaseId);

      const mergedMap = new Map<string, LiteTestCase>();
      for (const tc of [...backendMapped, ...localMapped]) {
        if (!mergedMap.has(tc.testCaseId)) mergedMap.set(tc.testCaseId, tc);
      }
      const merged = Array.from(mergedMap.values());

      setTestCases(merged);
      if (merged.length > 0 && selectedTcIds.length === 0) {
        setSelectedTcIds([merged[0].testCaseId]);
      }
    } catch (e: unknown) {
      const localMapped = generatedTestCases.map((tc, idx) => ({
        id: String(tc.id || `local-${idx}-${tc.testCaseId || ''}`),
        testCaseId: String(tc.testCaseId || ''),
        scenario: String(tc.scenario || ''),
      })).filter((tc) => tc.testCaseId);
      setTestCases(localMapped);
      if (localMapped.length > 0 && selectedTcIds.length === 0) {
        setSelectedTcIds([localMapped[0].testCaseId]);
      }
      if (localMapped.length === 0) {
        toast.error(getErrorMessage(e, 'Failed to load test cases'));
      }
    }
  };

  useEffect(() => {
    // Prefer SSE streaming for active runs; fall back to polling if SSE fails.
    if (!selected) return;

    const isActiveSelected = selected.status === 'Running' || selected.status === 'Queued';
    if (!isActiveSelected) {
      setStreamStatus('disconnected');
      return;
    }

    const token = localStorage.getItem('token');
    const base = getResolvedApiBaseUrl() || 'http://localhost:5000/api';
    const url = `${base}/test-runs/${encodeURIComponent(selected.runId)}/stream?token=${encodeURIComponent(token || '')}`;
    const es = new EventSource(url);

    es.onopen = () => setStreamStatus('connected');
    es.onerror = () => {
      setStreamStatus('disconnected');
      try { es.close(); } catch { /* ignore */ }
    };

    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data || '{}');
        if (!msg?.type) return;

        if (msg.type === 'snapshot' && msg.run) {
          const run = msg.run as TestRun;
          setSelected(run);
          setRuns((prev) => {
            const idx = prev.findIndex((r) => r.runId === run.runId);
            if (idx === -1) return [run, ...prev];
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...run };
            return copy;
          });
          return;
        }

        setSelected((cur) => {
          if (!cur || cur.runId !== selected.runId) return cur;
          if (msg.type === 'stdout') return { ...cur, stdout: (cur.stdout || '') + (msg.chunk || '') };
          if (msg.type === 'stderr') return { ...cur, stderr: (cur.stderr || '') + (msg.chunk || '') };
          if (msg.type === 'status') return { ...cur, status: msg.status || cur.status, startedAt: msg.startedAt || cur.startedAt };
          if (msg.type === 'pid') return { ...cur };
          if (msg.type === 'done') {
            return {
              ...cur,
              status: msg.status || cur.status,
              exitCode: msg.exitCode ?? cur.exitCode,
              finishedAt: msg.finishedAt || cur.finishedAt,
              durationMs: msg.durationMs ?? cur.durationMs,
            };
          }
          return cur;
        });

        if (msg.type === 'done' || msg.type === 'status') {
          // Refresh list row so badges/duration update quickly.
          void load(true);
        }
      } catch {
        // ignore malformed messages
      }
    };

    // Safety net: poll occasionally in case browser/server drops SSE silently.
    const poll = window.setInterval(() => void load(true), 5000);

    return () => {
      window.clearInterval(poll);
      try { es.close(); } catch { /* ignore */ }
      setStreamStatus('disconnected');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.runId, selected?.status]);

  const createRun = async () => {
    try {
      const payload: {
        framework: 'playwright' | 'cypress' | 'selenium' | 'other';
        runType: 'command' | 'realtime-tc';
        externalUrl: string;
        execute: boolean;
        command?: string;
        realtimeConfig?: RealtimeConfig;
      } = {
        framework,
        runType,
        externalUrl: externalUrl.trim(),
        execute,
      };
      if (runType === 'command') {
        payload.command = command.trim();
      } else {
        if (selectedTcIds.length === 0) {
          toast.error('Select at least one test case for realtime check');
          return;
        }
        if (variants.length === 0 || variants.some((v) => !v.label.trim())) {
          toast.error('Add at least one valid dataset variant');
          return;
        }
        payload.command = '';
        const selectedCases = testCases.filter((tc) => selectedTcIds.includes(tc.testCaseId));
        const prepareVariantsForScenario = (scenario: string): RealtimeVariant[] => {
          const lower = scenario.toLowerCase();
          if (lower.includes('login') || lower.includes('authenticate') || lower.includes('password')) {
            return [
              { label: 'valid-credentials', method: 'POST', body: { email: 'qa.valid@example.com', password: 'Valid@123' }, expectedStatus: 200, expectedText: 'token', assertionType: 'status+text', maxRetries: 1 },
              { label: 'invalid-password', method: 'POST', body: { email: 'qa.valid@example.com', password: 'wrong' }, expectedStatus: 401, expectedText: 'Invalid', assertionType: 'status+text', maxRetries: 0 },
              { label: 'invalid-email-format', method: 'POST', body: { email: 'bad-format', password: 'Valid@123' }, expectedStatus: 400, expectedText: 'email', assertionType: 'status+text', maxRetries: 0 },
            ];
          }
          if (lower.includes('register') || lower.includes('signup')) {
            const unique = `user${Date.now()}@example.com`;
            return [
              { label: 'valid-signup', method: 'POST', body: { name: 'QA User', email: unique, password: 'Valid@123', company: 'AI Test Org', department: 'QA' }, expectedStatus: 201, expectedText: 'registered', assertionType: 'status+text', maxRetries: 1 },
              { label: 'missing-password', method: 'POST', body: { name: 'QA User', email: unique }, expectedStatus: 400, expectedText: 'required', assertionType: 'status+text', maxRetries: 0 },
            ];
          }
          if (lower.includes('search')) {
            return [
              { label: 'valid-query', method: 'GET', body: null, expectedStatus: 200, expectedText: '', assertionType: 'status', maxRetries: 1 },
              { label: 'empty-query', method: 'GET', body: null, expectedStatus: 200, expectedText: '', assertionType: 'status', maxRetries: 1 },
            ];
          }
          if (lower.includes('payment') || lower.includes('transaction')) {
            return [
              { label: 'valid-payment', method: 'POST', body: { amount: 100, currency: 'USD', cardNumber: '4111111111111111', cvv: '123' }, expectedStatus: 200, expectedText: '', assertionType: 'status', maxRetries: 1 },
              { label: 'invalid-card', method: 'POST', body: { amount: 100, currency: 'USD', cardNumber: '123', cvv: '12' }, expectedStatus: 400, expectedText: '', assertionType: 'status', maxRetries: 0 },
            ];
          }
          return [
            { label: 'baseline', method: 'GET', body: null, expectedStatus: 200, expectedText: '', assertionType: 'status', maxRetries: 1 },
            { label: 'negative-expectation', method: 'GET', body: null, expectedStatus: 404, expectedText: '', assertionType: 'status', maxRetries: 0 },
          ];
        };

        payload.realtimeConfig = {
          targetBaseUrl: targetBaseUrl.trim(),
          variants,
          checks: selectedCases.map((tc) => ({
            testCaseId: tc.testCaseId,
            scenario: tc.scenario,
            endpoint: endpointPath.trim(),
            method: 'GET',
            expectedStatus: 200,
            expectedText: '',
            variants: autoPrepareData ? prepareVariantsForScenario(tc.scenario) : variants,
          })),
        };
      }

      const res = await testRunAPI.create(payload);
      const created = res?.data as TestRun;
      toast.success('Test run created');
      const list = await load(false);
      const fresh = list.find((r) => r.runId === created.runId) || created;
      setSelected(fresh);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to create test run'));
    }
  };

  const executeRun = async (runId: string) => {
    try {
      await testRunAPI.execute(runId);
      toast.success('Run started');
      await load(true);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to start run'));
    }
  };

  const cancelRun = async (runId: string) => {
    try {
      await testRunAPI.cancel(runId);
      toast.success('Run cancelled');
      await load(true);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to cancel run'));
    }
  };

  const exportRealtimeJson = () => {
    if (!selected || selected.runType !== 'realtime-tc') return;
    const payload = {
      runId: selected.runId,
      status: selected.status,
      summary: selected.tcCheckSummary,
      results: selected.tcCheckResults || [],
    };
    downloadTextFile(`realtime-run-${selected.runId}.json`, JSON.stringify(payload, null, 2), 'application/json');
  };

  const exportRealtimeCsv = () => {
    if (!selected || selected.runType !== 'realtime-tc') return;
    const rows = selected.tcCheckResults || [];
    const headers = ['testCaseId', 'scenario', 'variantLabel', 'method', 'endpoint', 'expectedStatus', 'actualStatus', 'passed', 'message', 'retriesUsed'];
    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.testCaseId,
          r.scenario,
          r.variantLabel || '',
          r.method,
          r.endpoint,
          String(r.expectedStatus),
          String(r.actualStatus ?? ''),
          String(r.passed),
          (r.message || '').replace(/"/g, '""'),
          String(r.retriesUsed ?? 0),
        ].map((v) => `"${v}"`).join(',')
      ),
    ].join('\n');
    downloadTextFile(`realtime-run-${selected.runId}.csv`, csv, 'text/csv');
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Terminal className="w-6 h-6 text-accent" />
          Test Runs
        </h2>
        <p className="text-sm text-muted mt-1">Run commands or validate test cases against realtime endpoints</p>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">Start a run</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Run type</label>
              <select
                value={runType}
                onChange={(e) => setRunType(e.target.value as 'command' | 'realtime-tc')}
                className="w-full h-10 bg-surface border border-border rounded-lg px-3 text-sm text-foreground"
              >
                <option value="command">Command run</option>
                <option value="realtime-tc">Realtime TC check</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Framework</label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value as 'playwright' | 'cypress' | 'selenium' | 'other')}
                className="w-full h-10 bg-surface border border-border rounded-lg px-3 text-sm text-foreground"
              >
                <option value="playwright">Playwright</option>
                <option value="cypress">Cypress</option>
                <option value="selenium">Selenium</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">External URL (optional)</label>
              <input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                className="w-full h-10 bg-surface border border-border rounded-lg px-3 text-sm text-foreground"
                placeholder="CI run link / report URL"
              />
            </div>
          </div>

          {runType === 'command' ? (
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Command (only `npm`/`npx` allowed)
              </label>
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                className="w-full h-10 bg-surface border border-border rounded-lg px-3 text-sm text-foreground font-mono"
                placeholder="npx playwright test"
              />
              <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={execute} onChange={(e) => setExecute(e.target.checked)} className="accent-primary" />
                Execute immediately (requires backend env `ALLOW_TEST_RUN_COMMANDS=true`)
              </label>
            </div>
          ) : (
            <div className="space-y-3 border border-border rounded-lg p-3">
              <p className="text-xs font-semibold text-foreground inline-flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-primary" /> Realtime TC checks
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={targetBaseUrl}
                  onChange={(e) => setTargetBaseUrl(e.target.value)}
                  className="w-full h-10 bg-surface border border-border rounded-lg px-3 text-sm text-foreground"
                  placeholder="Target base URL (e.g. http://localhost:5001)"
                />
                <input
                  value={endpointPath}
                  onChange={(e) => setEndpointPath(e.target.value)}
                  className="w-full h-10 bg-surface border border-border rounded-lg px-3 text-sm text-foreground font-mono"
                  placeholder="/api/version"
                />
              </div>
              <p className="text-[11px] text-muted">
                Tip: use a valid endpoint such as <span className="font-mono text-foreground">/api/version</span> or <span className="font-mono text-foreground">/health</span>.
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-muted uppercase">Test data variants</p>
                  <button
                    type="button"
                    onClick={() =>
                      setVariants((prev) => [
                        ...prev,
                        { label: `variant-${prev.length + 1}`, method: 'POST', body: null, expectedStatus: 200, expectedText: '', assertionType: 'status+text', maxRetries: 0 },
                      ])
                    }
                    className="text-xs text-primary hover:underline"
                  >
                    + Add variant
                  </button>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={autoPrepareData}
                    onChange={(e) => setAutoPrepareData(e.target.checked)}
                    className="accent-primary"
                  />
                  Auto-prepare dataset per selected TC scenario (recommended for mixed SRS cases)
                </label>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {variants.map((variant, idx) => (
                    <div key={`${variant.label}-${idx}`} className="border border-border rounded-lg p-2 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <input
                          value={variant.label}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((v, i) => (i === idx ? { ...v, label: e.target.value } : v))
                            )
                          }
                          className="h-9 bg-surface border border-border rounded px-2 text-xs text-foreground"
                          placeholder="Variant label"
                        />
                        <select
                          value={variant.method}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((v, i) => (i === idx ? { ...v, method: e.target.value as RealtimeVariant['method'] } : v))
                            )
                          }
                          className="h-9 bg-surface border border-border rounded px-2 text-xs text-foreground"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                        <input
                          type="number"
                          value={variant.expectedStatus}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((v, i) => (i === idx ? { ...v, expectedStatus: Number(e.target.value) || 200 } : v))
                            )
                          }
                          className="h-9 bg-surface border border-border rounded px-2 text-xs text-foreground"
                          placeholder="Expected status"
                        />
                        <input
                          value={variant.expectedText || ''}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((v, i) => (i === idx ? { ...v, expectedText: e.target.value } : v))
                            )
                          }
                          className="h-9 bg-surface border border-border rounded px-2 text-xs text-foreground"
                          placeholder="Expected text"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <select
                          value={variant.assertionType || 'status+text'}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((v, i) => (i === idx ? { ...v, assertionType: e.target.value as RealtimeVariant['assertionType'] } : v))
                            )
                          }
                          className="h-9 bg-surface border border-border rounded px-2 text-xs text-foreground"
                        >
                          <option value="status">Assert status</option>
                          <option value="text">Assert text</option>
                          <option value="status+text">Assert status + text</option>
                          <option value="jsonPath">Assert JSON path</option>
                        </select>
                        <input
                          value={variant.assertionJsonPath || ''}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((v, i) => (i === idx ? { ...v, assertionJsonPath: e.target.value } : v))
                            )
                          }
                          className="h-9 bg-surface border border-border rounded px-2 text-xs text-foreground font-mono"
                          placeholder="json path e.g. $.data.token"
                        />
                        <input
                          value={variant.assertionExpectedValue || ''}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((v, i) => (i === idx ? { ...v, assertionExpectedValue: e.target.value } : v))
                            )
                          }
                          className="h-9 bg-surface border border-border rounded px-2 text-xs text-foreground"
                          placeholder="expected json value"
                        />
                        <input
                          type="number"
                          min={0}
                          value={variant.maxRetries || 0}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((v, i) => (i === idx ? { ...v, maxRetries: Math.max(0, Number(e.target.value) || 0) } : v))
                            )
                          }
                          className="h-9 bg-surface border border-border rounded px-2 text-xs text-foreground"
                          placeholder="retries"
                        />
                      </div>
                      <textarea
                        value={variant.body ? JSON.stringify(variant.body) : ''}
                        onChange={(e) => {
                          setVariants((prev) =>
                            prev.map((v, i) => {
                              if (i !== idx) return v;
                              const raw = e.target.value.trim();
                              if (!raw) return { ...v, body: null };
                              try {
                                const parsed = JSON.parse(raw);
                                return { ...v, body: parsed };
                              } catch {
                                return v;
                              }
                            })
                          );
                        }}
                        className="w-full min-h-16 bg-surface border border-border rounded px-2 py-1 text-xs text-foreground font-mono"
                        placeholder='JSON body, e.g. {"email":"qa@test.com","password":"Pass@123"}'
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <textarea
                          value={variant.headers ? JSON.stringify(variant.headers) : ''}
                          onChange={(e) => {
                            setVariants((prev) =>
                              prev.map((v, i) => {
                                if (i !== idx) return v;
                                const raw = e.target.value.trim();
                                if (!raw) return { ...v, headers: null };
                                try {
                                  const parsed = JSON.parse(raw);
                                  return { ...v, headers: parsed };
                                } catch {
                                  return v;
                                }
                              })
                            );
                          }}
                          className="w-full min-h-12 bg-surface border border-border rounded px-2 py-1 text-xs text-foreground font-mono"
                          placeholder='Headers JSON, e.g. {"x-tenant":"demo"}'
                        />
                        <textarea
                          value={variant.query ? JSON.stringify(variant.query) : ''}
                          onChange={(e) => {
                            setVariants((prev) =>
                              prev.map((v, i) => {
                                if (i !== idx) return v;
                                const raw = e.target.value.trim();
                                if (!raw) return { ...v, query: null };
                                try {
                                  const parsed = JSON.parse(raw);
                                  return { ...v, query: parsed };
                                } catch {
                                  return v;
                                }
                              })
                            );
                          }}
                          className="w-full min-h-12 bg-surface border border-border rounded px-2 py-1 text-xs text-foreground font-mono"
                          placeholder='Query JSON, e.g. {"page":"1"}'
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border/60">
                {testCases.length === 0 ? (
                  <p className="p-3 text-xs text-muted">No test cases found.</p>
                ) : (
                  testCases.map((tc) => (
                    <label key={tc.id} className="flex items-start gap-2 p-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        checked={selectedTcIds.includes(tc.testCaseId)}
                        onChange={(e) => {
                          setSelectedTcIds((prev) =>
                            e.target.checked ? [...prev, tc.testCaseId] : prev.filter((id) => id !== tc.testCaseId)
                          );
                        }}
                        className="mt-0.5 accent-primary"
                      />
                      <span className="font-mono text-primary">{tc.testCaseId}</span>
                      <span className="text-muted line-clamp-1">{tc.scenario}</span>
                    </label>
                  ))
                )}
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={execute} onChange={(e) => setExecute(e.target.checked)} className="accent-primary" />
                Execute immediately (recommended)
              </label>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void createRun()}
              className="h-10 px-4 rounded-lg bg-gradient-to-r from-accent to-primary text-white font-semibold inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> Create run
            </button>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-surface-alt flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">History ({runs.length})</p>
            <button
              type="button"
              onClick={() => void load(true)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-surface hover:bg-surface-alt transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-muted ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border/60">
            {runs.length === 0 ? (
              <div className="p-6 text-sm text-muted">No runs yet.</div>
            ) : (
              runs.map((r) => (
                <button
                  key={r.runId}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left px-5 py-4 hover:bg-surface-alt transition-colors ${
                    selected?.runId === r.runId ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-primary font-bold">{r.runId}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted uppercase">{r.framework}</span>
                    {r.runType === 'realtime-tc' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/30 uppercase">
                        realtime-tc
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        r.status === 'Passed'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : r.status === 'Failed'
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : r.status === 'Running'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-surface-alt text-muted border-border'
                      }`}
                    >
                      {r.status}
                    </span>
                    <span className="ml-auto text-xs text-muted">{formatDuration(r.durationMs)}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-muted font-mono truncate">
                    {r.runType === 'realtime-tc'
                      ? `${r.realtimeConfig?.targetBaseUrl || '—'} (${r.tcCheckSummary?.passed || 0}/${r.tcCheckSummary?.total || 0} passed)`
                      : r.command || r.externalUrl || '—'}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {selected && (
        <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Run details</p>
            <span className="text-xs font-mono text-primary">{selected.runId}</span>
            {(selected.status === 'Running' || selected.status === 'Queued') && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                streamStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {streamStatus === 'connected' ? 'LIVE' : 'SYNCING'}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {selected.runType === 'realtime-tc' && (
                <>
                  <button
                    type="button"
                    onClick={exportRealtimeCsv}
                    className="h-9 px-3 rounded-lg border border-border bg-surface hover:bg-surface-alt text-xs text-foreground"
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={exportRealtimeJson}
                    className="h-9 px-3 rounded-lg border border-border bg-surface hover:bg-surface-alt text-xs text-foreground"
                  >
                    Export JSON
                  </button>
                </>
              )}
              {(selected.status === 'Created' || selected.status === 'Failed') && (
                <button
                  type="button"
                  onClick={() => void executeRun(selected.runId)}
                  className="h-9 px-3 rounded-lg border border-border bg-surface hover:bg-surface-alt text-sm text-foreground inline-flex items-center gap-2"
                >
                  <Play className="w-4 h-4 text-primary" /> Execute
                </button>
              )}
              {(selected.status === 'Running' || selected.status === 'Queued') && (
                <button
                  type="button"
                  onClick={() => void cancelRun(selected.runId)}
                  className="h-9 px-3 rounded-lg border border-border bg-surface hover:bg-surface-alt text-sm text-foreground inline-flex items-center gap-2"
                >
                  <Square className="w-4 h-4 text-red-400" /> Cancel
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-surface-alt border border-border rounded-lg p-3">
              <p className="text-muted">Status</p>
              <p className="text-foreground font-semibold mt-1">{selected.status}</p>
            </div>
            <div className="bg-surface-alt border border-border rounded-lg p-3">
              <p className="text-muted">Duration</p>
              <p className="text-foreground font-semibold mt-1">{formatDuration(selected.durationMs)}</p>
            </div>
            <div className="bg-surface-alt border border-border rounded-lg p-3">
              <p className="text-muted">Exit code</p>
              <p className="text-foreground font-semibold mt-1">{selected.exitCode ?? '—'}</p>
            </div>
            <div className="bg-surface-alt border border-border rounded-lg p-3">
              <p className="text-muted">External</p>
              <p className="text-foreground font-semibold mt-1 truncate">{selected.externalUrl || '—'}</p>
            </div>
          </div>

          {selected.runType === 'realtime-tc' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-surface-alt border border-border rounded-lg p-3">
                  <p className="text-muted">Checks</p>
                  <p className="text-foreground font-semibold mt-1">{selected.tcCheckSummary?.total ?? 0}</p>
                </div>
                <div className="bg-surface-alt border border-border rounded-lg p-3">
                  <p className="text-muted">Passed</p>
                  <p className="text-emerald-400 font-semibold mt-1">{selected.tcCheckSummary?.passed ?? 0}</p>
                </div>
                <div className="bg-surface-alt border border-border rounded-lg p-3">
                  <p className="text-muted">Failed</p>
                  <p className="text-red-400 font-semibold mt-1">{selected.tcCheckSummary?.failed ?? 0}</p>
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-2 text-xs font-semibold text-muted uppercase bg-surface-alt">Per test case dataset checks</div>
                <div className="max-h-64 overflow-y-auto divide-y divide-border/60">
                  {(selected.tcCheckResults || []).length === 0 ? (
                    <p className="p-3 text-xs text-muted">No realtime check results yet.</p>
                  ) : (
                    (selected.tcCheckResults || []).map((r, idx) => (
                      <div key={`${r.testCaseId}-${idx}`} className="p-3 space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          {r.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                          <span className="font-mono text-primary">{r.testCaseId}</span>
                          <span className="text-muted truncate">{r.scenario}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted">{r.variantLabel || 'default'}</span>
                          <span className="ml-auto text-muted font-mono">{r.method} {r.endpoint}</span>
                        </div>
                        <p className="text-[11px] text-muted">
                          Expected {r.expectedStatus}{r.expectedText ? ` + "${r.expectedText}"` : ''} | Actual {r.actualStatus ?? 'ERR'}
                        </p>
                        <p className="text-[10px] text-muted">Retries used: {r.retriesUsed ?? 0}</p>
                        {r.requestSnippet ? (
                          <pre className="text-[10px] bg-surface-alt border border-border rounded p-2 whitespace-pre-wrap text-foreground/80 font-mono">
                            Request: {r.requestSnippet}
                          </pre>
                        ) : null}
                        {r.responseSnippet ? (
                          <pre className="text-[10px] bg-surface-alt border border-border rounded p-2 whitespace-pre-wrap text-foreground/80 font-mono">
                            {r.responseSnippet}
                          </pre>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">stdout</p>
              <pre className="text-[11px] bg-surface-alt border border-border rounded-lg p-3 whitespace-pre-wrap text-foreground/80 font-mono max-h-[260px] overflow-y-auto">
                {selected.stdout || '—'}
              </pre>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">stderr</p>
              <pre className="text-[11px] bg-surface-alt border border-border rounded-lg p-3 whitespace-pre-wrap text-foreground/80 font-mono max-h-[260px] overflow-y-auto">
                {selected.stderr || '—'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

