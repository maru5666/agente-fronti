'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class DeliveryErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error renderizando módulo Delivery:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="rounded-[28px] border border-amber-400/20 bg-amber-400/10 p-6 text-amber-50">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-400/15">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">No pudimos mostrar el módulo Delivery.</h2>
              <p className="mt-2 text-sm leading-6 text-amber-50/80">
                La configuración sigue protegida. Intenta recargar la pantalla y revisaremos el detalle en los registros técnicos.
              </p>
            </div>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
