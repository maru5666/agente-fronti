'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ImageIcon, Palette, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '@/components/page-header';
import { Button, Field, Input, LoadingState, MetricCard, Panel } from '@/components/ui';
import { useCompany } from '@/hooks/use-company';
import { companyIdentitySchema } from '@/lib/validations';
import { companiesApi, getApiError } from '@/services/api';

type CompanyIdentityForm = z.infer<typeof companyIdentitySchema>;

export default function ConfiguracionPage() {
  const { company, workspaceCode, loading, setCompanySession } = useCompany();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const form = useForm<CompanyIdentityForm>({
    resolver: zodResolver(companyIdentitySchema),
    defaultValues: {
      commercialName: '',
      phone: '',
      address: '',
      logo: '',
      primaryColor: '#C9A227',
      catalogBanner: '',
    },
  });

  useEffect(() => {
    if (!company) return;
    form.reset({
      commercialName: company.commercialName ?? '',
      phone: company.phone ?? '',
      address: company.address ?? '',
      logo: company.logo ?? '',
      primaryColor: company.primaryColor ?? '#C9A227',
      catalogBanner: company.catalogBanner ?? '',
    });
  }, [company, form]);

  async function submit(values: CompanyIdentityForm) {
    if (!company?.id) return;
    setMessage('');
    setError('');

    try {
      const updated = await companiesApi.update(company.id, {
        ...values,
        primaryColor: values.primaryColor || undefined,
      });
      setCompanySession(updated);
      setMessage('Identidad de catálogo guardada.');
    } catch (err) {
      setError(getApiError(err));
    }
  }

  const previewName = form.watch('commercialName') || company?.name || 'Fronti Store';
  const previewLogo = form.watch('logo');
  const previewBanner = form.watch('catalogBanner');
  const previewColor = form.watch('primaryColor') || '#C9A227';

  return (
    <>
      <PageHeader title="Configuración de empresa" description="Personaliza la identidad visual que verá tu cliente en la vitrina." />
      {loading ? <LoadingState /> : (
        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard label="Empresa" value={company?.name ?? '-'} />
              <MetricCard label="RIF" value={company?.rif ?? '-'} />
              <MetricCard label="Teléfono" value={company?.phone ?? '-'} />
            </div>

            <Panel title="Identidad de catálogo" description="Estos datos personalizan la vitrina sin mostrar información técnica.">
              <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
                {message ? (
                  <div className="rounded-2xl border border-green-400/20 bg-green-400/10 p-3 text-sm text-green-200">
                    {message}
                  </div>
                ) : null}
                {error ? (
                  <div className="rounded-2xl border border-brand/20 bg-brand/10 p-3 text-sm text-brand">
                    No pudimos guardar los cambios. Revisa la conexión e intenta de nuevo.
                  </div>
                ) : null}
                <Field label="Nombre comercial">
                  <Input placeholder="Ej: Market Los Andes" {...form.register('commercialName')} />
                </Field>
                <Field label="Logo de la empresa">
                  <Input placeholder="URL jpg, png o webp" {...form.register('logo')} />
                </Field>
                <Field label="Color principal" error={form.formState.errors.primaryColor?.message}>
                  <Input placeholder="#C9A227" {...form.register('primaryColor')} />
                </Field>
                <Field label="Banner de catálogo">
                  <Input placeholder="URL jpg, png o webp" {...form.register('catalogBanner')} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Teléfono">
                    <Input {...form.register('phone')} />
                  </Field>
                  <Field label="Dirección">
                    <Input {...form.register('address')} />
                  </Field>
                </div>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  <Save className="h-4 w-4" />
                  Guardar identidad
                </Button>
              </form>
            </Panel>

            <Panel title="Datos operativos">
              <div className="grid gap-3 text-sm">
                <Info label="ID de la empresa" value={workspaceCode ?? '-'} />
                <Info label="Dirección" value={company?.address ?? 'Sin dirección'} />
              </div>
            </Panel>
          </div>

          <aside className="rounded-[28px] border border-white/[0.08] bg-[#1E1E1E] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
            <div className="relative overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#111827]">
              <div className="h-36 bg-white/[0.04]">
                {previewBanner ? (
                  <img src={previewBanner} alt="Banner de catálogo" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_top,rgba(201,162,39,0.18),transparent_34%),linear-gradient(135deg,#111827,#1E1E1E)]">
                    <ImageIcon className="h-8 w-8" style={{ color: previewColor }} />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.05]">
                    {previewLogo ? (
                      <img src={previewLogo} alt={previewName} className="h-full w-full object-cover" />
                    ) : (
                      <Palette className="h-6 w-6" style={{ color: previewColor }} />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted">Vista previa</p>
                    <h2 className="text-lg font-semibold text-ink">{previewName}</h2>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-300">
                  Así se verá el encabezado de tu vitrina para clientes y vendedores.
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-white/[0.035] p-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
