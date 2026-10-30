import { motion } from 'framer-motion';
import {
  LayoutDashboard, FileText, AlertTriangle, ArrowUpDown,
  Code2, Grid3X3, Copy, ShieldAlert, BarChart3, Webhook,
  Shield, Zap, ChevronLeft, ChevronRight, Beaker, History, SlidersHorizontal, PlayCircle, LogOut, User,
  GitCompare, FlaskConical, MessageSquare
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { authAPI } from '../lib/api';
import { useState } from 'react';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'srs-input', label: 'SRS Input & Generator', icon: FileText },
  { id: 'ambiguity', label: 'Ambiguity Detection', icon: AlertTriangle },
  { id: 'prioritization', label: 'Test Prioritization', icon: ArrowUpDown },
  { id: 'automation', label: 'Script Generator', icon: Code2 },
  { id: 'traceability', label: 'Traceability Matrix', icon: Grid3X3 },
  { id: 'duplicates', label: 'Duplicate Detection', icon: Copy },
  { id: 'negative', label: 'Negative & Edge Cases', icon: ShieldAlert },
  { id: 'coverage', label: 'Coverage Analyzer', icon: BarChart3 },
  { id: 'api', label: 'CI/CD API', icon: Webhook },
  { id: 'risk', label: 'Risk Assessment', icon: Shield },
  { id: 'ai-templates', label: 'AI Templates & Settings', icon: SlidersHorizontal },
  { id: 'test-runs', label: 'Test Runs', icon: PlayCircle },
  { id: 'change-impact', label: 'Impact Predictor', icon: GitCompare },
  { id: 'test-data', label: 'Test Data Generator', icon: FlaskConical },
  { id: 'chat-chatbot', label: 'Test Case Chatbot', icon: MessageSquare },
  { id: 'history', label: 'Recent History', icon: History },
];

export default function Sidebar() {
  const { activeFeature, setActiveFeature, user } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`relative flex flex-col h-screen bg-white dark:bg-slate-900 border-r border-[#e2e8f0] dark:border-slate-800 transition-all duration-300 ${
        collapsed ? 'w-[68px]' : 'w-[260px]'
      }`}
    >
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-[#e2e8f0] dark:border-slate-800 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0ea5e9] to-[#0284c7] flex items-center justify-center shrink-0 shadow-sm">
          <Beaker className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
            <h1 className="text-sm font-bold text-[#0f172a] dark:text-white tracking-tight leading-tight flex items-center gap-1">
              <span>Gen AI</span>
              <span className="text-[#0ea5e9] dark:text-sky-400">Testing</span>
            </h1>
            <p className="text-[10px] text-[#64748b] font-medium">Intelligent Automation System</p>
          </motion.div>
        )}
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-[#e2e8f0] dark:border-slate-700 flex items-center justify-center hover:border-[#0ea5e9] shadow-xs transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3 text-[#64748b]" /> : <ChevronLeft className="w-3 h-3 text-[#64748b]" />}
      </button>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {menuItems.map((item) => {
          const isActive = activeFeature === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveFeature(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-200 group ${
                isActive
                  ? 'bg-[#f0f9ff] dark:bg-sky-950/40 text-[#0284c7] dark:text-sky-300 border border-sky-200 dark:border-sky-800/50 font-semibold shadow-xs'
                  : 'text-[#64748b] hover:text-[#0f172a] dark:hover:text-white hover:bg-[#f8fcff] dark:hover:bg-slate-800 border border-transparent'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#0ea5e9] dark:text-sky-400' : 'text-[#64748b] group-hover:text-[#0f172a] dark:group-hover:text-white'}`} />
              {!collapsed && (
                <span className="text-[13px] font-medium truncate">{item.label}</span>
              )}
              {isActive && !collapsed && (
                <motion.div
                  layoutId="activeIndicator"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-[#0ea5e9]"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#e2e8f0] dark:border-slate-800 shrink-0 space-y-3">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2">
            <Zap className="w-3.5 h-3.5 text-warning" />
            <span className="text-[11px] text-[#64748b] font-medium">AI Engine Active</span>
            <div className="ml-auto w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
          </div>
        )}

        <div className={`p-2 rounded-xl transition-all duration-200 ${collapsed ? 'bg-transparent' : 'bg-[#f8fcff] dark:bg-slate-800/60 border border-[#e2e8f0] dark:border-slate-700/60'}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'px-1'}`}>
            {user?.profilePicture ? (
              <img
                src={user.profilePicture}
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover border border-cyan-500/30 shrink-0 shadow-xs"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 flex items-center justify-center border border-cyan-500/10 shrink-0">
                <User className="w-4 h-4 text-cyan-600" />
              </div>
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-foreground truncate">{user?.name || 'User'}</p>
                <p className="text-[10px] text-muted truncate capitalize">{user?.role || 'QA Analyst'}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={() => {
                  try { authAPI.logout().catch(() => {}); } catch {}
                  const store = useAppStore.getState();
                  store.clearUserScopedData();
                  store.setIsAuthenticated(false);
                  store.setUser(null);
                  store.setToken(null);
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  Object.keys(localStorage)
                    .filter((k) => k.startsWith('chatSessionId_'))
                    .forEach((k) => localStorage.removeItem(k));
                }}
                className="p-1.5 hover:bg-danger/10 hover:text-danger rounded-lg transition-colors group cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              onClick={() => {
                try { authAPI.logout().catch(() => {}); } catch {}
                const store = useAppStore.getState();
                store.clearUserScopedData();
                store.setIsAuthenticated(false);
                store.setUser(null);
                store.setToken(null);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                Object.keys(localStorage)
                  .filter((k) => k.startsWith('chatSessionId_'))
                  .forEach((k) => localStorage.removeItem(k));
              }}
              className="mt-2 w-8 h-8 mx-auto flex items-center justify-center hover:bg-danger/10 hover:text-danger rounded-lg transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
