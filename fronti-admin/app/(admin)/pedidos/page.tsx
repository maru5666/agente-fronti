'use client';

import {
  Ban,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  Circle,
  ClipboardList,
  CreditCard,
  FileClock,
  RefreshCw,
  Send,
  Truck,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button, EmptyState, ErrorState, LoadingState, Panel, StatusBadge } from '@/components/ui';
import { useCompany } from '@/hooks/use-company';
import { useResource } from '@/hooks/use-resource';
import { ordersApi } from '@/services/api';
import type { Order, OrderStatus } from '@/types';

type StatusFilter = OrderStatus | 'all';

const statusOptions: Array<{
  value: StatusFilter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}> = [
  { value: 'all', label: 'Todos', icon: ClipboardList, tone: 'text-slate-200' },
  { value: 'pendiente_datos', label: 'Pendiente de datos', icon: FileClock, tone: 'text-yellow-300' },
  { value: 'pendiente_confirmacion_cliente', label: 'Por confirmar cliente', icon: Circle, tone: 'text-yellow-300' },
  { value: 'pendiente_confirmacion_operador', label: 'Por confirmar operador', icon: ClipboardList, tone: 'text-orange-300' },
  { value: 'pendiente_pago', label: 'Pendiente de pago', icon: CreditCard, tone: 'text-yellow-300' },
  { value: 'pago_en_revision', label: 'Pago en revisión', icon: CreditCard, tone: 'text-blue-400' },
  { value: 'pago_confirmado', label: 'Pago confirmado', icon: CheckCircle2, tone: 'text-green-400' },
  { value: 'pendiente_delivery', label: 'Pendiente de delivery', icon: Truck, tone: 'text-cyan-300' },
  { value: 'delivery_asignado', label: 'Delivery asignado', icon: Truck, tone: 'text-cyan-300' },
  { value: 'en_preparacion', label: 'En preparación', icon: ChefHat, tone: 'text-orange-300' },
  { value: 'en_camino', label: 'En camino', icon: Truck, tone: 'text-cyan-300' },
  { value: 'entregado', label: 'Entregado', icon: Send, tone: 'text-emerald-400' },
  { value: 'cancelado', label: 'Cancelado', icon: Ban, tone: 'text-red-400' },
  { value: 'pending', label: 'Pendiente', icon: Circle, tone: 'text-yellow-300' },
  { value: 'confirmed', label: 'Confirmado', icon: CheckCircle2, tone: 'text-blue-400' },
  { value: 'paid', label: 'Pagado', icon: CreditCard, tone: 'text-green-400' },
  { value: 'preparing', label: 'En preparación', icon: ChefHat, tone: 'text-orange-300' },
  { value: 'out_for_delivery', label: 'En camino', icon: Truck, tone: 'text-cyan-300' },
  { value: 'delivered', label: 'Entregado', icon: Send, tone: 'text-emerald-400' },
  { value: 'cancelled', label: 'Cancelado', icon: Ban, tone: 'text-red-400' },
];

const statuses = statusOptions
  .map((option) => option.value)
  .filter((status): status is OrderStatus => status !== 'all');

export default function PedidosPage() {
  const { companyId } = useCompany();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const {
    data: allOrders,
    loading,
    error,
    reload,
  } = useResource(
    () => {
      if (!companyId) return Promise.resolve([]);
      return ordersApi.list(companyId);
    },
    [companyId],
  );

  const orders = useMemo(() => allOrders ?? [], [allOrders]);
  const filteredOrders = useMemo(
    () =>
      statusFilter === 'all'
        ? orders
        : orders.filter((order) => order.status === statusFilter),
    [orders, statusFilter],
  );
  const statusCounts = useMemo(() => buildStatusCounts(orders), [orders]);

  async function updateStatus(id: string, status: OrderStatus) {
    await ordersApi.updateStatus(id, status);
    reload();
  }

  return (
    <>
      <PageHeader title="Pedidos" description="Consulta pedidos por estado y avanza su flujo operativo." />
      <Panel
        title="Pedidos por empresa"
        action={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <StatusDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              counts={statusCounts}
            />
            <Button variant="secondary" onClick={reload}>
              <RefreshCw className="h-4 w-4" />
              Actualizar pedidos
            </Button>
          </div>
        }
      >
        {error ? <ErrorState message={error} /> : null}
        {loading ? (
          <LoadingState />
        ) : filteredOrders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr className="border-b border-line">
                  <th className="py-3">Cliente</th>
                  <th>Items</th>
                  <th>Delivery</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Cambiar estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-line last:border-0">
                    <td className="py-3">
                      <p className="font-medium">{order.customerName ?? 'Cliente WhatsApp'}</p>
                      <p className="text-xs text-muted">{order.customerPhone}</p>
                    </td>
                    <td>{order.items.length}</td>
                    <td>
                      <p>{order.deliveryZone?.name ?? 'Sin zona'}</p>
                      <p className="text-xs text-muted">{order.estimatedDeliveryMinutes ?? '-'} min</p>
                    </td>
                    <td>USD {order.totalUsd}</td>
                    <td>
                      <OrderStatusPill status={order.status} />
                    </td>
                    <td>
                      <StatusDropdown
                        value={order.status}
                        onChange={(status) => {
                          if (status !== 'all') {
                            updateStatus(order.id, status);
                          }
                        }}
                        counts={statusCounts}
                        compact
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Sin pedidos" description="Cuando lleguen nuevos pedidos, se listaran aqui." />
        )}
      </Panel>
    </>
  );
}

function StatusDropdown({
  value,
  onChange,
  counts,
  compact = false,
}: {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = getStatusOption(value);
  const SelectedIcon = selected.icon;
  const options = compact ? statusOptions.filter((option) => option.value !== 'all') : statusOptions;

  function choose(nextValue: StatusFilter) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div className="relative min-w-[220px]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.045] px-3 text-sm text-ink shadow-lg shadow-black/10 transition hover:border-white/15 hover:bg-white/[0.075]"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.055] px-2.5 py-1">
          <SelectedIcon className={`h-4 w-4 ${selected.tone}`} />
          <span>{selected.label}</span>
          <span className="text-xs text-muted">({counts[value] ?? 0})</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-40 mt-2 w-full min-w-[260px] rounded-2xl border border-white/[0.08] bg-[#1E1E1E] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
          >
            <div className="grid gap-1">
              {options.map((option) => {
                const Icon = option.icon;
                const active = value === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => choose(option.value)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition duration-150 ${
                      active
                        ? 'bg-[rgba(34,197,94,0.15)] text-[#22C55E]'
                        : 'text-slate-200 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${active ? 'text-[#22C55E]' : option.tone}`} />
                      {option.label}
                    </span>
                    <span className="text-xs text-muted">({counts[option.value] ?? 0})</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function OrderStatusPill({ status }: { status: OrderStatus }) {
  const option = getStatusOption(status);
  const Icon = option.icon;

  return (
    <StatusBadge>
      <span className="inline-flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${option.tone}`} />
        {option.label}
      </span>
    </StatusBadge>
  );
}

function getStatusOption(status: StatusFilter) {
  return statusOptions.find((option) => option.value === status) ?? statusOptions[0];
}

function buildStatusCounts(orders: Order[]) {
  const counts = Object.fromEntries(statusOptions.map((option) => [option.value, 0])) as Record<
    StatusFilter,
    number
  >;

  counts.all = orders.length;
  statuses.forEach((status) => {
    counts[status] = orders.filter((order) => order.status === status).length;
  });

  return counts;
}
