'use client';

import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, LoadingState, MetricCard, Panel, StatusBadge } from '@/components/ui';
import { useCompany } from '@/hooks/use-company';
import { useResource } from '@/hooks/use-resource';
import { productsApi } from '@/services/api';

export default function InventarioPage() {
  const { companyId } = useCompany();
  const { data, loading, error } = useResource(
    async () => {
      if (!companyId) return { products: [], lowStock: [] };
      const [products, lowStock] = await Promise.all([
        productsApi.list(companyId),
        productsApi.lowStock(companyId),
      ]);
      return { products, lowStock };
    },
    [companyId],
  );

  const products = data?.products ?? [];
  const lowStock = data?.lowStock ?? [];
  const totalUnits = products.reduce((sum, product) => sum + product.stock, 0);

  return (
    <>
      <PageHeader title="Inventario" description="Control de existencias y alertas de reposicion." />
      {error ? <ErrorState message={error} /> : null}
      {loading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard label="Unidades totales" value={totalUnits} />
            <MetricCard label="Productos activos" value={products.length} />
            <MetricCard label="Alertas stock bajo" value={lowStock.length} />
          </div>
          <Panel title="Stock bajo">
            {lowStock.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="text-xs uppercase text-muted">
                    <tr className="border-b border-line">
                      <th className="py-3">Producto</th>
                      <th>Categoria</th>
                      <th>Stock</th>
                      <th>Minimo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((product) => (
                      <tr key={product.id} className="border-b border-line last:border-0">
                        <td className="py-3 font-medium">{product.name}</td>
                        <td>{product.category ?? 'Sin categoria'}</td>
                        <td>{product.stock}</td>
                        <td>{product.minStock}</td>
                        <td><StatusBadge>Reponer</StatusBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Sin alertas" description="Todos los productos estan por encima del minimo configurado." />
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
