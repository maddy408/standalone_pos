import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-2xl mx-auto my-12 bg-white dark:bg-[#121E2C] rounded-2xl border border-red-200 dark:border-red-900 shadow-xl space-y-4">
          <div className="flex items-center gap-3 text-red-600">
            <span className="text-2xl font-bold">⚠️ Something went wrong in this view</span>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-950/40 rounded-xl text-xs font-mono text-red-800 dark:text-red-300 overflow-x-auto">
            {this.state.error?.toString()}
          </div>
          <details className="text-xs text-[#5A6B82] cursor-pointer">
            <summary className="font-semibold mb-2">View Component Stack</summary>
            <pre className="p-3 bg-gray-100 dark:bg-[#0B131E] rounded-lg overflow-x-auto text-[11px]">
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            className="px-4 py-2 bg-[#0A4174] text-white text-xs font-bold rounded-xl"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

