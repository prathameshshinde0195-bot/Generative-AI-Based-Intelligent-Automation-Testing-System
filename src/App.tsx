import { useEffect, useState } from 'react';
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
import RequirementChangeImpact from './components/RequirementChangeImpact';
import TestDataGenerator from './components/TestDataGenerator';
import TestCaseChatbot from './components/TestCaseChatbot';

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
  'change-impact': RequirementChangeImpact,
  'test-data': TestDataGenerator,
  'history': RecentHistory,
  'chat-chatbot': TestCaseChatbot,
};

const featureTitles: Record<string, string> = {
  'dashboard': 'Testing Intelligence Dashboard',
  'srs-input': 'SRS Input & Test Case Generator',
  'ambiguity': 'Ambiguity Detection',
  'prioritization': 'Test Prioritization',
  'automation': 'Automation Script Generator',
  'traceability': 'Requirement Traceability Matrix',
  'duplicates': 'Duplicate Test Case Detection',
  'negative': 'Negative & Edge Cases',
  'coverage': 'Test Coverage Analyzer',
  'api': 'CI/CD API Integration',
  'risk': 'AI Risk Assessment',
  'ai-templates': 'AI Prompt Templates & Settings',
  'test-runs': 'Live Test Execution & Online IDE Runner',
  'change-impact': 'Requirement Change Impact Predictor',
  'test-data': 'AI Test Data Generator',
  'history': 'Execution & Audit History',
  'chat-chatbot': 'Conversational Test Case Chatbot',
};

import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const { activeFeature, setActiveFeature, isAuthenticated, setIsAuthenticated, setUser, setToken } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Ensure document never has pitch-black dark mode class
    document.documentElement.classList.remove('dark');

    const handleNavigateDashboard = () => {
      setActiveFeature('dashboard');
    };
    window.addEventListener('app:navigate-dashboard', handleNavigateDashboard);
    return () => window.removeEventListener('app:navigate-dashboard', handleNavigateDashboard);
  }, [setActiveFeature]);

  useEffect(() => {
    // Fallback check in case zustand rehydration needs help
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

  if (!mounted) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <ErrorBoundary fallbackTitle="Authentication Screen">
        <Toaster richColors position="top-right" />
        <LoginPage />
      </ErrorBoundary>
    );
  }

  const ActiveComponent = featureComponents[activeFeature] || Dashboard;

  return (
    <div className="flex h-screen bg-white transition-colors overflow-hidden">
      <Toaster richColors position="top-right" />
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col bg-[#F0F9FF]">
        {/* Header with White, Sky Blue, Purple, and Light Pink accents */}
        <div className="relative flex items-center justify-between px-6 py-4 bg-white border-b-2 border-sky-100 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#0EA5E9] via-[#8B5CF6] to-[#EC4899] animate-pulse shadow-sm" />
            <h2 className="text-lg font-black text-[#0F172A] tracking-tight">
              {featureTitles[activeFeature] || 'Testing Intelligence Dashboard'}
            </h2>
            <span className="hidden sm:inline-flex text-[11px] font-black px-3 py-1 rounded-full bg-[#FDF2F8] text-[#BE185D] border-2 border-pink-200 shadow-2xs">
              Gen AI Engine v2.4
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF5FF] border-2 border-purple-200 text-xs text-[#7C3AED] font-black shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
              Enterprise Testing Active
            </div>
            <ProjectSwitcher />
          </div>
        </div>

        {/* Feature Component Rendered with ErrorBoundary */}
        <div className="flex-1 overflow-auto bg-[#F0F9FF]">
          <ErrorBoundary
            fallbackTitle={`${featureTitles[activeFeature] || 'Feature'} View`}
            onReset={() => setActiveFeature('dashboard')}
          >
            <ActiveComponent />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
