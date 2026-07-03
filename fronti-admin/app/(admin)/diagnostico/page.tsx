'use client';

import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  MapPinned,
  MessageCircle,
  Package,
  RefreshCw,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button, Panel } from '@/components/ui';
import { healthApi } from '@/services/api';
import type { HealthCheckItem, HealthStatus } from '@/types';

const diagnosticItems: Array<{
  key: keyof HealthStatus['checks'];
  label: string;
  icon: typeof Server;
}> = [
  { key: 'backend', label: 'Operacion', icon: Server },
  { key: 'postgresql', label: 'Datos del negocio', icon: Database },
  { key: 'prisma', label: 'Operaciones automatizadas', icon: ShieldCheck },
  { key: 'bcv', label: 'Tasa BCV', icon: Activity },
  { key: 'maps', label: 'Delivery', icon: MapPinned },
  { key: 'whatsapp', label: 'Atencion al cliente', icon: MessageCircle },
  { key: 'inventario', label: 'Inventario', icon: Package },
];

export default function DiagnosticoPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadHealth() {
    setIsLoading(true);
    try {
      setHealth(await healthApi.check());
    } catch (err) {
      console.error('Estado operativo:', err);
      setHealth(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  const statusLabel = useMemo(() => {
    if (!health) return 'Verificando';
    return health.status === 'ok' ? 'Operacion saludable' : 'Operacion con alertas';
  }, [health]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Estado operativo"
          description="Resumen comercial de las areas clave del negocio."
        />
        <div className="shrink-0">
          <Button type="button" onClick={loadHealth} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar estado
          </Button>
        </div>
      </div>

      <Panel>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted">Estado general</p>
            <h2 className="mt-1 text-3xl font-semibold text-ink">{statusLabel}</h2>
          </div>
          <p className="text-sm text-muted">
            Revisado:{' '}
            {health?.timestamp ? new Date(health.timestamp).toLocaleString('es-VE') : 'Pendiente'}
          </p>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {diagnosticItems.map((item, index) => {
          const check = health?.checks[item.key];
          const Icon = item.icon;

          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <DiagnosticCard
                label={item.label}
                icon={<Icon className="h-5 w-5" />}
                check={check}
                loading={isLoading}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function DiagnosticCard({
  label,
  icon,
  check,
  loading,
}: {
  label: string;
  icon: ReactNode;
  check?: HealthCheckItem;
  loading: boolean;
}) {
  const status = check?.status ?? 'not_configured';
  const ok = status === 'connected';
  const warning = status === 'not_configured';

  return (
    <div className="min-h-44 rounded-[24px] border border-line bg-surface/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-white/[0.04] text-ink">
          {icon}
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
            ok
              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
              : warning
                ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                : 'border-red-400/20 bg-red-400/10 text-red-300'
          }`}
        >
          {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {ok ? 'Conectado' : warning ? 'No configurado' : 'Error'}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-ink">{label}</h3>
      {loading ? (
        <div className="mt-4 grid gap-2">
          <div className="h-3 w-3/4 animate-pulse rounded-full bg-white/[0.08]" />
          <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/[0.08]" />
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-muted">
            {ok
              ? 'Disponible para operar.'
              : warning
                ? 'Pendiente por completar.'
                : 'Requiere atencion.'}
          </p>
        </>
      )}
    </div>
  );
}
