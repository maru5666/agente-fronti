'use client';

import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Gift,
  Headphones,
  MapPinned,
  PackageX,
  RefreshCcw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Button, EmptyState, ErrorState, LoadingState, Panel, StatusBadge } from '@/components/ui';
import { useCompany } from '@/hooks/use-company';
import { useResource } from '@/hooks/use-resource';
import { bcvApi, internalNotificationsApi, ordersApi, productsApi, promotionsApi } from '@/services/api';
import type { InternalNotification, Order, Product, Promotion } from '@/types';

export default function DashboardPage() {
  const { company, companyCode, companyId } = useCompany();
  const [bcvSyncing, setBcvSyncing] = useState(false);
  const { data, loading, error, reload } = useResource(
    async () => {
      if (!companyId) {
        return {
          productMetrics: null,
          lowStock: [],
          orders: [],
          orderSummary: null,
          promotions: [],
          notifications: [],
          bcv: null,
        };
      }

      const [productMetrics, lowStock, orderSummary, promotions, notifications, bcv] = await Promise.all([
        productsApi.metrics(companyId),
        productsApi.lowStock(companyId, { limit: 6 }),
        ordersApi.summary(companyId),
        promotionsApi.active(companyId, { limit: 4 }),
        internalNotificationsApi.list(companyId, 'pendiente_operador').catch(() => []),
        bcvApi.latest().catch(() => null),
      ]);

      return {
        productMetrics,
        lowStock,
        orders: orderSummary.recentOrders,
        orderSummary,
        promotions,
        notifications,
        bcv,
      };
    },
    [companyId],
  );

  const productMetrics = data?.productMetrics ?? null;
  const lowStock = data?.lowStock ?? [];
  const orders = data?.orders ?? [];
  const promotions = data?.promotions ?? [];
  const notifications = data?.notifications ?? [];
  const bcv = data?.bcv ?? null;
  const pendingOrders = data?.orderSummary?.pendingOrders ?? 0;
  const todayRevenue = Number(data?.orderSummary?.todayRevenueUsd ?? 0);
  const estimatedProfit = todayRevenue * 0.28;

  async function syncBcvRate() {
    setBcvSyncing(true);
    try {
      console.log('Actualizando tasa BCV...');
      await bcvApi.sync();
      await bcvApi.latest();
      await reload();
    } catch (err) {
      console.error('Error BCV:', err);
    } finally {
      setBcvSyncing(false);
    }
  }

  const metrics = [
    {
      label: 'Ventas hoy',
      value: `$${todayRevenue.toFixed(2)}`,
      delta: '+12.4%',
      icon: BadgeDollarSign,
      tone: 'violet',
      data: [22, 38, 31, 46, 42, 58, 64],
    },
    {
      label: 'Ganancia estimada',
      value: `$${estimatedProfit.toFixed(2)}`,
      delta: '+8.1%',
      icon: Wallet,
      tone: 'cyan',
      data: [16, 24, 29, 35, 32, 40, 47],
    },
    {
      label: 'Pedidos pendientes',
      value: pendingOrders,
      delta: '-3.2%',
      icon: ShoppingBag,
      tone: 'green',
      data: [48, 42, 39, 34, 28, 24, 19],
    },
    {
      label: 'Stock bajo',
      value: productMetrics?.lowStock ?? lowStock.length,
      delta: '+2 alertas',
      icon: PackageX,
      tone: 'red',
      data: [8, 12, 10, 16, 14, 18, 21],
    },
    {
      label: 'Promociones',
      value: promotions.length,
      delta: '+1 nueva',
      icon: Gift,
      tone: 'violet',
      data: [2, 2, 3, 3, 4, 4, 5],
    },
    {
      label: 'Tasa BCV',
      value: bcv ? `Bs ${bcv.formattedRate}` : 'No disponible',
      delta: 'Valor USD',
      icon: TrendingUp,
      tone: 'cyan',
      data: [34, 34.6, 35.1, 35.4, 36, 36.2, 36.5],
    },
  ] as const;

  return (
    <div className="grid gap-7">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="overflow-hidden rounded-[28px] border border-line bg-[linear-gradient(135deg,rgba(255,255,255,0.09),rgba(255,255,255,0.035))] p-6 shadow-panel"
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.045] px-3 py-1 text-xs font-medium text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-blue" />
              Panel empresarial
            </div>
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
              Operacion inteligente para {company?.name ?? 'tu empresa'}.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base">
              Ventas, pedidos, inventario y decisiones comerciales en una sola vista ejecutiva.
            </p>
          </div>

          <div className="rounded-[24px] border border-line bg-canvas/55 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Operacion</p>
            <div className="mt-4 grid gap-3">
              <SystemLine label="Pedidos" value="Activos" />
              <SystemLine label="Inventario" value="Actualizado" />
              <SystemLine label="BCV" value="Disponible" />
            </div>
          </div>
        </div>
      </motion.section>

      {error ? <ErrorState message={error} /> : null}

      {loading ? (
        <LoadingState label="Sincronizando datos del negocio" />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="glass-panel rounded-[24px] p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-brand/25 bg-brand/15 text-brand">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted">Empresa registrada</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                    {company?.name ?? 'Empresa sin nombre'}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm text-muted">
                    Esta es la información pública que verá el equipo administrativo dentro de Fronti.
                  </p>
                </div>
                <div className="rounded-[22px] border border-blue/25 bg-blue/10 px-5 py-4 text-right">
                  <p className="text-xs uppercase tracking-[0.22em] text-blue">ID de la empresa</p>
                  <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.16em] text-ink">
                    {companyCode ?? '-'}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <CompanyField label="RIF" value={company?.rif} />
                <CompanyField label="Telefono" value={company?.phone} />
                <CompanyField label="Direccion" value={company?.address ?? undefined} />
              </div>
            </div>

            <div className="glass-panel rounded-[24px] p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Acceso de la empresa</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Usa este ID para entrar al panel de tu negocio de forma rapida y segura.
              </p>
              <div className="mt-4 rounded-2xl border border-line bg-white/[0.035] p-4">
                <p className="text-sm text-muted">ID de la empresa</p>
                <p className="mt-1 font-mono text-xl font-semibold tracking-[0.16em] text-blue">
                  {companyCode ?? '-'}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {metrics.map((metric, index) => (
              <PremiumMetricCard key={metric.label} metric={metric} index={index} />
            ))}
          </section>

          <Panel
            title="Solicitudes pendientes"
            description="Tareas que Fronti creó para que un operador humano pueda continuar el proceso."
            action={
              <Button type="button" variant="secondary" onClick={() => reload()}>
                <RefreshCcw className="h-4 w-4" />
                Actualizar solicitudes
              </Button>
            }
          >
            {notifications.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {notifications.slice(0, 6).map((notification) => (
                  <OperatorRequestCard
                    key={notification.id}
                    notification={notification}
                    onUpdated={reload}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Sin solicitudes pendientes"
                description="Cuando Fronti necesite apoyo humano, aparecerá aquí con el contexto listo para operar."
              />
            )}
          </Panel>

          <Panel
            title="Tasa BCV"
            action={
              <div className="flex flex-wrap gap-2">
                {bcv?.officialUrl ? (
                  <Button type="button" variant="secondary" onClick={() => window.open(bcv.officialUrl, '_blank')}>
                    <ArrowUpRight className="h-4 w-4" />
                    Ver publicación oficial
                  </Button>
                ) : null}
                <Button type="button" variant="secondary" onClick={syncBcvRate} disabled={bcvSyncing}>
                  <RefreshCcw className={`h-4 w-4 ${bcvSyncing ? 'animate-spin' : ''}`} />
                  Actualizar tasa
                </Button>
              </div>
            }
          >
            {bcv ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-line bg-white/[0.035] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Valor USD</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-ink">
                    Bs. {bcv.formattedRate}
                  </p>
                </div>
                <div className="rounded-[24px] border border-line bg-white/[0.035] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Fuente</p>
                  <p className="mt-3 text-base font-medium text-ink">Banco Central de Venezuela</p>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Tasa BCV no disponible"
                description="Tasa BCV no disponible. Intenta actualizar."
              />
            )}
          </Panel>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Panel title="Inteligencia operativa" description="Senales que merecen atencion hoy.">
              <div className="grid gap-3">
                <Insight text="Las ventas aumentaron 12% frente al periodo anterior." tone="success" />
                <Insight text="El aceite podria agotarse en 2 dias." tone="danger" />
                <Insight text="Hay margen para activar una promocion focalizada." tone="brand" />
              </div>
            </Panel>

            <Panel title="Promociones activas" description="Campanas disponibles para recomendar por WhatsApp.">
              {promotions.length ? (
                <div className="grid gap-3">
                  {promotions.slice(0, 4).map((promotion: Promotion) => (
                    <div
                      key={promotion.id}
                      className="flex items-center justify-between rounded-2xl border border-line bg-white/[0.035] p-4 transition hover:bg-white/[0.065]"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">{promotion.title}</p>
                        <p className="text-xs text-muted">{promotion.discountPercent}% descuento</p>
                      </div>
                      <StatusBadge>Activa</StatusBadge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Sin promociones activas"
                  description="Crea una campana para que Fronti recomiende ofertas con intencion comercial."
                />
              )}
            </Panel>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <Panel title="Pedidos recientes" description="Actividad comercial capturada por el panel y Fronti.">
              {orders.length ? (
                <RecentOrders orders={orders.slice(0, 6)} />
              ) : (
                <EmptyState
                  title="Aun no hay pedidos"
                  description="Cuando empiecen a llegar ordenes, este espacio se convertira en tu centro de control."
                />
              )}
            </Panel>

            <Panel title="Inventario critico" description="Productos que requieren reposicion antes de perder ventas.">
              {lowStock.length ? (
                <LowStockProducts products={lowStock.slice(0, 6)} />
              ) : (
                <EmptyState
                  title="Inventario saludable"
                  description="No hay productos por debajo del minimo configurado."
                />
              )}
            </Panel>
          </section>
        </>
      )}
    </div>
  );
}

function CompanyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.035] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-medium text-ink">{value || '-'}</p>
    </div>
  );
}

function PremiumMetricCard({
  metric,
  index,
}: {
  metric: {
    label: string;
    value: string | number;
    delta: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: 'violet' | 'cyan' | 'green' | 'red';
    data: readonly number[];
  };
  index: number;
}) {
  const Icon = metric.icon;
  const tone = {
    violet: 'text-brand bg-brand/15 border-brand/25',
    cyan: 'text-blue bg-blue/15 border-blue/25',
    green: 'text-success bg-success/15 border-success/25',
    red: 'text-danger bg-danger/15 border-danger/25',
  }[metric.tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.42 }}
      whileHover={{ y: -3 }}
      className="glass-panel group overflow-hidden rounded-[24px] p-5"
    >
      <div className="flex items-start justify-between">
        <div className={`grid h-11 w-11 place-items-center rounded-2xl border ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-1 rounded-full border border-line bg-white/[0.035] px-2 py-1 text-xs text-jade">
          {metric.delta}
          <ArrowUpRight className="h-3 w-3" />
        </div>
      </div>
      <p className="mt-5 text-sm text-muted">{metric.label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{metric.value}</p>
      <MiniChart data={metric.data} tone={metric.tone} />
    </motion.div>
  );
}

function MiniChart({
  data,
  tone,
}: {
  data: readonly number[];
  tone: 'violet' | 'cyan' | 'green' | 'red';
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const stroke = {
    violet: '#8B5CF6',
    cyan: '#22D3EE',
    green: '#22C55E',
    red: '#EF4444',
  }[tone];

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 220;
      const y = 54 - ((value - min) / Math.max(max - min, 1)) * 42;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="mt-5 h-16 w-full overflow-visible" viewBox="0 0 220 64" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function Insight({ text, tone }: { text: string; tone: 'success' | 'danger' | 'brand' }) {
  const color = {
    success: 'bg-success/15 text-success border-success/20',
    danger: 'bg-danger/15 text-danger border-danger/20',
    brand: 'bg-brand/15 text-brand border-brand/20',
  }[tone];

  return (
    <motion.div
      whileHover={{ x: 4 }}
      className="flex items-center gap-3 rounded-2xl border border-line bg-white/[0.035] p-4"
    >
      <span className={`grid h-8 w-8 place-items-center rounded-xl border ${color}`}>
        <Sparkles className="h-4 w-4" />
      </span>
      <p className="text-sm text-slate-200">{text}</p>
    </motion.div>
  );
}

function SystemLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-line bg-white/[0.035] px-3 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="inline-flex items-center gap-2 text-slate-200">
        <CheckCircle2 className="h-3.5 w-3.5 text-jade" />
        {value}
      </span>
    </div>
  );
}

function RecentOrders({ orders }: { orders: Order[] }) {
  return (
    <div className="grid gap-3">
      {orders.map((order) => (
        <div key={order.id} className="flex items-center justify-between rounded-2xl border border-line bg-white/[0.035] p-4">
          <div>
            <p className="text-sm font-medium text-ink">{order.customerName ?? order.customerPhone}</p>
            <p className="text-xs text-muted">USD {order.totalUsd} - {order.items.length} item(s)</p>
          </div>
          <StatusBadge>{order.status}</StatusBadge>
        </div>
      ))}
    </div>
  );
}

function OperatorRequestCard({
  notification,
  onUpdated,
}: {
  notification: InternalNotification;
  onUpdated: () => void;
}) {
  const [updating, setUpdating] = useState(false);
  const Icon = {
    DELIVERY_REVIEW_REQUIRED: MapPinned,
    ORDER_CONFIRMED: ShoppingBag,
    PAYMENT_REVIEW_REQUIRED: CircleDollarSign,
    HUMAN_SUPPORT_REQUIRED: Headphones,
  }[notification.type];
  const title = {
    DELIVERY_REVIEW_REQUIRED: 'Nuevo delivery por confirmar',
    ORDER_CONFIRMED: 'Nuevo pedido confirmado',
    PAYMENT_REVIEW_REQUIRED: 'Pago por verificar',
    HUMAN_SUPPORT_REQUIRED: 'Cliente necesita operador',
  }[notification.type];
  const priorityTone = {
    baja: 'border-blue/20 bg-blue/10 text-blue',
    media: 'border-brand/20 bg-brand/10 text-brand',
    alta: 'border-danger/25 bg-danger/10 text-danger',
    urgente: 'border-danger/35 bg-danger/20 text-danger',
  }[notification.priority];

  return (
    <motion.article
      whileHover={{ y: -2 }}
      className="rounded-[22px] border border-line bg-white/[0.035] p-4 transition hover:bg-white/[0.06]"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line bg-canvas/70 text-blue">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">{title}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${priorityTone}`}>
              {translatePriority(notification.priority)}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted">{notification.message}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <RequestLine label="Cliente" value={notification.customerName ?? notification.customerPhone ?? 'Por identificar'} />
        <RequestLine label="Dirección" value={notification.customerAddress ?? 'Pendiente de confirmar'} />
        <RequestLine
          label="Monto estimado"
          value={notification.estimatedAmountUsd ? `USD ${Number(notification.estimatedAmountUsd).toFixed(2)}` : 'Pendiente'}
        />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          {new Date(notification.createdAt).toLocaleString('es-VE')}
        </span>
        <StatusBadge>Pendiente</StatusBadge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={updating}
          onClick={async () => {
            setUpdating(true);
            try {
              await internalNotificationsApi.update(notification.id, { status: 'en_revision' });
              await onUpdated();
            } finally {
              setUpdating(false);
            }
          }}
        >
          Tomar solicitud
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={updating}
          onClick={async () => {
            setUpdating(true);
            try {
              await internalNotificationsApi.update(notification.id, { status: 'resuelta' });
              await onUpdated();
            } finally {
              setUpdating(false);
            }
          }}
        >
          Marcar resuelta
        </Button>
      </div>
    </motion.article>
  );
}

function RequestLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-canvas/35 px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="max-w-[62%] text-right text-ink">{value}</span>
    </div>
  );
}

function translatePriority(priority: InternalNotification['priority']) {
  return {
    baja: 'Baja',
    media: 'Media',
    alta: 'Alta',
    urgente: 'Urgente',
  }[priority];
}

function LowStockProducts({ products }: { products: Product[] }) {
  return (
    <div className="grid gap-3">
      {products.map((product) => (
        <div key={product.id} className="flex items-center justify-between rounded-2xl border border-line bg-white/[0.035] p-4">
          <div>
            <p className="text-sm font-medium text-ink">{product.name}</p>
            <p className="text-xs text-muted">Minimo {product.minStock}</p>
          </div>
          <StatusBadge>{product.stock} und.</StatusBadge>
        </div>
      ))}
    </div>
  );
}
