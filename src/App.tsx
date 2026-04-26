import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SRSInput from './components/SRSInput';
import AmbiguityDetection from './components/AmbiguityDetection';
import TestPrioritization from './components/TestPrioritization';
import AutomationScriptGen from './components/AutomationScriptGen';
import TraceabilityMatrix from './components/TraceabilityMatrix';
import DuplicateDetection from './components/DuplicateDetection';
import NegativeEdgeCases from './components/NegativeEdgeCases';
import CoverageAnalyzer from './components/CoverageAnalyzer';
import CICDApi from './components/CICDApi';
import RiskAssessment from './components/RiskAssessment';
import RecentHistory from './components/RecentHistory';
import LoginPage from './components/LoginPage';
import ProjectSwitcher from './components/ProjectSwitcher';
import { useAppStore } from './lib/store';
import { Toaster } from 'sonner';
import AITemplates from './components/AITemplates';
import TestRuns from './components/TestRuns';

const featureComponents: Record<string, React.ComponentType> = {
  'dashboard': Dashboard,
  'srs-input': SRSInput,
  'ambiguity': AmbiguityDetection,
  'prioritization': TestPrioritization,
  'automation': AutomationScriptGen,
  'traceability': TraceabilityMatrix,
  'duplicates': DuplicateDetection,
  'negative': NegativeEdgeCases,
  'coverage': CoverageAnalyzer,
  'api': CICDApi,
  'risk': RiskAssessment,
  'ai-templates': AITemplates,
  'test-runs': TestRuns,
  'history': RecentHistory,
};

export default function App() {
  const { activeFeature, theme, setTheme, isAuthenticated, setIsAuthenticated, setUser, setToken } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Fallback check in case zustand rehydration needs help (though persist usually handles it)
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser && !isAuthenticated) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(token);
        setIsAuthenticated(true);
      } catch (e) {
        console.error('Failed to parse stored user:', e);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, [isAuthenticated, setIsAuthenticated, setUser, setToken]);

  useEffect(() => {
    // Apply theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  if (!mounted) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <>
        <Toaster richColors position="top-right" />
        <LoginPage />
      </>
    );
  }

  const ActiveComponent = featureComponents[activeFeature] || Dashboard;

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      <Toaster richColors position="top-right" />
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Header with theme toggle */}
        <div className="relative flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {Object.entries(featureComponents).find(([key]) => key === activeFeature)?.[0] || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <ProjectSwitcher />
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-yellow-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600" />
              )}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
}
