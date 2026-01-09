import type { ReactNode } from 'react';
import { Component } from 'react';
import { Card } from './Card';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[LumaLite] UI error', error);
  }

  render() {
    if (this.state.error) {
      return (
        <Card className="mt-6 border border-amberlite-500/30">
          <p className="text-sm text-amberlite-500">Something went wrong in the UI.</p>
          <p className="mt-2 text-xs text-mist-500">{this.state.error.message}</p>
        </Card>
      );
    }

    return this.props.children;
  }
}
