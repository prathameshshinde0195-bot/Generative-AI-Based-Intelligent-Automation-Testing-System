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
      className={`relative flex flex-col h-screen bg-white border-r border-[#E2E8F0] shadow-sm transition-all duration-300 z-20 ${
        collapsed ? 'w-[70px]' : 'w-[264px]'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[#E2E8F0] shrink-0 bg-white">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] flex items-center justify-center shrink-0 shadow-md shadow-sky-500/15">
          <Beaker className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
            <h1 className="text-sm font-extrabold text-[#0F172A] tracking-tight leading-tight flex items-center gap-1.5">
              <span>Gen AI</span>
              <span className="text-[#0EA5E9]">Testing</span>
            </h1>
            <p className="text-[10px] text-[#64748B] font-semibold">Autonomous QA Suite</p>
          </motion.div>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-[#CBD5E1] text-[#64748B] hover:text-[#0EA5E9] flex items-center justify-center shadow-sm hover:border-[#0EA5E9] transition-all z-30 cursor-pointer"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1">
        {menuItems.map((item) => {
          const isActive = activeFeature === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveFeature(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-[#F0F9FF] to-[#FAF5FF] text-[#0284C7] border border-sky-200 font-bold shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] border border-transparent font-medium'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive
                    ? 'text-[#0EA5E9]'
                    : 'text-[#64748B] group-hover:text-[#8B5CF6]'
                }`}
              />
              {!collapsed && (
                <span className="text-xs truncate">{item.label}</span>
              )}
              {isActive && !collapsed && (
                <motion.div
                  layoutId="activeIndicator"
                  className="ml-auto w-1.5 h-3.5 rounded-full bg-gradient-to-b from-[#0EA5E9] to-[#EC4899]"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer & User Card */}
      <div className="p-3 border-t border-[#E2E8F0] shrink-0 space-y-2.5 bg-white">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#FAF5FF] border border-[#EDE9FE] rounded-xl">
            <Zap className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span className="text-[11px] text-[#7C3AED] font-bold">GenAI Engine Active</span>
            <span className="ml-auto flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#16A34A]"></span>
            </span>
          </div>
        )}

        <div className={`p-2 rounded-xl transition-all ${collapsed ? 'bg-transparent' : 'bg-[#F8FAFC] border border-[#E2E8F0]'}`}>
          <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : 'px-1'}`}>
            {user?.profilePicture ? (
              <img
                src={user.profilePicture}
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover border border-[#0EA5E9]/30 shrink-0 shadow-xs"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                <User className="w-4 h-4" />
              </div>
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#0F172A] truncate">{user?.name || 'QA Specialist'}</p>
                <p className="text-[10px] text-[#64748B] truncate font-medium">{user?.email || 'Active Session'}</p>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
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
                className="p-1.5 hover:bg-[#FDF2F8] hover:text-[#BE185D] rounded-lg transition-colors text-slate-400 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              type="button"
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
              className="mt-2 w-8 h-8 mx-auto flex items-center justify-center hover:bg-[#FDF2F8] hover:text-[#BE185D] text-slate-400 rounded-lg transition-colors cursor-pointer"
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
