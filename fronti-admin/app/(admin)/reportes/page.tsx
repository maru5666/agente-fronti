'use client';

import { PageHeader } from '@/components/page-header';
import { ErrorState, LoadingState, MetricCard, Panel } from '@/components/ui';
import { useCompany } from '@/hooks/use-company';
import { useResource } from '@/hooks/use-resource';
import { ordersApi, productsApi } from '@/services/api';

export default function ReportesPage() {
  const { companyId } = useCompany();
  const { data, loading, error } = useResource(
    async () => {
      if (!companyId) return { products: [], orders: [] };
      const [products, orders] = await Promise.all([
        productsApi.list(companyId),
        ordersApi.list(companyId),
      ]);
      return { products, orders };
    },
    [companyId],
  );
  const orders = data?.orders ?? [];
  const products = data?.products ?? [];
  const revenueUsd = orders.reduce((sum, order) => sum + Number(order.totalUsd), 0);
  const delivered = orders.filter((order) => order.status === 'delivered').length;

  return (
    <>
      <PageHeader title="Reportes" description="Indicadores basicos para revisar operacion y ventas." />
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState /> : (
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Pedidos totales" value={orders.length} />
            <MetricCard label="Pedidos entregados" value={delivered} />
            <MetricCard label="Ingresos pedidos USD" value={`$${revenueUsd.toFixed(2)}`} />
            <MetricCard label="SKUs activos" value={products.length} />
          </div>
          <Panel title="Resumen por estado">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {['pending', 'confirmed', 'paid', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'].map((status) => (
                <div key={status} className="rounded-md border border-line p-3">
                  <p className="text-xs text-muted">{status}</p>
                  <p className="mt-1 text-xl font-semibold">{orders.filter((order) => order.status === status).length}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
