import { useState } from 'react';
import { motion } from 'framer-motion';
import { Webhook, Copy, Check, ChevronDown, ChevronRight, Globe, Zap } from 'lucide-react';
import { generateAPIEndpoints } from '../lib/ai-engine';

export default function CICDApi() {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const apiSpec = generateAPIEndpoints() as any;

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const getMethodColor = (method: string) => {
    if (method === 'GET') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (method === 'POST') return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    if (method === 'PUT') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-red-500/15 text-red-400 border-red-500/30';
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Webhook className="w-6 h-6 text-accent" />
          CI/CD Integration API
        </h2>
        <p className="text-sm text-muted mt-1">REST endpoints, webhook triggers, and JSON response formats for CI/CD pipelines</p>
      </motion.div>

      {/* API Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-muted uppercase">Base URL</span>
          </div>
          <code className="text-sm font-mono text-primary">{apiSpec.baseUrl}</code>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-warning" />
            <span className="text-xs font-semibold text-muted uppercase">Version</span>
          </div>
          <code className="text-sm font-mono text-foreground">{apiSpec.version}</code>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Webhook className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-muted uppercase">Format</span>
          </div>
          <code className="text-sm font-mono text-foreground">JSON</code>
        </motion.div>
      </div>

      {/* Endpoints */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">REST Endpoints ({apiSpec.endpoints.length})</h3>
        {apiSpec.endpoints.map((ep: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="bg-surface border border-border rounded-lg overflow-hidden hover:border-border-bright transition-colors"
          >
            <button
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              className="w-full flex items-center gap-3 p-3 text-left"
            >
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded border font-mono ${getMethodColor(ep.method)}`}>
                {ep.method}
              </span>
              <code className="text-xs font-mono text-primary flex-1">{ep.path}</code>
              <span className="text-xs text-muted hidden sm:block">{ep.description}</span>
              {expandedIdx === i ? <ChevronDown className="w-3.5 h-3.5 text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-muted" />}
            </button>
            {expandedIdx === i && (
              <div className="border-t border-border p-4 space-y-3">
                <p className="text-xs text-foreground/80">{ep.description}</p>
                {ep.body && (
                  <div>
                    <span className="text-[10px] font-semibold text-muted uppercase">Request Body</span>
                    <div className="mt-1 bg-[#0d1117] rounded-lg p-3 relative">
                      <pre className="text-xs font-mono text-foreground/80">{JSON.stringify(ep.body, null, 2)}</pre>
                      <button
                        onClick={() => handleCopy(JSON.stringify(ep.body, null, 2), i)}
                        className="absolute top-2 right-2 text-muted hover:text-foreground"
                      >
                        {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-semibold text-muted uppercase">Response</span>
                  <div className="mt-1 bg-[#0d1117] rounded-lg p-3">
                    <pre className="text-xs font-mono text-foreground/80">{JSON.stringify(ep.response, null, 2)}</pre>
                  </div>
                </div>
                {/* cURL example */}
                <div>
                  <span className="text-[10px] font-semibold text-muted uppercase">cURL Example</span>
                  <div className="mt-1 bg-[#0d1117] rounded-lg p-3 relative">
                    <pre className="text-xs font-mono text-emerald-400/80 whitespace-pre-wrap">{`curl -X ${ep.method} \\\n  ${apiSpec.baseUrl}${ep.path} \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer <token>"${ep.body ? ` \\\n  -d '${JSON.stringify(ep.body)}'` : ''}`}</pre>
                    <button
                      onClick={() => handleCopy(`curl -X ${ep.method} ${apiSpec.baseUrl}${ep.path} -H "Content-Type: application/json"`, i + 100)}
                      className="absolute top-2 right-2 text-muted hover:text-foreground"
                    >
                      {copiedIdx === i + 100 ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Webhooks */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Webhook Events</h3>
        {Object.entries(apiSpec.webhooks).map(([key, wh]: [string, any], i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-surface border border-accent/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold text-foreground">{key}</span>
              <code className="text-[10px] font-mono text-accent ml-auto">{wh.url}</code>
            </div>
            <div className="bg-[#0d1117] rounded-lg p-3">
              <pre className="text-xs font-mono text-foreground/80">{JSON.stringify(wh.payload, null, 2)}</pre>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
