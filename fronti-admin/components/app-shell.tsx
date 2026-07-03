'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Images,
  LogOut,
  MapPinned,
  MessageSquareText,
  Package,
  PanelLeft,
  Settings,
  ShoppingBag,
  Sparkles,
  Tags,
  Users,
  Warehouse,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCompany } from '@/hooks/use-company';
import { internalNotificationsApi } from '@/services/api';
import { FrontiLogo } from './fronti-logo';
import { Button } from './ui';

const FrontiAssistantPanel = dynamic(
  () => import('./fronti-assistant-panel').then((module) => module.FrontiAssistantPanel),
  { ssr: false },
);

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/inventario', label: 'Inventario', icon: Warehouse },
  { href: '/productos', label: 'Productos', icon: Package },
  { href: '/catalogo', label: 'Catálogo', icon: Images },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/zonas-delivery', label: 'Delivery', icon: MapPinned },
  { href: '/promociones', label: 'Promociones', icon: Tags },
  { href: '/reportes', label: 'Reportes', icon: ClipboardList },
  { href: '/chat-fronti', label: 'Fronti AI', icon: MessageSquareText },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { company, companyCode, companyId, logout } = useCompany();
  const [collapsed, setCollapsed] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!companyId) {
      setPendingRequests(0);
      return () => {
        cancelled = true;
      };
    }

    internalNotificationsApi
      .pendingCount(companyId)
      .then((result) => {
        if (!cancelled) {
          setPendingRequests(result.count);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPendingRequests(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, pathname]);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <div className="premium-grid min-h-screen overflow-x-hidden bg-canvas text-ink">
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-canvas/86 shadow-2xl shadow-black/30 backdrop-blur-2xl lg:block ${
          collapsed ? 'w-[88px]' : 'w-[288px]'
        } transition-[width] duration-300 ease-out`}
      >
        <div className="flex h-20 items-center justify-between border-b border-line px-5">
          <FrontiLogo showWordmark={!collapsed} />
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="grid h-9 w-9 place-items-center rounded-2xl border border-line bg-white/[0.04] text-muted transition hover:border-white/20 hover:bg-white/[0.08] hover:text-ink"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="grid gap-1.5 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex h-11 items-center gap-3 overflow-hidden rounded-2xl px-3 text-sm transition ${
                  active
                    ? 'border border-brand/30 bg-white/[0.08] text-ink shadow-lg shadow-brand/10'
                    : 'text-muted hover:bg-white/[0.055] hover:text-ink'
                }`}
              >
                {active ? (
                  <span className="absolute inset-y-2 left-1 w-1 rounded-full bg-gradient-to-b from-brand to-blue" />
                ) : null}
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className={`${collapsed ? 'lg:pl-[88px]' : 'lg:pl-[288px]'} min-h-screen min-w-0 transition-[padding] duration-300 ease-out`}>
        <header className="sticky top-0 z-20 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas/72 px-4 backdrop-blur-2xl sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-2xl border border-line bg-white/[0.04] text-muted lg:hidden"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {company?.name ?? 'Empresa no seleccionada'}
              </p>
              <p className="truncate text-xs text-muted">
                {companyCode ? `ID de la empresa: ${companyCode}` : 'Inicia sesión para operar'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button className="relative grid h-10 w-10 place-items-center rounded-2xl border border-line bg-white/[0.04] text-muted transition hover:bg-white/[0.08] hover:text-ink">
              <Bell className="h-4 w-4" />
              {pendingRequests > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                  {pendingRequests > 9 ? '9+' : pendingRequests}
                </span>
              ) : null}
            </button>
            <Button type="button" variant="secondary" onClick={() => setAssistantOpen(true)}>
              <Sparkles className="h-4 w-4 text-blue" />
              Copiloto
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Salir
            </Button>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1600px] p-4 pb-28 sm:p-6 lg:p-8">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-canvas/92 p-1 backdrop-blur-2xl lg:hidden">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`grid place-items-center rounded-2xl py-2 text-xs ${
                active ? 'text-blue' : 'text-muted'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="mt-1">{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>

      {assistantOpen ? (
        <FrontiAssistantPanel companyId={companyId} onClose={() => setAssistantOpen(false)} />
      ) : null}
    </div>
  );
}
