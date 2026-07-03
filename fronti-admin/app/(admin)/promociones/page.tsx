'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Gift, Power } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '@/components/page-header';
import { Button, EmptyState, ErrorState, Field, Input, LoadingState, Panel, Select, StatusBadge } from '@/components/ui';
import { useCompany } from '@/hooks/use-company';
import { useResource } from '@/hooks/use-resource';
import { promotionSchema } from '@/lib/validations';
import { getApiError, productsApi, promotionsApi } from '@/services/api';

type PromotionForm = z.infer<typeof promotionSchema>;

export default function PromocionesPage() {
  const { companyId } = useCompany();
  const [error, setError] = useState('');
  const { data, loading, error: loadError, reload } = useResource(
    async () => {
      if (!companyId) return { products: [], promotions: [] };
      const [products, promotions] = await Promise.all([
        productsApi.list(companyId),
        promotionsApi.active(companyId),
      ]);
      return { products, promotions };
    },
    [companyId],
  );
  const form = useForm<PromotionForm>({
    resolver: zodResolver(promotionSchema),
  });

  async function submit(values: PromotionForm) {
    if (!companyId) return;
    setError('');
    try {
      await promotionsApi.create({ ...values, companyId });
      form.reset();
      reload();
    } catch (err) {
      setError(getApiError(err));
    }
  }

  async function deactivate(id: string) {
    await promotionsApi.remove(id);
    reload();
  }

  return (
    <>
      <PageHeader title="Promociones" description="Crea ofertas activas para que Fronti pueda recomendarlas." />
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Panel title="Nueva promocion">
          <form className="grid gap-3" onSubmit={form.handleSubmit(submit)}>
            {error ? <ErrorState message={error} /> : null}
            <Field label="Producto">
              <Select {...form.register('productId')}>
                <option value="">General</option>
                {(data?.products ?? []).map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Titulo"><Input {...form.register('title')} /></Field>
            <Field label="Descripcion"><Input {...form.register('description')} /></Field>
            <Field label="Descuento %"><Input type="number" step="0.01" {...form.register('discountPercent')} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Inicio"><Input type="datetime-local" {...form.register('startDate')} /></Field>
              <Field label="Fin"><Input type="datetime-local" {...form.register('endDate')} /></Field>
            </div>
            <Button type="submit"><Gift className="h-4 w-4" />Crear promocion</Button>
          </form>
        </Panel>
        <Panel title="Promociones activas">
          {loadError ? <ErrorState message={loadError} /> : null}
          {loading ? <LoadingState /> : data?.promotions.length ? (
            <div className="grid gap-2">
              {data.promotions.map((promotion) => (
                <div key={promotion.id} className="flex items-center justify-between rounded-md border border-line p-3">
                  <div>
                    <p className="text-sm font-medium">{promotion.title}</p>
                    <p className="text-xs text-muted">{promotion.discountPercent}% · {promotion.product?.name ?? 'General'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge>Activa</StatusBadge>
                    <Button variant="ghost" onClick={() => deactivate(promotion.id)}><Power className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="Sin promociones" description="No hay promociones activas para mostrar." />}
        </Panel>
      </div>
    </>
  );
}
