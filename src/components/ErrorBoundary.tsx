import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[--color-page-bg] flex items-center justify-center p-4">
          <div className="card p-8 w-full max-w-sm text-center">
            <p className="text-2xl mb-3">⚠️</p>
            <h1 className="text-lg font-semibold text-[--color-dp-1400] mb-2">Something went wrong</h1>
            <p className="text-sm text-[--color-dp-700] mb-6">{this.state.error.message}</p>
            <button
              className="btn btn-primary btn-rounded w-full"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
