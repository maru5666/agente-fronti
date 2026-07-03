'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Company } from '@/types';
import { companiesApi } from '@/services/api';
import { clearSession, getSession, saveSession } from '@/lib/session';

type CompanyContextValue = {
  companyId: string | null;
  companyCode: string | null;
  workspaceCode: string | null;
  company: Company | null;
  loading: boolean;
  setCompanySession: (nextCompany: Company) => string;
  logout: () => void;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [workspaceCode, setWorkspaceCodeState] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [hasCheckedSession, setHasCheckedSession] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    console.log('Sesión detectada:', session);
    setCompanyId(session.companyId);
    setWorkspaceCodeState(session.workspaceCode);

    if (session.companyId || session.workspaceCode || session.companyName) {
      setCompany({
        id: session.companyId ?? '',
        workspaceCode: session.workspaceCode ?? '',
        name: session.companyName ?? 'Empresa',
        rif: '',
        phone: '',
        address: null,
      });
    }

    setHasCheckedSession(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCompany() {
      if (!hasCheckedSession) {
        return;
      }

      const session = getSession();
      const accessCode = session.workspaceCode ?? session.companyId;

      if (!companyId && !accessCode) {
        setCompany(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const nextCompany = companyId
          ? isUuid(companyId)
            ? await companiesApi.get(companyId)
            : await companiesApi.getByAccess(companyId)
          : await companiesApi.getByAccess(accessCode!);

        if (cancelled) return;
        setCompany(nextCompany);
        setCompanyId(nextCompany.id);
        setWorkspaceCodeState(nextCompany.workspaceCode);
        saveSession(nextCompany);
      } catch {
        if (cancelled) return;

        if (accessCode && accessCode !== companyId) {
          try {
            const nextCompany = await companiesApi.getByAccess(accessCode);
            if (cancelled) return;
            setCompany(nextCompany);
            setCompanyId(nextCompany.id);
            setWorkspaceCodeState(nextCompany.workspaceCode);
            saveSession(nextCompany);
            return;
          } catch {
            // Fall back to the lightweight local session below.
          }
        }

        setCompany((currentCompany) => currentCompany ?? buildLocalCompanyFallback());
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCompany();

    return () => {
      cancelled = true;
    };
  }, [companyId, hasCheckedSession]);

  function setCompanySession(nextCompany: Company) {
    saveSession(nextCompany);
    setCompany(nextCompany);
    setCompanyId(nextCompany.id);
    setWorkspaceCodeState(nextCompany.workspaceCode);
    setHasCheckedSession(true);

    return nextCompany.workspaceCode;
  }

  function logout() {
    clearSession();
    setWorkspaceCodeState(null);
    setCompanyId(null);
    setCompany(null);
    setHasCheckedSession(true);
  }

  const value = useMemo<CompanyContextValue>(
    () => ({
      companyId,
      companyCode: workspaceCode,
      workspaceCode,
      company,
      loading,
      setCompanySession,
      logout,
    }),
    [company, companyId, loading, workspaceCode],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);

  if (!context) {
    throw new Error('useCompany debe usarse dentro de CompanyProvider.');
  }

  return context;
}

function buildLocalCompanyFallback(): Company | null {
  const session = getSession();

  if (!session.companyId && !session.workspaceCode && !session.companyName) {
    return null;
  }

  return {
    id: session.companyId ?? '',
    workspaceCode: session.workspaceCode ?? '',
    name: session.companyName ?? 'Empresa',
    rif: '',
    phone: '',
    address: null,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
