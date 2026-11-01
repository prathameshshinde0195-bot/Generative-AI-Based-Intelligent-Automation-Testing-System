import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] h-full p-8 bg-[#F0F9FF] text-center">
          <div className="max-w-md w-full bg-white border border-[#E0F2FE] rounded-3xl p-8 shadow-xl shadow-sky-500/5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#EC4899] to-[#8B5CF6] text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/20">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-[#0F172A] mb-2">
              {this.props.fallbackTitle || 'Feature Recovery Notice'}
            </h3>
            
            <p className="text-xs text-[#64748B] mb-6 leading-relaxed">
              An unexpected display issue occurred in this section. Don't worry — your data is safe. You can reload this module or return to the dashboard.
            </p>

            {this.state.error && (
              <div className="p-3 bg-[#FDF2F8] border border-[#FCE7F3] rounded-xl text-left mb-6 overflow-x-auto max-h-24 text-[11px] font-mono text-[#BE185D]">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-500/20 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Feature</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.hash = '';
                  window.dispatchEvent(new CustomEvent('app:navigate-dashboard'));
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#FAF5FF] hover:bg-purple-100/70 border border-[#EDE9FE] text-[#8B5CF6] font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
