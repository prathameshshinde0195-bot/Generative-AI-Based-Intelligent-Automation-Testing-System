import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Bot, User, Loader2, Save, Trash2,
  CheckCircle2, AlertCircle, Sparkles, Clock,
  Plus, History, Zap, ArrowDown, Copy, Check, Filter,
  Shield, AlertOctagon, Scale, Code
} from 'lucide-react';
import { aiAPI } from '../lib/api';
import { useAppStore } from '../lib/store';
import { toast } from 'sonner';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
}

interface ChatTestCase {
  scenario: string;
  preconditions: string[];
  steps: string[];
  expectedResults: string;
  priority: 'High' | 'Medium' | 'Low';
  category: string;
}

interface SessionSummary {
  sessionId: string;
  status: string;
  messageCount: number;
  testCaseCount: number;
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'Hello! 👋 I\'m your **AI QA Assistant**. I can help you generate test cases, security tests, boundary analysis, automation scripts, and more.\n\nTry saying something or tap a suggestion below:\n• _"Generate test cases for user login"_\n• _"Add negative test cases"_\n• _"Create security tests for payment API"_',
};

const SUGGESTIONS = [
  { label: 'User Login & Auth', prompt: 'Generate comprehensive test cases for User Login & Authentication', icon: User },
  { label: 'Security & Pen-test', prompt: 'Add security vulnerability and penetration test cases for payment API', icon: Shield },
  { label: 'Negative & Error', prompt: 'Add negative test cases and error handling scenarios', icon: AlertOctagon },
  { label: 'Boundary Analysis', prompt: 'Create boundary value analysis test cases for input fields', icon: Scale },
  { label: 'Automation Scripts', prompt: 'Generate Cypress automation test scripts for critical flows', icon: Code },
];

function renderMessageContent(content: string) {
  const lines = content.split('\n');
  return lines.map((line, lIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g);
    const lineContent = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('_') && part.endsWith('_')) {
        return <em key={i} className="italic opacity-85">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 bg-surface text-pink-400 rounded text-[11px] font-mono border border-border">
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={i}>{part}</span>;
    });

    const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
    return (
      <div key={lIdx} className={isBullet ? 'pl-2 my-0.5 flex items-start gap-1.5' : 'my-0.5'}>
        {lineContent}
      </div>
    );
  });
}

function formatTime(ts?: string) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const priorityColors: Record<string, string> = {
  High: 'bg-danger/15 text-danger border-danger/20',
  Medium: 'bg-warning/15 text-warning border-warning/20',
  Low: 'bg-success/15 text-success border-success/20',
};

const categoryColors: Record<string, string> = {
  functional: 'bg-primary/10 text-primary',
  negative: 'bg-danger/10 text-danger',
  edge: 'bg-accent/10 text-accent',
  security: 'bg-warning/10 text-warning',
  boundary: 'bg-info/10 text-info',
  performance: 'bg-success/10 text-success',
  integration: 'bg-primary/10 text-primary',
};

export default function TestCaseChatbot() {
  const { projectId, user, addTestCases, srsText, extractedRequirements, setSelectedTestCaseForDataGen, setActiveFeature } = useAppStore();

  const chatStorageKey = (pid: string, uid?: string | null) =>
    `chatSessionId_${uid || 'anon'}_${pid || 'default'}`;

  const [sessionId, setSessionId] = useState<string>(() => {
    const uid = useAppStore.getState().user?.id;
    const pid = useAppStore.getState().projectId || 'default';
    const saved = localStorage.getItem(chatStorageKey(pid, uid));
    return saved || `CHAT-${Date.now()}`;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [testCases, setTestCases] = useState<ChatTestCase[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [expandedTC, setExpandedTC] = useState<number | null>(null);
  const [copiedTC, setCopiedTC] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const persistSessionId = useCallback((sid: string) => {
    localStorage.setItem(chatStorageKey(projectId || 'default', user?.id), sid);
  }, [projectId, user?.id]);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  // Track scroll position
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const loadHistory = useCallback(async (id: string) => {
    try {
      const res = await aiAPI.getChatSessionHistory(id, projectId || 'default') as any;
      if (res?.data) {
        const msgs = res.data.messages || [];
        setMessages(msgs.length > 0 ? msgs : [WELCOME_MESSAGE]);
        setTestCases(res.data.generatedTestCases || []);
      }
    } catch {
      setMessages([WELCOME_MESSAGE]);
      setTestCases([]);
    }
  }, [projectId]);

  // Load history on mount, project change, or user change
  useEffect(() => {
    const savedSessionId = localStorage.getItem(chatStorageKey(projectId || 'default', user?.id));
    if (savedSessionId) {
      setSessionId(savedSessionId);
      loadHistory(savedSessionId);
    } else {
      const newId = `CHAT-${Date.now()}`;
      setSessionId(newId);
      persistSessionId(newId);
      setMessages([WELCOME_MESSAGE]);
      setTestCases([]);
    }
  }, [projectId, user?.id, loadHistory, persistSessionId]);

  const loadSessions = async () => {
    try {
      const res = await aiAPI.getChatSessions(projectId || 'default') as any;
      setSessions(res?.data || []);
    } catch {
      setSessions([]);
    }
  };

  const handleSendPrompt = async (msgText: string) => {
    if (!msgText.trim() || loading) return;

    const userMsg = msgText.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    setStreamingText('');

    persistSessionId(sessionId);

    try {
      await aiAPI.chatTestCaseStream(
        {
          sessionId,
          message: userMsg,
          projectId: projectId || 'default',
          srsContext: srsText ? srsText.slice(0, 1500) : undefined,
          reqCount: extractedRequirements.length
        },
        (chunk: string) => {
          setStreamingText(prev => prev + chunk);
        },
        (result: any) => {
          setStreamingText('');
          setMessages(result.messages || []);
          setTestCases(result.generatedTestCases || []);

          if (result.intent === 'CLEAR' && result.sessionId) {
            setSessionId(result.sessionId);
            persistSessionId(result.sessionId);
          }

          if (result.saved) {
            toast.success('Test cases saved to project!');
            addTestCases((result.generatedTestCases || []).map((tc: any, i: number) => ({
              ...tc,
              testCaseId: `TC-CHAT-${Date.now()}-${i}`,
              userId: user?.id,
              projectId: projectId || 'default',
              status: 'Draft',
              riskScore: 50
            })));
          }
          setLoading(false);
        },
        (errorMsg: string) => {
          setStreamingText('');
          toast.error(errorMsg || 'Failed to generate response');
          setLoading(false);
        }
      );
    } catch (err: any) {
      try {
        const res = await aiAPI.chatTestCase({
          sessionId, message: userMsg, projectId: projectId || 'default'
        }) as any;

        if (res?.data) {
          setMessages(res.data.messages || []);
          setTestCases(res.data.generatedTestCases || []);
          if (res.data.intent === 'CLEAR' && res.data.sessionId) {
            setSessionId(res.data.sessionId);
            persistSessionId(res.data.sessionId);
          }
          if (res.data.saved) {
            toast.success('Test cases saved!');
          }
        }
      } catch (fallbackErr: any) {
        toast.error(fallbackErr.message || 'Failed to get response');
      } finally {
        setStreamingText('');
        setLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt(input);
    }
  };

  const handleSave = async () => {
    if (testCases.length === 0) {
      toast.error('No test cases to save');
      return;
    }
    try {
      setSaving(true);
      const res = await aiAPI.saveChatTestCases({
        sessionId, projectId: projectId || 'default'
      }) as any;
      if (res?.success || res?.data) {
        const saved = res.data || [];
        toast.success(`Saved ${saved.length} test cases to project`);
        addTestCases(saved);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const clearConversation = () => {
    const newId = `CHAT-${Date.now()}`;
    setSessionId(newId);
    persistSessionId(newId);
    setMessages([WELCOME_MESSAGE]);
    setTestCases([]);
    setExpandedTC(null);
    toast.info('Conversation cleared');
  };

  const switchSession = async (sid: string) => {
    setSessionId(sid);
    persistSessionId(sid);
    await loadHistory(sid);
    setShowSessions(false);
  };

  const handleCopyTC = (tc: ChatTestCase, idx: number) => {
    const formatted = `SCENARIO: ${tc.scenario}\nCATEGORY: ${tc.category}\nPRIORITY: ${tc.priority}\nPRECONDITIONS:\n${tc.preconditions.map(p => `- ${p}`).join('\n')}\nSTEPS:\n${tc.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\nEXPECTED RESULTS:\n${tc.expectedResults}`;
    navigator.clipboard.writeText(formatted);
    setCopiedTC(idx);
    toast.success('Test case copied to clipboard!');
    setTimeout(() => setCopiedTC(null), 2000);
  };

  const handleDeleteTC = (tc: ChatTestCase) => {
    setTestCases(prev => prev.filter((item) =>
      !(item.scenario === tc.scenario &&
        item.expectedResults === tc.expectedResults &&
        item.category === tc.category)
    ));
    toast.info('Test case removed from preview');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const filteredTestCases = testCases.filter(tc => {
    if (filterCategory === 'all') return true;
    return (tc.category || '').toLowerCase() === filterCategory.toLowerCase();
  });

  return (
    <div className="h-full flex gap-4 p-4 lg:p-6 bg-[#F0F9FF]">
      {/* ─── Chat Area ─── */}
      <div className="flex-1 flex flex-col bg-white border-2 border-purple-200 rounded-2xl overflow-hidden shadow-sm relative">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E0F2FE] bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] flex items-center justify-center shadow-xs">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#16A34A] rounded-full border-2 border-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#0F172A] flex items-center gap-2">
                AI QA Assistant
                <span className="text-[10px] px-2 py-0.5 bg-[#DCFCE7] text-[#16A34A] border border-emerald-200 rounded-full font-black">Online</span>
              </h2>
              <p className="text-xs text-[#64748B] font-semibold">Conversational Test Case Generator • Powered by AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowSessions(!showSessions); if (!showSessions) loadSessions(); }}
              className="px-3 py-1.5 text-slate-700 hover:text-[#0F172A] bg-white border-2 border-slate-200 hover:border-[#8B5CF6] rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Chat History"
            >
              <History className="w-4 h-4 text-[#8B5CF6]" />
              <span className="hidden sm:inline">History</span>
            </button>
            <button
              onClick={clearConversation}
              className="px-3 py-1.5 text-white bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] hover:opacity-95 rounded-xl transition-all flex items-center gap-1.5 text-xs font-black shadow-xs cursor-pointer"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </div>

        {/* Sessions Dropdown */}
        <AnimatePresence>
          {showSessions && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-border bg-surface-alt overflow-hidden"
            >
              <div className="p-3 max-h-48 overflow-y-auto space-y-1.5">
                {sessions.length === 0 ? (
                  <p className="text-xs text-muted text-center py-3">No previous sessions found</p>
                ) : sessions.map(s => (
                  <button
                    key={s.sessionId}
                    onClick={() => switchSession(s.sessionId)}
                    className={`w-full text-left p-2.5 rounded-lg transition-all text-xs ${
                      s.sessionId === sessionId
                        ? 'bg-primary/10 border border-primary/30 text-primary font-medium'
                        : 'hover:bg-surface border border-transparent text-muted hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate flex-1">
                        {s.lastMessage || 'New session'}
                      </span>
                      <span className="text-[10px] shrink-0 opacity-60">
                        {s.messageCount} msgs • {s.testCaseCount} TCs
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-primary to-accent text-white'
                  : 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 text-pink-400 border border-pink-500/10'
              }`}>
                {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-primary to-primary-dim text-white rounded-tr-md shadow-lg shadow-primary/15'
                  : 'bg-surface-alt text-foreground border border-border rounded-tl-md'
              }`}>
                <div className="whitespace-pre-wrap">{renderMessageContent(msg.content)}</div>
                {msg.timestamp && (
                  <div className={`mt-1.5 text-[10px] flex items-center gap-1 ${
                    msg.role === 'user' ? 'text-white/50 justify-end' : 'text-muted'
                  }`}>
                    <Clock className="w-2.5 h-2.5" />
                    {formatTime(msg.timestamp)}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* Streaming indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 text-pink-400 border border-pink-500/10 flex items-center justify-center shrink-0 shadow-md">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="max-w-[80%] bg-surface-alt border border-border rounded-2xl rounded-tl-md px-4 py-3">
                {streamingText ? (
                  <div className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">
                    {renderMessageContent(streamingText)}
                    <span className="inline-block w-1.5 h-4 bg-pink-400 ml-0.5 animate-pulse rounded-sm" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-muted">AI is analyzing and generating response...</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={scrollToBottom}
              className="absolute bottom-28 left-1/2 -translate-x-1/2 w-8 h-8 bg-surface-alt border border-border rounded-full flex items-center justify-center shadow-lg hover:bg-surface transition-all z-10"
            >
              <ArrowDown className="w-4 h-4 text-muted" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Suggestions & Input */}
        <div className="px-4 py-3.5 bg-white border-t-2 border-slate-100 shrink-0 space-y-3">
          {/* Suggestion Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {SUGGESTIONS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendPrompt(item.prompt)}
                  disabled={loading}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FCFF] border-2 border-slate-200 hover:border-[#8B5CF6] text-[#0F172A] font-black text-xs transition-all disabled:opacity-40 cursor-pointer shadow-2xs"
                >
                  <Icon className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="relative flex items-end gap-2 bg-[#F8FCFF] border-2 border-slate-200 rounded-2xl px-3.5 py-2.5 focus-within:border-[#0EA5E9] focus-within:ring-2 focus-within:ring-[#0EA5E9]/20 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to test or ask a QA question..."
              className="flex-1 bg-transparent text-xs font-bold text-[#0F172A] placeholder-[#64748B]/70 focus:outline-none resize-none min-h-[38px] max-h-[120px] py-1 leading-relaxed"
              rows={1}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => handleSendPrompt(input)}
              disabled={loading || !input.trim()}
              className="shrink-0 w-10 h-10 flex items-center justify-center bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] text-white rounded-xl hover:shadow-md hover:shadow-sky-500/25 disabled:opacity-30 disabled:hover:shadow-none transition-all cursor-pointer font-black"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex justify-between items-center px-1">
            <p className="text-[11px] text-[#64748B] font-bold">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-black">Enter</kbd> send
              <span className="mx-1.5">•</span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-black">Shift+Enter</kbd> newline
            </p>
            <div className="flex items-center gap-1 text-[11px] text-[#0284C7] font-black">
              <Zap className="w-3 h-3 text-[#0EA5E9]" />
              Real-time streaming active
            </div>
          </div>
        </div>
      </div>

      {/* ─── Test Cases Preview Panel ─── */}
      <div className="w-[44%] flex flex-col bg-white border-2 border-sky-300 rounded-2xl overflow-hidden shadow-sm">
        {/* Preview Header */}
        <div className="px-5 py-4 border-b-2 border-sky-100 bg-white flex items-center justify-between shrink-0">
          <h2 className="text-sm font-black text-[#0F172A] flex items-center gap-2">
            <CheckCircle2 className="w-4.5 h-4.5 text-[#16A34A]" />
            Generated Test Cases
            {testCases.length > 0 && (
              <span className="ml-1 text-xs px-2.5 py-0.5 bg-sky-100 text-[#0284C7] border border-sky-200 rounded-full font-black">
                {testCases.length}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || testCases.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-[#0EA5E9] to-[#8B5CF6] text-white text-xs font-black rounded-xl hover:opacity-95 shadow-md shadow-sky-500/20 disabled:opacity-30 disabled:hover:shadow-none transition-all cursor-pointer"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save All
          </button>
        </div>

        {/* Filter Bar */}
        {testCases.length > 0 && (
          <div className="px-4 py-2.5 border-b-2 border-slate-100 bg-[#F8FCFF] flex items-center gap-2 overflow-x-auto text-xs shrink-0">
            <Filter className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
            {['all', 'functional', 'security', 'negative', 'boundary'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 rounded-lg capitalize font-black transition-all shrink-0 cursor-pointer ${
                  filterCategory === cat
                    ? 'bg-[#0EA5E9] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-sky-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Test Cases List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredTestCases.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center p-8"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#F0F9FF] border-2 border-sky-200 flex items-center justify-center mb-4">
                  <AlertCircle className="w-7 h-7 text-[#0EA5E9]" />
                </div>
                <p className="text-sm font-black text-[#0F172A]">
                  {testCases.length === 0 ? 'No Test Cases Generated Yet' : 'No matching test cases'}
                </p>
                <p className="text-xs font-bold text-[#64748B] mt-1.5 max-w-[240px] leading-relaxed">
                  {testCases.length === 0
                    ? 'Ask the AI assistant to generate test cases and they will appear here live.'
                    : 'Try changing the category filter to view other test cases.'}
                </p>
              </motion.div>
            ) : (
              filteredTestCases.map((tc, idx) => (
                <motion.div
                  key={idx}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden hover:border-[#8B5CF6] hover:shadow-sm transition-all"
                >
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-[#0F172A] leading-snug">
                        {tc.scenario}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black border ${
                          priorityColors[tc.priority] || 'bg-slate-100 text-[#0F172A]'
                        }`}>
                          {tc.priority}
                        </span>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase ${
                          categoryColors[(tc.category || '').toLowerCase()] || 'bg-slate-100 text-[#0F172A]'
                        }`}>
                          {tc.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const convertedTc = {
                            id: `tc-chat-${Date.now()}-${idx}`,
                            testCaseId: `TC-CHAT-${Date.now().toString().slice(-4)}-${idx + 1}`,
                            title: tc.scenario,
                            scenario: tc.scenario,
                            requirementId: 'REQ-CHAT',
                            requirementDescription: 'Generated via AI Testing Assistant Chatbot',
                            preconditions: tc.preconditions.join('. '),
                            steps: tc.steps,
                            expectedResults: tc.expectedResults,
                            priority: tc.priority,
                            category: tc.category || 'functional',
                            riskScore: 50,
                            tags: ['chatbot', tc.category || 'chat'],
                            createdAt: new Date().toISOString(),
                          };
                          addTestCases([convertedTc]);
                          toast.success(`Saved ${convertedTc.testCaseId} to project test suite!`);
                        }}
                        className="p-1.5 text-[#16A34A] bg-[#DCFCE7] border border-emerald-300 hover:bg-emerald-200 rounded-lg transition-all text-xs flex items-center gap-1 font-black cursor-pointer"
                        title="Save to Project Suite"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Save</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const convertedTc = {
                            id: `tc-chat-${Date.now()}-${idx}`,
                            testCaseId: `TC-CHAT-${Date.now().toString().slice(-4)}-${idx + 1}`,
                            title: tc.scenario,
                            scenario: tc.scenario,
                            requirementId: 'REQ-CHAT',
                            requirementDescription: 'Generated via AI Testing Assistant Chatbot',
                            preconditions: tc.preconditions.join('. '),
                            steps: tc.steps,
                            expectedResults: tc.expectedResults,
                            priority: tc.priority,
                            category: tc.category || 'functional',
                            riskScore: 50,
                            tags: ['chatbot', tc.category || 'chat'],
                            createdAt: new Date().toISOString(),
                          };
                          addTestCases([convertedTc]);
                          setSelectedTestCaseForDataGen(convertedTc);
                          setActiveFeature('test-data');
                          toast.info(`Sent ${convertedTc.testCaseId} to Test Data Generator`);
                        }}
                        className="p-1.5 text-[#0284C7] bg-[#E0F2FE] border border-sky-300 hover:bg-sky-200 rounded-lg transition-all text-xs flex items-center gap-1 font-black cursor-pointer"
                        title="Generate Test Data for this case"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Data Gen</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyTC(tc, idx)}
                        className="p-1.5 text-[#64748B] hover:text-[#7C3AED] hover:bg-purple-50 rounded-lg transition-all cursor-pointer"
                        title="Copy Test Case"
                      >
                        {copiedTC === idx ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTC(tc)}
                        className="p-1.5 text-[#64748B] hover:text-[#BE185D] hover:bg-pink-50 rounded-lg transition-all cursor-pointer"
                        title="Remove Test Case"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedTC(expandedTC === idx ? null : idx)}
                        className="p-1.5 text-[#0F172A] hover:bg-slate-100 rounded-lg transition-all text-xs font-black cursor-pointer"
                      >
                        {expandedTC === idx ? 'Hide' : 'Details'}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedTC === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-3.5 border-t-2 border-slate-100 pt-3.5 bg-[#F8FCFF]">
                          {tc.preconditions?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-black text-[#64748B] uppercase tracking-wider mb-1.5">Preconditions</p>
                              <ul className="space-y-1">
                                {tc.preconditions.map((p, i) => (
                                  <li key={i} className="text-xs text-[#0F172A] font-medium flex items-start gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] mt-1.5 shrink-0" />
                                    {p}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {tc.steps?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-black text-[#64748B] uppercase tracking-wider mb-1.5">Steps</p>
                              <ol className="space-y-1">
                                {tc.steps.map((s, i) => (
                                  <li key={i} className="text-xs text-[#0F172A] font-medium flex items-start gap-2">
                                    <span className="w-4.5 h-4.5 rounded-md bg-[#FAF5FF] border border-purple-200 text-[#7C3AED] text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                      {i + 1}
                                    </span>
                                    {s}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          <div>
                            <p className="text-[10px] font-black text-[#16A34A] uppercase tracking-wider mb-1.5">Expected Result</p>
                            <p className="text-xs text-[#16A34A] font-bold bg-white p-3 rounded-xl border border-emerald-200 leading-relaxed">
                              {tc.expectedResults}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
