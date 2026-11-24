import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message;
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed.error) {
        readable = `Database permission or network error (${parsed.operationType ?? 'operation'}): ${parsed.error}`;
      }
    } catch {
      // Keep original message
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F3EA] text-[#0E2742] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-[#E2D9C5] p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3 text-red-700">
              <AlertCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
              <h1 className="font-display font-bold text-xl text-[#0E2742]">
                Something went wrong
              </h1>
            </div>
            <p className="text-sm text-[#44596F] leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] bg-[#0E2742] text-white text-sm font-bold rounded-xl cursor-pointer hover:bg-[#173B63] transition-colors"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
