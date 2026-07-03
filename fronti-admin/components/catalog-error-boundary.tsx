'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
};

type State = {
  hasError: boolean;
};

export class CatalogErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error renderizando tarjeta de catálogo:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[460px] flex-col justify-between rounded-[24px] border border-red-400/20 bg-red-500/10 p-4 text-left">
          <div className="grid h-48 place-items-center rounded-2xl bg-black/20">
            <AlertCircle className="h-8 w-8 text-red-200" />
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-red-100">
              {this.props.fallbackTitle ?? 'No pudimos mostrar este producto'}
            </p>
            <p className="mt-2 text-xs leading-5 text-red-100/75">
              El resto del catálogo sigue disponible mientras revisamos esta tarjeta.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
