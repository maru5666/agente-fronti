'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingState } from './ui';
import { useCompany } from '@/hooks/use-company';

export function Guard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { companyId, loading } = useCompany();

  useEffect(() => {
    if (!loading && !companyId) {
      router.push('/login');
    }
  }, [companyId, loading, router]);

  if (loading || !companyId) {
    return <LoadingState label="Preparando panel" />;
  }

  return <>{children}</>;
}
