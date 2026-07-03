import type { Company } from '@/types';

const COMPANY_ID_KEY = 'fronti_company_id';
const WORKSPACE_CODE_KEY = 'fronti_workspace_code';
const COMPANY_NAME_KEY = 'fronti_company_name';

export type FrontiSession = {
  companyId: string | null;
  workspaceCode: string | null;
  companyName: string | null;
};

function canUseStorage() {
  return typeof window !== 'undefined';
}

export function saveSession(company: Pick<Company, 'id' | 'workspaceCode' | 'name'>) {
  if (!canUseStorage()) return;

  window.localStorage.setItem(COMPANY_ID_KEY, company.id);
  window.localStorage.setItem(WORKSPACE_CODE_KEY, company.workspaceCode);
  window.localStorage.setItem(COMPANY_NAME_KEY, company.name);
}

export function getSession(): FrontiSession {
  if (!canUseStorage()) {
    return {
      companyId: null,
      workspaceCode: null,
      companyName: null,
    };
  }

  return {
    companyId: window.localStorage.getItem(COMPANY_ID_KEY),
    workspaceCode: window.localStorage.getItem(WORKSPACE_CODE_KEY),
    companyName: window.localStorage.getItem(COMPANY_NAME_KEY),
  };
}

export function clearSession() {
  if (!canUseStorage()) return;

  window.localStorage.removeItem(COMPANY_ID_KEY);
  window.localStorage.removeItem(WORKSPACE_CODE_KEY);
  window.localStorage.removeItem(COMPANY_NAME_KEY);
}
