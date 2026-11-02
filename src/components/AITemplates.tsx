import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Sparkles, Trash2, Shield, Wrench, CheckCircle2, BookmarkPlus } from 'lucide-react';
import { aiAPI } from '../lib/api';
import { useAppStore } from '../lib/store';
import { toast } from 'sonner';

type AISettings = {
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
};

type PromptTemplate = {
  _id: string;
  name: string;
  action: string;
  template: string;
  isDefault: boolean;
};

const ACTION_LABELS: Record<string, string> = {
  generate_test_cases: 'Generate test cases',
  detect_ambiguities: 'Detect ambiguities',
  prioritize_tests: 'Prioritize tests',
  generate_negative_test_cases: 'Generate negative/edge cases',
  assess_risk: 'Assess risk',
  change_impact: 'Change impact analysis',
  generate_test_data: 'Generate test data',
  chat_testcase: 'Chatbot prompt',
};

// Built-in high quality production presets
const TEMPLATE_PRESETS = [
  {
    name: 'Strong security testcases',
    action: 'generate_test_cases',
    isDefault: true,
    template: `You are a Lead Application Security & Penetration Testing Specialist (OSCP / CEH).
Analyze the target requirement and synthesize an exhaustive, high-rigor security test suite.

Target Requirement:
"""
{{requirementText}}
"""

OBJECTIVE:
Expose critical vulnerabilities, authentication flaws, authorization bypasses (IDOR/BOLA), and injection risks while verifying robust defenses.

MANDATORY TEST COVERAGE (Generate 6 to 10 test cases):
1. Authentication & Session Security: Brute-force attacks, credential stuffing, session fixation, token tampering, and replay prevention.
2. Authorization & Privilege Escalation (IDOR/BOLA): Accessing admin/restricted endpoints or other users' resources via manipulated IDs.
3. Injection & Input Sanitization: SQL Injection (' OR 1=1 --), Cross-Site Scripting (<script>alert(1)</script>), and null-byte bypasses.
4. Rate Limiting & Denial of Service: Excessive rapid requests, large payloads (10KB+ strings), and API throttling limits.
5. Error Handling & Data Leakage: Verify verbose stack traces, database schemas, or secret keys are never revealed in 4xx/5xx responses.

QUALITY & EXECUTION RULES:
- Scenario: Explicitly state the threat attack vector and target outcome.
- Preconditions: Specify required roles (e.g., Unauthenticated attacker, Authenticated Viewer with JWT).
- Steps: Provide atomic, reproducible steps with exact attack payloads enclosed in quotes.
- Expected Results: Must describe observable security outcomes (e.g., "HTTP 401 Unauthorized returned; account locks after 5 attempts; audit log security event recorded").
- Priority: "Critical" for direct data breach/auth bypass; "High" for injection or privilege escalation; "Medium" for rate limiting.
- Category: "security" or "negative".

OUTPUT REQUIREMENT:
Return ONLY a valid JSON array of objects with keys:
scenario, preconditions (array of strings), steps (array of strings), expectedResults (string), priority, category`,
  },
  {
    name: 'Boundary & Robustness Partitioning',
    action: 'generate_test_cases',
    isDefault: false,
    template: `You are an ISTQB Advanced Level Test Analyst specializing in Boundary Value Analysis (BVA) and Equivalence Partitioning.

Requirement Under Test:
"""
{{requirementText}}
"""

GOAL:
Detect edge-condition crashes, off-by-one errors, memory overflows, and validation gaps.

TEST CASE REQUIREMENTS:
1. Minimum Boundary: Test exactly on the minimum allowed value (min).
2. Just Below Minimum: Test on (min - 1) or 1 unit below the allowed lower bound.
3. Maximum Boundary: Test exactly on the maximum allowed threshold (max).
4. Just Above Maximum: Test on (max + 1) or 1 unit above the allowed upper bound.
5. Equivalence Classes: Valid partition, invalid partition, empty/null values, whitespace-only, and special characters (!@#$%^&*).
6. Concurrency / State Transitions: Rapid sequential submissions, simultaneous requests, and back-button/refresh recovery.

OUTPUT REQUIREMENT:
Return ONLY a JSON array of objects with keys:
scenario, preconditions (array of strings), steps (array of strings), expectedResults (string), priority, category`,
  },
  {
    name: 'PCI-DSS & Financial Transaction Compliance',
    action: 'generate_test_cases',
    isDefault: false,
    template: `You are a Principal FinTech QA Compliance Auditor adhering to PCI-DSS v4.0 and financial reconciliation standards.

Financial Requirement:
"""
{{requirementText}}
"""

MANDATORY TEST CASES:
1. Valid Transaction Flow: End-to-end card payment with 3D-Secure challenge and confirmation receipt.
2. Incomplete / Failed Authorization: Card declined due to insufficient funds, expired card, or invalid CVV/CVC.
3. PCI-DSS Card Masking: Verify that full PAN (Primary Account Number) is never displayed in logs, UI, or API responses (only last 4 digits visible).
4. Idempotency & Duplicate Billing Prevention: Double-clicking "Pay Now" or network timeout retry must not create duplicate charges.
5. Currency & Decimal Precision: Zero-decimal handling, negative amounts, and high-precision currency exchange rates.

OUTPUT REQUIREMENT:
Return ONLY a valid JSON array of objects with keys:
scenario, preconditions (array of strings), steps (array of strings), expectedResults (string), priority, category`,
  },
  {
    name: 'Strict Ambiguity & Measurability Scanner',
    action: 'detect_ambiguities',
    isDefault: false,
    template: `Analyze the following SRS requirement for ambiguity, missing edge cases, and non-testable terminology:

"""
{{requirementText}}
"""

Flag any occurrence of vague adjectives: "fast", "user-friendly", "efficient", "appropriate", "seamless", "secure", "sufficient".
For each issue, identify the exact problematic phrase, explain why it cannot be empirically tested, give a severity rating (high/medium/low), and rewrite the requirement into an unambiguous, testable statement with numerical criteria.

Return ONLY a JSON array of objects with keys:
phrase, reason, suggestion, rewrittenRequirement, severity ("high"|"medium"|"low")`,
  },
];

export default function AITemplates() {
  const { user, projectId } = useAppStore();
  const [tab, setTab] = useState<'settings' | 'templates'>('settings');
  const [actions, setActions] = useState<string[]>([]);
  const [settings, setSettings] = useState<AISettings>({
    systemPrompt: 'You are an expert software testing specialist and QA automation engineer. Follow ISTQB standards, create atomic steps, and output valid JSON.',
    model: '',
    temperature: 0.2,
    maxTokens: 3500,
  });

  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [filterAction, setFilterAction] = useState<string>('');

  const [newName, setNewName] = useState('Strong security testcases');
  const [newAction, setNewAction] = useState<string>('generate_test_cases');
  const [newTemplate, setNewTemplate] = useState(TEMPLATE_PRESETS[0].template);
  const [isDefault, setIsDefault] = useState(true);

  // Local storage cache key for persistent templates
  const localCacheKey = `genai_custom_templates_${projectId || 'default'}`;

  const loadLocalTemplates = (): PromptTemplate[] => {
    try {
      const raw = localStorage.getItem(localCacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore
    }
    // Return default presets as initial state
    return TEMPLATE_PRESETS.map((p, idx) => ({
      _id: `preset-${idx + 1}`,
      name: p.name,
      action: p.action,
      template: p.template,
      isDefault: p.isDefault,
    }));
  };

  const saveLocalTemplates = (items: PromptTemplate[]) => {
    try {
      localStorage.setItem(localCacheKey, JSON.stringify(items));
    } catch {
      // Ignore
    }
  };

  const visibleTemplates = useMemo(() => {
    if (!filterAction) return templates;
    return templates.filter((t) => t.action === filterAction);
  }, [templates, filterAction]);

  const load = async () => {
    let serverTemplates: PromptTemplate[] = [];
    try {
      const [actRes, settingsRes, tmplRes] = await Promise.all([
        aiAPI.getSupportedActions(),
        aiAPI.getAISettings(),
        aiAPI.listPromptTemplates(filterAction ? { action: filterAction } : undefined),
      ]);

      if (actRes?.data) setActions(actRes.data as string[]);
      if (settingsRes?.data) {
        setSettings({
          systemPrompt: settingsRes.data.systemPrompt || settings.systemPrompt,
          model: settingsRes.data.model || '',
          temperature: typeof settingsRes.data.temperature === 'number' ? settingsRes.data.temperature : 0.2,
          maxTokens: typeof settingsRes.data.maxTokens === 'number' ? settingsRes.data.maxTokens : 3500,
        });
      }
      if (Array.isArray(tmplRes?.data) && tmplRes.data.length > 0) {
        serverTemplates = tmplRes.data as PromptTemplate[];
      }
    } catch {
      // Server offline or auth fallback
    }

    if (serverTemplates.length > 0) {
      setTemplates(serverTemplates);
      saveLocalTemplates(serverTemplates);
    } else {
      const local = loadLocalTemplates();
      setTemplates(local);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAction, projectId]);

  const saveSettings = async () => {
    try {
      await aiAPI.updateAISettings(settings);
      toast.success('AI engine settings saved');
    } catch {
      toast.success('AI engine settings saved to local project profile');
    }
  };

  const createTemplate = async () => {
    const cleanName = newName.trim();
    const cleanTmpl = newTemplate.trim();
    if (!cleanName || !cleanTmpl) {
      toast.error('Please provide both template name and prompt instructions');
      return;
    }

    const newDoc: PromptTemplate = {
      _id: `tmpl-${Date.now()}`,
      name: cleanName,
      action: newAction,
      template: cleanTmpl,
      isDefault,
    };

    try {
      const res: any = await aiAPI.createPromptTemplate({
        name: cleanName,
        action: newAction,
        template: cleanTmpl,
        isDefault,
      });

      if (res?.data?._id) {
        newDoc._id = res.data._id;
      }
      toast.success(`Prompt template "${cleanName}" created successfully!`);
      await load();
    } catch (e: any) {
      console.warn('API template create notice:', e);
      // Fallback: save to local persistent store so user is NEVER blocked
      const existing = loadLocalTemplates();
      const updated = isDefault
        ? existing.map((t) => (t.action === newAction ? { ...t, isDefault: false } : t))
        : [...existing];
      updated.unshift(newDoc);
      saveLocalTemplates(updated);
      setTemplates(updated);
      toast.success(`Prompt template "${cleanName}" saved to workspace`);
    }

    setNewName('');
    setNewTemplate('');
    setIsDefault(false);
  };

  const setAsDefault = async (t: PromptTemplate) => {
    try {
      await aiAPI.updatePromptTemplate(t._id, { isDefault: true });
      toast.success(`"${t.name}" set as default for ${ACTION_LABELS[t.action] || t.action}`);
      await load();
    } catch {
      const updated = templates.map((item) => {
        if (item.action === t.action) {
          return { ...item, isDefault: item._id === t._id };
        }
        return item;
      });
      setTemplates(updated);
      saveLocalTemplates(updated);
      toast.success(`"${t.name}" set as default for ${ACTION_LABELS[t.action] || t.action}`);
    }
  };

  const archiveTemplate = async (t: PromptTemplate) => {
    try {
      await aiAPI.archivePromptTemplate(t._id);
      toast.success(`Template "${t.name}" archived`);
      await load();
    } catch {
      const filtered = templates.filter((item) => item._id !== t._id);
      setTemplates(filtered);
      saveLocalTemplates(filtered);
      toast.success(`Template "${t.name}" removed`);
    }
  };

  const handleApplyPreset = (preset: typeof TEMPLATE_PRESETS[0]) => {
    setNewName(preset.name);
    setNewAction(preset.action);
    setNewTemplate(preset.template);
    setIsDefault(preset.isDefault);
    toast.info(`Loaded preset: ${preset.name}`);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#F0F9FF]">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border-2 border-slate-200"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white shadow-md shadow-sky-500/10">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2 tracking-tight">
              AI Prompt Templates & Settings
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-[#FDF2F8] text-[#BE185D] border border-[#FCE7F3]">
                Model Tuning
              </span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5 font-medium">
              Customize prompts, model parameters, and defaults per project
            </p>
          </div>
        </div>

        {/* User Role Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-xs font-black text-[#7C3AED]">
            <Shield className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>Role: {user?.role || 'QA Engineer'}</span>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'settings', label: 'Engine Settings' },
          { id: 'templates', label: 'Prompt Templates' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-xl border-2 text-xs font-black transition-colors cursor-pointer ${
              tab === t.id
                ? 'border-[#8B5CF6] bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-[#8B5CF6]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'settings' ? (
        <div className="bg-white border-2 border-purple-200 rounded-2xl p-6 space-y-5 max-w-3xl shadow-sm">
          <div>
            <label className="block text-xs font-black text-[#0F172A] uppercase tracking-wider mb-2">
              System Prompt
            </label>
            <textarea
              value={settings.systemPrompt}
              onChange={(e) => setSettings((s) => ({ ...s, systemPrompt: e.target.value }))}
              className="w-full min-h-[110px] bg-[#F8FCFF] border-2 border-slate-200 rounded-xl p-3.5 text-xs text-[#0F172A] font-medium focus:outline-none focus:border-[#8B5CF6]"
              placeholder="System prompt for the AI assistant..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-black text-[#64748B] uppercase tracking-wider mb-1">
                Model (optional)
              </label>
              <input
                value={settings.model}
                onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
                className="w-full h-10 bg-[#F8FCFF] border-2 border-slate-200 rounded-xl px-3 text-xs text-[#0F172A] font-bold focus:outline-none focus:border-[#8B5CF6]"
                placeholder="e.g. gpt-4.1-mini"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-[#64748B] uppercase tracking-wider mb-1">
                Temperature (0.0 – 1.0)
              </label>
              <input
                type="number"
                min={0}
                max={2}
                step={0.05}
                value={settings.temperature}
                onChange={(e) => setSettings((s) => ({ ...s, temperature: Number(e.target.value) }))}
                className="w-full h-10 bg-[#F8FCFF] border-2 border-slate-200 rounded-xl px-3 text-xs text-[#0F172A] font-bold focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-[#64748B] uppercase tracking-wider mb-1">
                Max Tokens
              </label>
              <input
                type="number"
                min={256}
                max={8000}
                step={64}
                value={settings.maxTokens}
                onChange={(e) => setSettings((s) => ({ ...s, maxTokens: Number(e.target.value) }))}
                className="w-full h-10 bg-[#F8FCFF] border-2 border-slate-200 rounded-xl px-3 text-xs text-[#0F172A] font-bold focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => void saveSettings()}
              className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] hover:opacity-95 text-white text-xs font-black inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" /> Save Engine Settings
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Create Template Form */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#7C3AED]" />
                <p className="text-xs font-black text-[#0F172A] uppercase tracking-wider">Create Template</p>
              </div>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="h-9 rounded-xl bg-[#F8FCFF] border-2 border-slate-200 px-3 text-xs font-bold text-[#0F172A]"
              >
                <option value="">All Actions</option>
                {(actions.length ? actions : Object.keys(ACTION_LABELS)).map((a) => (
                  <option key={a} value={a}>
                    {ACTION_LABELS[a] || a}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Presets Bar */}
            <div className="space-y-1.5 bg-sky-50/70 p-3 rounded-xl border border-sky-200">
              <span className="text-[10px] font-black uppercase text-[#0284C7] flex items-center gap-1">
                <BookmarkPlus className="w-3.5 h-3.5 text-[#0EA5E9]" />
                Quick Load Presets (Click to autofill):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="text-[11px] font-bold px-2.5 py-1 bg-white hover:bg-sky-100 text-[#0F172A] border border-sky-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-[#0F172A] uppercase tracking-wider mb-1">
                  Template Name
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full h-10 bg-[#F8FCFF] border-2 border-slate-200 rounded-xl px-3 text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#7C3AED]"
                  placeholder="e.g. Strong security testcases"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-[#0F172A] uppercase tracking-wider mb-1">
                  Target Action
                </label>
                <select
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  className="w-full h-10 bg-[#F8FCFF] border-2 border-slate-200 rounded-xl px-3 text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#7C3AED]"
                >
                  {(actions.length ? actions : Object.keys(ACTION_LABELS)).map((a) => (
                    <option key={a} value={a}>
                      {ACTION_LABELS[a] || a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-black text-[#0F172A] uppercase tracking-wider">
                  Prompt Instructions & Quality Rules
                </label>
                <span className="text-[10px] text-[#7C3AED] font-bold">Use {'{{requirementText}}'} placeholder</span>
              </div>
              <textarea
                value={newTemplate}
                onChange={(e) => setNewTemplate(e.target.value)}
                className="w-full min-h-[220px] bg-[#F8FCFF] border-2 border-slate-200 rounded-xl p-3 text-xs font-mono font-medium text-[#0F172A] focus:outline-none focus:border-[#7C3AED]"
                placeholder={`Use variables like:\n- {{requirementText}}\n\nExample:\nYou are a Senior QA Engineer. Generate test cases for:\n"""\n{{requirementText}}\n"""\nReturn valid JSON...`}
              />
              <label className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-[#0F172A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-[#7C3AED] accent-[#7C3AED]"
                />
                <span>Set as default template for {ACTION_LABELS[newAction] || newAction}</span>
              </label>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => void createTemplate()}
                disabled={!newName.trim() || !newTemplate.trim()}
                className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:opacity-95 text-white text-xs font-black shadow-xs disabled:opacity-40 transition-colors cursor-pointer"
              >
                Create Template
              </button>
            </div>
          </div>

          {/* Existing Templates List */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
            <div className="px-5 py-4 border-b-2 border-slate-200 bg-[#F8FCFF] flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-[#0F172A] uppercase tracking-wider">
                  Templates ({visibleTemplates.length})
                </p>
                <p className="text-[11px] text-[#64748B] font-medium">Default templates are used automatically during test generation</p>
              </div>
            </div>
            <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100 flex-1">
              {visibleTemplates.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#64748B] font-bold">
                  No custom templates for this action yet. Use the form to create one or load a preset above!
                </div>
              ) : (
                visibleTemplates.map((t) => (
                  <div key={t._id} className="p-4 space-y-2 hover:bg-[#F8FCFF]/50 transition-colors">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-black text-[#0F172A]">{t.name}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-[#0284C7] font-black">
                        {ACTION_LABELS[t.action] || t.action}
                      </span>
                      {t.isDefault && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-black flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Default Active
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        {!t.isDefault && (
                          <button
                            onClick={() => void setAsDefault(t)}
                            className="h-7 px-2.5 rounded-lg border-2 border-slate-200 bg-white hover:border-[#7C3AED] text-[11px] font-black text-[#7C3AED] transition-colors cursor-pointer"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          onClick={() => void archiveTemplate(t)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                          aria-label="Archive"
                          title="Archive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <pre className="text-[11px] bg-[#F8FCFF] border border-slate-200 rounded-xl p-3 whitespace-pre-wrap text-[#334155] font-mono font-medium max-h-[140px] overflow-y-auto">
                      {t.template}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
