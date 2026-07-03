'use client';

import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, LoadingState, MetricCard, Panel } from '@/components/ui';
import { useCompany } from '@/hooks/use-company';
import { useResource } from '@/hooks/use-resource';
import { ordersApi } from '@/services/api';

export default function ClientesPage() {
  const { companyId } = useCompany();
  const { data: orders, loading, error } = useResource(
    () => (companyId ? ordersApi.list(companyId) : Promise.resolve([])),
    [companyId],
  );
  const customers = Array.from(
    new Map((orders ?? []).map((order) => [order.customerPhone, order])).values(),
  );

  return (
    <>
      <PageHeader title="Clientes" description="Clientes detectados a partir de pedidos y conversaciones comerciales." />
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState /> : (
        <div className="grid gap-5">
          <MetricCard label="Clientes con pedidos" value={customers.length} />
          <Panel title="Listado de clientes">
            {customers.length ? (
              <div className="grid gap-2">
                {customers.map((customer) => (
                  <div key={customer.customerPhone} className="rounded-md border border-line p-3">
                    <p className="text-sm font-medium">{customer.customerName ?? 'Cliente WhatsApp'}</p>
                    <p className="text-xs text-muted">{customer.customerPhone}</p>
                    <p className="mt-1 text-xs text-muted">{customer.validatedAddress ?? customer.customerAddress ?? 'Sin direccion registrada'}</p>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="Sin clientes" description="Los clientes apareceran al registrar pedidos." />}
          </Panel>
        </div>
      )}
    </>
  );
}
