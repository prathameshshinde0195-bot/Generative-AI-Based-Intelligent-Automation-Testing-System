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
    if (method === 'GET') return 'bg-emerald-50 text-[#16A34A] border-2 border-emerald-200';
    if (method === 'POST') return 'bg-purple-50 text-[#7C3AED] border-2 border-purple-200';
    if (method === 'PUT') return 'bg-amber-50 text-amber-700 border-2 border-amber-200';
    return 'bg-red-50 text-[#DC2626] border-2 border-red-200';
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
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#F0F9FF]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#E0F2FE] bg-white p-5 rounded-2xl shadow-sm border">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white shadow-md shadow-sky-500/10">
            <Webhook className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2 tracking-tight">
              CI/CD Integration API & Webhooks
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-[#FDF2F8] text-[#BE185D] border border-[#FCE7F3]">
                REST & Automation
              </span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5 font-medium">Integrate automated test case generation and quality gates directly into GitHub Actions, GitLab CI, and Jenkins</p>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center bg-white rounded-xl p-1 border-2 border-slate-200 text-xs shadow-xs">
          {(['endpoints', 'github-actions', 'webhooks'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-lg font-black capitalize transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'bg-[#0EA5E9] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              {tab === 'github-actions' ? 'GitHub Actions' : tab}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Info Cards in White, Sky Blue, Purple, and Light Pink */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border-2 border-purple-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-[#8B5CF6]" />
            <span className="text-xs font-black text-[#0F172A] uppercase">Base URL</span>
          </div>
          <code className="text-sm font-mono font-black text-[#7C3AED] bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100 block truncate">{apiSpec.baseUrl}</code>
        </div>
        <div className="bg-white border-2 border-sky-300 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-[#0EA5E9]" />
            <span className="text-xs font-black text-[#0F172A] uppercase">API Version</span>
          </div>
          <code className="text-sm font-mono font-black text-[#0284C7] bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100 block truncate">{apiSpec.version} (Active)</code>
        </div>
        <div className="bg-white border-2 border-pink-300 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-[#BE185D]" />
            <span className="text-xs font-black text-[#0F172A] uppercase">Authentication</span>
          </div>
          <code className="text-sm font-mono font-black text-[#BE185D] bg-[#FDF2F8] px-2.5 py-1 rounded-lg border border-pink-100 block truncate">Bearer JWT Token</code>
        </div>
      </div>

      {activeTab === 'github-actions' ? (
        /* GitHub Actions Tab */
        <div className="bg-white border-2 border-purple-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b-2 border-slate-100">
            <h3 className="text-base font-black text-[#0F172A] flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#7C3AED]" />
              <span>Ready-to-Use GitHub Actions CI Workflow</span>
            </h3>
            <button
              onClick={() => handleCopy(githubActionsWorkflow, 999)}
              className="flex items-center gap-1.5 text-xs font-black px-3.5 py-1.5 rounded-xl bg-purple-50 text-[#7C3AED] border border-purple-200 hover:bg-purple-100 cursor-pointer"
            >
              {copiedIdx === 999 ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Workflow YAML</span>
            </button>
          </div>
          <p className="text-xs text-[#64748B] font-bold">
            Add this file to <code className="text-xs font-mono bg-sky-50 text-[#0284C7] border border-sky-100 px-1.5 py-0.5 rounded-md">.github/workflows/jnet-testing.yml</code> to run AI testing checks on pull requests.
          </p>
          <pre className="p-4 rounded-2xl bg-white border-2 border-slate-200 text-[#0F172A] font-mono text-xs overflow-x-auto leading-relaxed shadow-2xs font-semibold">
            <code>{githubActionsWorkflow}</code>
          </pre>
        </div>
      ) : activeTab === 'webhooks' ? (
        /* Webhooks Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-[#0F172A] uppercase tracking-wider">Configured Webhook Triggers</h3>
            <button
              onClick={() => {
                setWebhookSimStatus('Dispatched ping test payload to webhook listener: HTTP 200 OK');
                toast.success('Dispatched test webhook payload');
              }}
              className="flex items-center gap-1.5 text-xs font-black px-3.5 py-1.5 rounded-xl bg-emerald-50 text-[#16A34A] border-2 border-emerald-200 hover:bg-emerald-100 cursor-pointer shadow-2xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Test Ping Webhook</span>
            </button>
          </div>

          {webhookSimStatus && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-xs text-[#16A34A] font-black">
              {webhookSimStatus}
            </div>
          )}

          <div className="space-y-3">
            {Object.entries(apiSpec.webhooks).map(([key, wh]: [string, any]) => (
              <div key={key} className="bg-white border-2 border-sky-200 rounded-2xl p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#7C3AED]" />
                    <span className="text-xs font-black text-[#0F172A]">{key}</span>
                  </div>
                  <code className="text-xs font-mono font-bold text-[#0EA5E9] bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                    {wh.url}
                  </code>
                </div>
                <div className="bg-white border-2 border-slate-200 rounded-xl p-3 text-[#0F172A] text-xs font-mono font-semibold shadow-2xs">
                  <pre>{JSON.stringify(wh.payload, null, 2)}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Endpoints Tab */
        <div className="space-y-3">
          <h3 className="text-xs font-black text-[#0F172A] uppercase tracking-wider">REST Endpoints ({apiSpec.endpoints.length})</h3>
          {apiSpec.endpoints.map((ep: any, i: number) => (
            <div
              key={i}
              className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:border-[#8B5CF6] transition-colors"
            >
              <button
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                className="w-full flex items-center gap-3 p-4 text-left text-xs cursor-pointer"
              >
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border font-mono ${getMethodColor(ep.method)}`}>
                  {ep.method}
                </span>
                <code className="text-xs font-mono font-black text-[#7C3AED] flex-1">{ep.path}</code>
                <span className="text-xs text-[#64748B] hidden sm:block font-bold">{ep.description}</span>
                {expandedIdx === i ? <ChevronDown className="w-4 h-4 text-[#64748B]" /> : <ChevronRight className="w-4 h-4 text-[#64748B]" />}
              </button>

              {expandedIdx === i && (
                <div className="border-t-2 border-slate-100 p-4 space-y-3 bg-white text-xs">
                  <p className="text-[#0F172A] font-bold">{ep.description}</p>
                  {ep.body && (
                    <div>
                      <span className="text-[10px] font-black text-[#64748B] uppercase">Sample Request Body</span>
                      <div className="mt-1 bg-white border-2 border-slate-200 rounded-xl p-3 relative text-[#0F172A] font-mono font-semibold shadow-2xs">
                        <pre>{JSON.stringify(ep.body, null, 2)}</pre>
                        <button
                          onClick={() => handleCopy(JSON.stringify(ep.body, null, 2), i)}
                          className="absolute top-2 right-2 text-slate-400 hover:text-[#0EA5E9] cursor-pointer"
                        >
                          {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-black text-[#64748B] uppercase">Sample Response</span>
                    <div className="mt-1 bg-white border-2 border-slate-200 rounded-xl p-3 text-[#0F172A] font-mono font-semibold shadow-2xs">
                      <pre>{JSON.stringify(ep.response, null, 2)}</pre>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-black text-[#64748B] uppercase">cURL Example</span>
                    <div className="mt-1 bg-white border-2 border-emerald-200 rounded-xl p-3 relative text-[#0F172A] font-mono font-semibold shadow-2xs">
                      <pre className="whitespace-pre-wrap">{`curl -X ${ep.method} \\\n  ${apiSpec.baseUrl}${ep.path} \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer <token>"${ep.body ? ` \\\n  -d '${JSON.stringify(ep.body)}'` : ''}`}</pre>
                      <button
                        onClick={() => handleCopy(`curl -X ${ep.method} ${apiSpec.baseUrl}${ep.path} -H "Content-Type: application/json" -H "Authorization: Bearer <token>"`, i + 100)}
                        className="absolute top-2 right-2 text-slate-400 hover:text-[#0EA5E9] cursor-pointer"
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
