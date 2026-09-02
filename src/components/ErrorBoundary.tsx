import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleClearStorageAndReset = () => {
    try {
      localStorage.removeItem('paikarix_current_admin');
      localStorage.removeItem('paikarix_website_settings_cache');
    } catch (e) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#0F1729] text-white flex flex-col items-center justify-center p-6 text-center z-[99999] relative">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6 text-red-400">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold mb-2">
            {this.props.fallbackTitle || 'Something went wrong'}
          </h2>
          <p className="text-gray-400 text-sm max-w-md mb-6">
            An unexpected error occurred while loading this view. Click below to refresh or restore standard settings.
          </p>
          {this.state.error && (
            <div className="bg-black/40 border border-white/10 rounded-xl p-3 max-w-lg w-full mb-6 text-left text-xs font-mono text-red-300 overflow-auto max-h-32">
              {this.state.error.toString()}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#0F1729] font-bold text-sm hover:bg-gray-100 transition-colors shadow-lg"
            >
              <RefreshCw size={16} />
              Reload Page
            </button>
            <button
              onClick={this.handleClearStorageAndReset}
              className="px-4 py-2.5 rounded-full bg-white/10 border border-white/20 text-gray-300 font-medium text-sm hover:bg-white/20 transition-colors"
            >
              Clear Cache & Reset
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
