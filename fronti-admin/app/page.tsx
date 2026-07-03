import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  MapPinned,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

const benefits = [
  'Atiende clientes desde WhatsApp con contexto comercial.',
  'Conecta catálogo, inventario, pedidos, delivery y pagos.',
  'Muestra precios en USD y bolívares usando tasa BCV.',
  'Permite operar múltiples empresas desde una arquitectura escalable.',
];

const modules = [
  {
    icon: MessageCircle,
    title: 'Frontti IA',
    description: 'Asesora comercial para responder, recomendar y guiar compras.',
  },
  {
    icon: ShoppingBag,
    title: 'Catálogo vivo',
    description: 'Productos, marcas, stock, precios y promociones sincronizadas.',
  },
  {
    icon: MapPinned,
    title: 'Delivery',
    description: 'Direcciones, zonas, distancia, tiempo y costo de envío.',
  },
  {
    icon: BarChart3,
    title: 'Operación',
    description: 'Dashboard, inventario, pedidos, reportes y configuración.',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#05060A] text-white">
      <section className="relative isolate">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.28),transparent_34rem),radial-gradient(circle_at_85%_20%,rgba(59,130,246,0.16),transparent_28rem),linear-gradient(135deg,#05060A_0%,#0B0D12_48%,#111827_100%)]" />
        <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-purple-300/40 to-transparent" />

        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Frontti AI OS">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-purple-300/20 bg-purple-400/15 shadow-lg shadow-purple-950/30">
              <Sparkles className="h-5 w-5 text-purple-200" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Frontti AI OS</span>
          </Link>

          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-purple-300/40 hover:bg-white/[0.04] sm:inline-flex"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-full bg-purple-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-950/35 transition hover:bg-purple-400"
            >
              Probar Demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </header>

        <div className="mx-auto grid min-h-[calc(100vh-92px)] w-full max-w-7xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1fr_0.92fr] lg:px-8 lg:pb-24">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-400/10 px-4 py-2 text-sm font-medium text-purple-100">
              <ShieldCheck className="h-4 w-4" />
              Sistema operativo inteligente para comercios venezolanos
            </div>

            <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Frontti AI OS
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              Unifica atención, catálogo, inventario, pedidos, delivery, pagos y analítica en una
              plataforma empresarial diseñada para operar con IA desde WhatsApp.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/demo"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-purple-500 px-6 py-4 text-base font-bold text-white shadow-2xl shadow-purple-950/40 transition hover:-translate-y-0.5 hover:bg-purple-400"
              >
                Probar Demo Beauty Hub
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-13 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-base font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-purple-300/40 hover:bg-white/[0.07]"
              >
                Iniciar sesión
              </Link>
            </div>

            <div className="mt-10 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-purple-500/10 blur-3xl" />
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="rounded-[1.5rem] border border-white/10 bg-[#080A10] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Beauty Hub</p>
                    <p className="text-xs text-slate-400">Demo comercial en vivo</p>
                  </div>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                    En línea
                  </span>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-3xl border border-purple-300/15 bg-purple-400/10 p-4">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-purple-400/20">
                        <Bot className="h-5 w-5 text-purple-100" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">Frontti IA</p>
                        <p className="text-xs text-slate-400">Asesora por WhatsApp</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="max-w-[82%] rounded-2xl rounded-tl-md border border-white/10 bg-[#111827] p-3 text-sm text-slate-100">
                        ¡Hola! ¿Qué estás buscando hoy para tu piel?
                      </div>
                      <div className="ml-auto max-w-[78%] rounded-2xl rounded-tr-md bg-purple-500 p-3 text-sm font-medium text-white">
                        Tienes Arencia?
                      </div>
                      <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-white/10 bg-[#111827] p-3 text-sm text-slate-100">
                        Sí, encontré Rice Mochi Cleanser de Arencia disponible. Puedo mostrarte precio,
                        stock y agregarlo al pedido.
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Metric label="Productos" value="15" />
                    <Metric label="Tasa BCV" value="Activa" />
                    <Metric label="Delivery" value="USD/km" />
                    <Metric label="Demo" value="Sin login" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#080A10] px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-purple-300">
              Plataforma completa
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Un ERP con IA comercial, catálogo, delivery y operación en tiempo real.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <article
                  key={module.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/15"
                >
                  <span className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-purple-400/15 text-purple-100">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-semibold text-white">{module.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{module.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
