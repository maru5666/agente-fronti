'use client';

import { MapPinned } from 'lucide-react';
import { Button } from '@/components/ui';

type Props = {
  compact?: boolean;
  onConfigured?: (apiKey: string) => void;
  onUseFallback?: () => void;
};

export function GoogleMapsSetup({ compact = false, onUseFallback }: Props) {
  return (
    <div className={`rounded-[24px] border border-line bg-[#111827] ${compact ? 'p-4' : 'p-6'} shadow-[0_18px_60px_rgba(0,0,0,0.25)]`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#C9A227]/25 bg-[#C9A227]/10 text-[#C9A227]">
            <MapPinned className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-ink">Mapas avanzados no disponibles.</p>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              La conexión de mapas se configura desde el entorno del sistema. Puedes continuar usando referencias locales.
            </p>
          </div>
        </div>

        {onUseFallback ? (
          <Button type="button" variant="secondary" onClick={onUseFallback}>
            Usar mapa básico
          </Button>
        ) : null}
      </div>
    </div>
  );
}
