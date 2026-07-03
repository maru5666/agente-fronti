'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CreditCard, Power } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '@/components/page-header';
import { Button, EmptyState, ErrorState, Field, Input, LoadingState, Panel, Select, StatusBadge } from '@/components/ui';
import { useCompany } from '@/hooks/use-company';
import { useResource } from '@/hooks/use-resource';
import { paymentMethodSchema } from '@/lib/validations';
import { getApiError, paymentMethodsApi } from '@/services/api';

type PaymentForm = z.infer<typeof paymentMethodSchema>;

export default function MetodosPagoPage() {
  const { companyId } = useCompany();
  const [error, setError] = useState('');
  const { data, loading, error: loadError, reload } = useResource(
    () => (companyId ? paymentMethodsApi.list(companyId) : Promise.resolve([])),
    [companyId],
  );
  const form = useForm<PaymentForm>({ resolver: zodResolver(paymentMethodSchema) });

  async function submit(values: PaymentForm) {
    if (!companyId) return;
    setError('');
    try {
      await paymentMethodsApi.create({ ...values, companyId });
      form.reset();
      reload();
    } catch (err) {
      setError(getApiError(err));
    }
  }

  async function deactivate(id: string) {
    await paymentMethodsApi.remove(id);
    reload();
  }

  return (
    <>
      <PageHeader title="Metodos de pago" description="Configura las formas de pago disponibles por empresa." />
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Panel title="Nuevo metodo">
          <form className="grid gap-3" onSubmit={form.handleSubmit(submit)}>
            {error ? <ErrorState message={error} /> : null}
            <Field label="Nombre"><Input placeholder="Pago movil" {...form.register('name')} /></Field>
            <Field label="Tipo">
              <Select {...form.register('type')}>
                <option value="pago_movil">Pago movil</option>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="zelle">Zelle</option>
                <option value="binance">Binance</option>
                <option value="pos">Punto de venta</option>
                <option value="custom">Personalizado</option>
              </Select>
            </Field>
            <Field label="Moneda"><Input placeholder="VES, USD, COP" {...form.register('currency')} /></Field>
            <Field label="Descripcion"><Input {...form.register('description')} /></Field>
            <Button type="submit"><CreditCard className="h-4 w-4" />Crear metodo</Button>
          </form>
        </Panel>
        <Panel title="Metodos activos">
          {loadError ? <ErrorState message={loadError} /> : null}
          {loading ? <LoadingState /> : data?.length ? (
            <div className="grid gap-2">
              {data.map((method) => (
                <div key={method.id} className="flex items-center justify-between rounded-md border border-line p-3">
                  <div>
                    <p className="text-sm font-medium">{method.name}</p>
                    <p className="text-xs text-muted">{method.type} · {method.currency}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge>{method.isActive ? 'Activo' : 'Inactivo'}</StatusBadge>
                    <Button variant="ghost" onClick={() => deactivate(method.id)}><Power className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="Sin metodos" description="Agrega pago movil, efectivo, Zelle, Binance u otros metodos." />}
        </Panel>
      </div>
    </>
  );
}
