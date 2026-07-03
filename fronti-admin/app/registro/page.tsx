'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, CheckCircle2, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FrontiLogo } from '@/components/fronti-logo';
import { Button, ErrorState, Field, Input, Panel } from '@/components/ui';
import { companySchema } from '@/lib/validations';
import { getSession, saveSession } from '@/lib/session';
import { companiesApi, getApiError } from '@/services/api';
import type { Company } from '@/types';

type CompanyForm = z.infer<typeof companySchema>;
type WorkspaceStatus = 'idle' | 'checking' | 'available' | 'taken';

export default function RegistroPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [registeredCode, setRegisteredCode] = useState('');
  const [copyError, setCopyError] = useState('');
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>('idle');
  const [registeredCompany, setRegisteredCompany] = useState<Company | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  });
  const workspaceCodeField = register('workspaceCode');
  const watchedWorkspaceCode = watch('workspaceCode');

  useEffect(() => {
    const normalized = watchedWorkspaceCode?.trim().toLowerCase() ?? '';

    if (!/^[a-z0-9]{3,20}$/.test(normalized)) {
      setWorkspaceStatus('idle');
      return;
    }

    setWorkspaceStatus('checking');
    const timer = window.setTimeout(async () => {
      try {
        const result = await companiesApi.checkWorkspaceAvailability(normalized);
        setWorkspaceStatus(result.available ? 'available' : 'taken');
      } catch {
        setWorkspaceStatus('idle');
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [watchedWorkspaceCode]);

  async function onSubmit(data: CompanyForm) {
    setError('');
    try {
      const workspaceCode = data.workspaceCode.trim().toLowerCase();
      const availability = await companiesApi.checkWorkspaceAvailability(workspaceCode);

      if (!availability.available) {
        setWorkspaceStatus('taken');
        setError('Este ID ya esta en uso.');
        return;
      }

      const company = await companiesApi.create({
        ...data,
        workspaceCode,
      });
      console.log('Empresa registrada:', company);
      saveSession(company);
      console.log('Sesión guardada:', getSession());
      const publicCode = company.workspaceCode;
      setRegisteredCode(publicCode);
      setRegisteredCompany(company);
    } catch (err) {
      setError(getApiError(err));
    }
  }

  async function copyWorkspaceCode() {
    if (!registeredCode) return;
    setCopyError('');
    try {
      await navigator.clipboard.writeText(registeredCode);
    } catch {
      setCopyError('No se pudo copiar automáticamente. Selecciona y copia manualmente.');
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <FrontiLogo />
          <h1 className="mt-2 text-2xl font-semibold">Registro de empresa</h1>
          <p className="mt-1 text-sm text-muted">
            Crea la empresa y empieza a cargar productos, delivery y pagos.
          </p>
        </div>
        {registeredCompany ? (
          <Panel>
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div>
                  <p className="text-sm font-semibold">Empresa registrada correctamente.</p>
                  <p className="mt-1 text-sm text-muted">
                    Tu ID de empresa es:{' '}
                    <span className="font-mono font-semibold text-ink">{registeredCode}</span>
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    No olvides este ID. Tambien puedes ingresar con tu RIF.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-white/[0.035] p-3">
                <p className="text-xs font-medium uppercase text-muted">ID de la empresa</p>
                <p className="mt-2 font-mono text-2xl font-semibold tracking-[0.18em] text-ink">
                  {registeredCode || '-'}
                </p>
                {copyError ? (
                  <div className="mt-3 grid gap-2">
                    <Input readOnly value={registeredCode} onFocus={(event) => event.target.select()} />
                    <p className="text-xs text-red-300">{copyError}</p>
                  </div>
                ) : null}
              </div>
              <div className="grid gap-2 rounded-2xl border border-line bg-white/[0.025] p-3 text-sm">
                <InfoLine label="Empresa" value={registeredCompany.name} />
                <InfoLine label="RIF" value={registeredCompany.rif} />
                <InfoLine label="Teléfono" value={registeredCompany.phone} />
                <InfoLine label="Correo" value={registeredCompany.email ?? 'Sin correo'} />
                <InfoLine label="Dirección" value={registeredCompany.address ?? 'Sin dirección'} />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" onClick={() => router.push('/dashboard')}>
                  Ir al dashboard
                </Button>
                <Button type="button" variant="secondary" onClick={copyWorkspaceCode}>
                  <Copy className="h-4 w-4" />
                  Copiar ID
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRegisteredCompany(null)}
                >
                  Registrar otra empresa
                </Button>
              </div>
            </div>
          </Panel>
        ) : (
          <Panel>
            <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
              {error ? <ErrorState message={error} /> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" error={errors.name?.message}>
                  <Input {...register('name')} />
                </Field>
                <Field label="ID de la empresa" error={errors.workspaceCode?.message}>
                  <Input
                    placeholder="Ej: market"
                    {...workspaceCodeField}
                    onChange={(event) => {
                      event.target.value = event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '');
                      workspaceCodeField.onChange(event);
                    }}
                  />
                  {workspaceStatus === 'checking' ? (
                    <span className="text-xs text-muted">Verificando disponibilidad...</span>
                  ) : null}
                  {workspaceStatus === 'taken' ? (
                    <span className="text-xs text-red-400">Este ID ya esta en uso.</span>
                  ) : null}
                  {workspaceStatus === 'available' ? (
                    <span className="text-xs text-success">ID disponible</span>
                  ) : null}
                </Field>
                <Field label="RIF" error={errors.rif?.message}>
                  <Input {...register('rif')} />
                </Field>
                <Field label="Telefono" error={errors.phone?.message}>
                  <Input {...register('phone')} />
                </Field>
                <Field label="Direccion" error={errors.address?.message}>
                  <Input {...register('address')} />
                </Field>
                <Field label="Correo" error={errors.email?.message}>
                  <Input type="email" placeholder="empresa@fronti.ai" {...register('email')} />
                </Field>
                <Field label="Contraseña" error={errors.password?.message}>
                  <Input type="password" placeholder="Mínimo 8 caracteres" {...register('password')} />
                </Field>
              </div>
              <Button type="submit" disabled={isSubmitting}>
                <Building2 className="h-4 w-4" />
                Registrar
              </Button>
            </form>
            <p className="mt-4 text-sm text-muted">
              Ya tienes empresa?{' '}
              <Link className="font-medium text-blue underline" href="/login">
                Iniciar sesion
              </Link>
            </p>
          </Panel>
        )}
      </div>
    </main>
  );
}

function InfoLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value || '-'}</span>
    </div>
  );
}
