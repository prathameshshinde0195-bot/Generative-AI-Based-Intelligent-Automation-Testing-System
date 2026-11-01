import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Sparkles, Trash2 } from 'lucide-react';
import { aiAPI } from '../lib/api';
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
};

export default function AITemplates() {
  const [tab, setTab] = useState<'settings' | 'templates'>('settings');
  const [actions, setActions] = useState<string[]>([]);
  const [settings, setSettings] = useState<AISettings>({
    systemPrompt: 'You are an expert software testing specialist and QA automation engineer.',
    model: '',
    temperature: 0.2,
    maxTokens: 2000,
  });

  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [filterAction, setFilterAction] = useState<string>('');

  const [newName, setNewName] = useState('');
  const [newAction, setNewAction] = useState<string>('generate_test_cases');
  const [newTemplate, setNewTemplate] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const visibleTemplates = useMemo(() => {
    if (!filterAction) return templates;
    return templates.filter((t) => t.action === filterAction);
  }, [templates, filterAction]);

  const load = async () => {
    try {
      const [actRes, settingsRes, tmplRes] = await Promise.all([
        aiAPI.getSupportedActions(),
        aiAPI.getAISettings(),
        aiAPI.listPromptTemplates(filterAction ? { action: filterAction } : undefined),
      ]);
      setActions((actRes?.data || []) as string[]);
      if (settingsRes?.data) {
        setSettings({
          systemPrompt: settingsRes.data.systemPrompt || settings.systemPrompt,
          model: settingsRes.data.model || '',
          temperature: typeof settingsRes.data.temperature === 'number' ? settingsRes.data.temperature : 0.2,
          maxTokens: typeof settingsRes.data.maxTokens === 'number' ? settingsRes.data.maxTokens : 2000,
        });
      }
      setTemplates((tmplRes?.data || []) as PromptTemplate[]);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load AI settings/templates');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAction]);

  const saveSettings = async () => {
    try {
      await aiAPI.updateAISettings(settings);
      toast.success('AI settings saved');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save AI settings');
    }
  };

  const createTemplate = async () => {
    if (!newName.trim() || !newTemplate.trim()) return;
    try {
      await aiAPI.createPromptTemplate({
        name: newName.trim(),
        action: newAction,
        template: newTemplate,
        isDefault,
      });
      toast.success('Template created');
      setNewName('');
      setNewTemplate('');
      setIsDefault(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create template');
    }
  };

  const setAsDefault = async (t: PromptTemplate) => {
    try {
      await aiAPI.updatePromptTemplate(t._id, { isDefault: true });
      toast.success('Default set');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to set default');
    }
  };

  const archiveTemplate = async (t: PromptTemplate) => {
    try {
      await aiAPI.archivePromptTemplate(t._id);
      toast.success('Template archived');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to archive template');
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-[#F0F9FF]">
      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-[#E0F2FE]">
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
            <p className="text-xs text-[#64748B] mt-0.5 font-medium">Customize prompts, model parameters, and defaults per project</p>
          </div>
        </div>
      </motion.div>

      <div className="flex gap-2">
        {[
          { id: 'settings', label: 'Engine Settings' },
          { id: 'templates', label: 'Prompt Templates' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-xl border-2 text-xs font-black transition-colors cursor-pointer ${
              tab === t.id ? 'border-[#8B5CF6] bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-[#8B5CF6]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'settings' ? (
        <div className="bg-white border-2 border-purple-200 rounded-2xl p-6 space-y-5 max-w-3xl shadow-sm">
          <div>
            <label className="block text-xs font-black text-[#0F172A] uppercase tracking-wider mb-2">System prompt</label>
            <textarea
              value={settings.systemPrompt}
              onChange={(e) => setSettings((s) => ({ ...s, systemPrompt: e.target.value }))}
              className="w-full min-h-[110px] bg-[#F8FCFF] border-2 border-slate-200 rounded-xl p-3.5 text-xs text-[#0F172A] font-medium focus:outline-none focus:border-[#8B5CF6]"
              placeholder="System prompt for the AI assistant..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Model (optional)</label>
              <input
                value={settings.model}
                onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
                className="w-full h-10 bg-surface border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:border-primary/50"
                placeholder="e.g. gpt-4.1-mini"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Temperature</label>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={settings.temperature}
                onChange={(e) => setSettings((s) => ({ ...s, temperature: Number(e.target.value) }))}
                className="w-full h-10 bg-surface border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Max tokens</label>
              <input
                type="number"
                min={256}
                max={8000}
                step={64}
                value={settings.maxTokens}
                onChange={(e) => setSettings((s) => ({ ...s, maxTokens: Number(e.target.value) }))}
                className="w-full h-10 bg-surface border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => void saveSettings()}
              className="h-10 px-4 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-semibold inline-flex items-center gap-2 shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" /> Save settings
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Create template</p>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="h-9 rounded-lg bg-surface border border-border px-3 text-sm text-foreground"
              >
                <option value="">All actions</option>
                {(actions.length ? actions : Object.keys(ACTION_LABELS)).map((a) => (
                  <option key={a} value={a}>
                    {ACTION_LABELS[a] || a}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full h-10 bg-surface border border-border rounded-lg px-3 text-sm text-foreground"
                  placeholder="e.g. Strong security testcases"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Action</label>
                <select
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  className="w-full h-10 bg-surface border border-border rounded-lg px-3 text-sm text-foreground"
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
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Template</label>
              <textarea
                value={newTemplate}
                onChange={(e) => setNewTemplate(e.target.value)}
                className="w-full min-h-[220px] bg-surface border border-border rounded-lg p-3 text-xs font-mono text-foreground"
                placeholder={`Use variables like:\n- {{requirementText}}\n- {{testCasesJson}}\n\nExample:\nGenerate test cases for: "{{requirementText}}" and return JSON...`}
              />
              <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="accent-primary"
                />
                Set as default for this action
              </label>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => void createTemplate()}
                disabled={!newName.trim() || !newTemplate.trim()}
                className="h-10 px-4 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-semibold shadow-xs disabled:opacity-40 transition-colors"
              >
                Create template
              </button>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-surface-alt flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Templates ({visibleTemplates.length})</p>
              <p className="text-xs text-muted">Default templates are used automatically</p>
            </div>
            <div className="max-h-[560px] overflow-y-auto divide-y divide-border/60">
              {visibleTemplates.length === 0 ? (
                <div className="p-6 text-sm text-muted">No templates yet for this project.</div>
              ) : (
                visibleTemplates.map((t) => (
                  <div key={t._id} className="p-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted">
                        {ACTION_LABELS[t.action] || t.action}
                      </span>
                      {t.isDefault && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          Default
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        {!t.isDefault && (
                          <button
                            onClick={() => void setAsDefault(t)}
                            className="h-8 px-3 rounded-lg border border-border bg-surface hover:bg-surface-alt text-xs text-foreground"
                          >
                            Set default
                          </button>
                        )}
                        <button
                          onClick={() => void archiveTemplate(t)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-surface hover:bg-surface-alt"
                          aria-label="Archive"
                          title="Archive"
                        >
                          <Trash2 className="w-4 h-4 text-muted" />
                        </button>
                      </div>
                    </div>

                    <pre className="text-[11px] bg-surface-alt border border-border rounded-lg p-3 whitespace-pre-wrap text-foreground/80 font-mono max-h-[170px] overflow-y-auto">
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

