'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FrontiLogo } from '@/components/fronti-logo';
import { Button, ErrorState, Field, Input, Panel } from '@/components/ui';
import { loginSchema } from '@/lib/validations';
import { getSession, saveSession } from '@/lib/session';
import { companiesApi, getApiError } from '@/services/api';

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm) {
    setError('');
    try {
      const company = await companiesApi.login({
        identifier: data.accessCode.trim(),
        password: data.password,
      });
      console.log('Empresa encontrada:', company);
      saveSession(company);
      console.log('Sesión guardada:', getSession());
      router.push('/dashboard');
    } catch (err) {
      setError(getApiError(err));
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <FrontiLogo />
          <h1 className="mt-2 text-2xl font-semibold">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-muted">
            Ingresa el ID de tu empresa y tu contraseña.
          </p>
        </div>
        <Panel>
          <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
            {error ? <ErrorState message={error} /> : null}
            <Field label="ID de la empresa o RIF" error={errors.accessCode?.message}>
              <Input placeholder="Ej: market o J123456789" {...register('accessCode')} />
            </Field>
            <Field label="Contraseña" error={errors.password?.message}>
              <Input type="password" placeholder="Tu contraseña" {...register('password')} />
            </Field>
            <Button type="submit" disabled={isSubmitting}>
              <LogIn className="h-4 w-4" />
              Entrar
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted">
            ¿No tienes empresa?{' '}
            <Link className="font-medium text-blue underline" href="/registro">
              Registrar empresa
            </Link>
          </p>
        </Panel>
      </div>
    </main>
  );
}
