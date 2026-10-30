import { useState } from 'react';
import { motion } from 'framer-motion';
import { Webhook, Copy, Check, ChevronDown, ChevronRight, Globe, Zap, GitBranch, Play, ShieldCheck } from 'lucide-react';
import { generateAPIEndpoints } from '../lib/ai-engine';
import { toast } from 'sonner';

export default function CICDApi() {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'endpoints' | 'github-actions' | 'webhooks'>('endpoints');
  const [webhookSimStatus, setWebhookSimStatus] = useState<string | null>(null);
  const apiSpec = generateAPIEndpoints() as any;

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const getMethodColor = (method: string) => {
    if (method === 'GET') return 'bg-emerald-50 text-[#16a34a] border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300';
    if (method === 'POST') return 'bg-purple-50 text-[#7c3aed] border-purple-200 dark:bg-purple-950/40 dark:text-purple-300';
    if (method === 'PUT') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300';
    return 'bg-red-50 text-[#dc2626] border-red-200 dark:bg-red-950/40 dark:text-red-300';
  };

  const githubActionsWorkflow = `name: AI Test Suite Quality Gate

on:
  push:
    branches: [ master, main ]
  pull_request:
    branches: [ master, main ]

jobs:
  qa-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Trigger AI Prioritized Test Suite
        run: |
          curl -X POST https://generative-ai-based-intelligent-aut-delta.vercel.app/api/ai/prioritize-tests \\
            -H "Content-Type: application/json" \\
            -H "Authorization: Bearer \${{ secrets.JNET_API_TOKEN }}" \\
            -d '{"projectId": "default", "gateThreshold": 80}'
`;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#f0f9ff] dark:bg-slate-900">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0] dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/40 flex items-center justify-center text-[#0ea5e9]">
            <Webhook className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
              CI/CD Integration API & Webhooks
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-sky-50 text-[#0ea5e9] dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200">
                REST & Automation
              </span>
            </h2>
            <p className="text-xs text-[#64748b]">Integrate automated test case generation and quality gates directly into GitHub Actions, GitLab CI, and Jenkins</p>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg p-1 border border-[#e2e8f0] dark:border-slate-700 text-xs shadow-2xs">
          {(['endpoints', 'github-actions', 'webhooks'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md font-semibold capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-[#0ea5e9] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              {tab === 'github-actions' ? 'GitHub Actions' : tab}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-1.5">
            <Globe className="w-4 h-4 text-[#7c3aed]" />
            <span className="text-[10px] font-bold text-muted uppercase">Base URL</span>
          </div>
          <code className="text-xs font-mono font-bold text-[#7c3aed]">{apiSpec.baseUrl}</code>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-bold text-muted uppercase">API Version</span>
          </div>
          <code className="text-xs font-mono font-bold text-foreground">{apiSpec.version} (Active)</code>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-[#16a34a]" />
            <span className="text-[10px] font-bold text-muted uppercase">Authentication</span>
          </div>
          <code className="text-xs font-mono font-bold text-[#16a34a]">Bearer JWT Token</code>
        </div>
      </div>

      {activeTab === 'github-actions' ? (
        /* GitHub Actions Tab */
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#7c3aed]" />
              <span>Ready-to-Use GitHub Actions CI Workflow</span>
            </h3>
            <button
              onClick={() => handleCopy(githubActionsWorkflow, 999)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-50 text-[#7c3aed] border border-purple-200 hover:bg-purple-100"
            >
              {copiedIdx === 999 ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Workflow YAML</span>
            </button>
          </div>
          <p className="text-xs text-muted">
            Add this file to <code className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded">.github/workflows/jnet-testing.yml</code> to run AI testing checks on pull requests.
          </p>
          <pre className="p-4 rounded-xl bg-[#0f172a] text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
            <code>{githubActionsWorkflow}</code>
          </pre>
        </div>
      ) : activeTab === 'webhooks' ? (
        /* Webhooks Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Configured Webhook Triggers</h3>
            <button
              onClick={() => {
                setWebhookSimStatus('Dispatched ping test payload to webhook listener: HTTP 200 OK');
                toast.success('Dispatched test webhook payload');
              }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-[#16a34a] border border-emerald-200 hover:bg-emerald-100"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Test Ping Webhook</span>
            </button>
          </div>

          {webhookSimStatus && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-[#16a34a] font-medium">
              {webhookSimStatus}
            </div>
          )}

          <div className="space-y-3">
            {Object.entries(apiSpec.webhooks).map(([key, wh]: [string, any]) => (
              <div key={key} className="bg-white dark:bg-slate-800 border border-border rounded-xl p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#7c3aed]" />
                    <span className="text-xs font-bold text-foreground">{key}</span>
                  </div>
                  <code className="text-xs font-mono text-[#0ea5e9] bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded border border-sky-200">
                    {wh.url}
                  </code>
                </div>
                <div className="bg-[#0f172a] rounded-lg p-3 text-slate-200 text-xs font-mono">
                  <pre>{JSON.stringify(wh.payload, null, 2)}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Endpoints Tab */
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider">REST Endpoints ({apiSpec.endpoints.length})</h3>
          {apiSpec.endpoints.map((ep: any, i: number) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 border border-border rounded-xl overflow-hidden shadow-xs hover:border-border-bright transition-colors"
            >
              <button
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                className="w-full flex items-center gap-3 p-3.5 text-left text-xs"
              >
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded border font-mono ${getMethodColor(ep.method)}`}>
                  {ep.method}
                </span>
                <code className="text-xs font-mono font-bold text-[#7c3aed] flex-1">{ep.path}</code>
                <span className="text-xs text-muted hidden sm:block font-medium">{ep.description}</span>
                {expandedIdx === i ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
              </button>

              {expandedIdx === i && (
                <div className="border-t border-border p-4 space-y-3 bg-slate-50/50 dark:bg-slate-850 text-xs">
                  <p className="text-foreground font-medium">{ep.description}</p>
                  {ep.body && (
                    <div>
                      <span className="text-[10px] font-bold text-muted uppercase">Sample Request Body</span>
                      <div className="mt-1 bg-[#0f172a] rounded-lg p-3 relative text-slate-200 font-mono">
                        <pre>{JSON.stringify(ep.body, null, 2)}</pre>
                        <button
                          onClick={() => handleCopy(JSON.stringify(ep.body, null, 2), i)}
                          className="absolute top-2 right-2 text-slate-400 hover:text-white"
                        >
                          {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase">Sample Response</span>
                    <div className="mt-1 bg-[#0f172a] rounded-lg p-3 text-slate-200 font-mono">
                      <pre>{JSON.stringify(ep.response, null, 2)}</pre>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase">cURL Example</span>
                    <div className="mt-1 bg-[#0f172a] rounded-lg p-3 relative text-emerald-400 font-mono">
                      <pre className="whitespace-pre-wrap">{`curl -X ${ep.method} \\\n  ${apiSpec.baseUrl}${ep.path} \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer <token>"${ep.body ? ` \\\n  -d '${JSON.stringify(ep.body)}'` : ''}`}</pre>
                      <button
                        onClick={() => handleCopy(`curl -X ${ep.method} ${apiSpec.baseUrl}${ep.path} -H "Content-Type: application/json" -H "Authorization: Bearer <token>"`, i + 100)}
                        className="absolute top-2 right-2 text-slate-400 hover:text-white"
                      >
                        {copiedIdx === i + 100 ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
