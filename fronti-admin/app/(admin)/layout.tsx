import { AppShell } from '@/components/app-shell';
import { Guard } from '@/components/guard';
import { CompanyProvider } from '@/hooks/use-company';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompanyProvider>
      <AppShell>
        <Guard>{children}</Guard>
      </AppShell>
    </CompanyProvider>
  );
}
