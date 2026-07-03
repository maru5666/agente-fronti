'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
} from 'lucide-react';
import { BeautyProductCard } from '@/components/demo/beauty-product-card';
import { useBeautyHubDemo } from '@/hooks/use-beauty-hub-demo';

const quickQueries = ['piel grasa', 'manchas', 'acné', 'hidratación', 'protector solar'];

export default function BeautyHubDemoPage() {
  const {
    company,
    products,
    promotions,
    deliveryZones,
    categories,
    brands,
    bcvRate,
    isLoading,
    error,
    reload,
  } = useBeautyHubDemo();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalize(query);

    return products.filter((product) => {
      const matchesCategory = activeCategory === 'Todos' || product.category === activeCategory;
      const haystack = normalize(
        [
          product.name,
          product.brand?.name,
          product.category,
          product.description,
        ]
          .filter(Boolean)
          .join(' '),
      );

      return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [activeCategory, products, query]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#070B14] text-white">
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.22),transparent_36%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.14),transparent_32%)]" />
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-12">
          <div className="flex min-h-[560px] flex-col justify-between rounded-[36px] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/35 bg-purple-500/10 px-3 py-1 text-sm font-medium text-[#F8F5F0]">
                <Store className="h-4 w-4 text-purple-300" />
                Demo pública sin login
              </div>
              <h1 className="mt-8 max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                Beauty Hub con Frontti AI
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Prueba una tienda funcional: catálogo real, recomendaciones de skincare,
                pedidos de demostración, delivery y conversación tipo WhatsApp.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/demo/frontti-ai"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#8B5CF6] px-5 text-sm font-bold text-white transition hover:bg-[#7C3AED]"
                >
                  Probar Frontti AI
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#catalogo"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.09]"
                >
                  Ver catálogo
                </a>
              </div>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <Metric label="Productos" value={products.length || '...'} />
              <Metric label="Marcas" value={brands.length || '...'} />
              <Metric label="Zonas delivery" value={deliveryZones.length || '...'} />
            </div>
          </div>

          <div className="grid content-start gap-4">
            <div className="rounded-[32px] border border-white/10 bg-[#111827]/90 p-6 shadow-2xl shadow-black/25">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-purple-300">
                    Empresa demo
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold">{company?.commercialName || company?.name || 'Beauty Hub'}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {company?.address || 'Catálogo dermocosmético para demostración comercial.'}
                  </p>
                </div>
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#8B5CF6] text-white">
                  <Sparkles className="h-7 w-7" />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Inventario real"
                text="Frontti consulta productos, marcas, stock y promociones antes de responder."
              />
              <InfoCard
                icon={<MapPin className="h-5 w-5" />}
                title="Delivery conectado"
                text="La ubicación se envía con coordenadas reales y se procesa en el backend."
              />
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5">
              <p className="text-sm font-semibold text-white">Prueba estas consultas</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {quickQueries.map((item) => (
                  <Link
                    key={item}
                    href={`/demo/frontti-ai?mensaje=${encodeURIComponent(item)}`}
                    className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-sm text-slate-200 transition hover:border-purple-400/50 hover:text-white"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="catalogo" className="mx-auto w-full max-w-7xl px-5 pb-14 sm:px-8 lg:px-10">
        <div className="mb-5 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-[#111827]/80 p-4 shadow-xl shadow-black/20 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Catálogo Beauty Hub</h2>
            <p className="mt-1 text-sm text-slate-400">
              {bcvRate?.formattedRate
                ? `Precios en bolívares calculados con BCV: ${bcvRate.formattedRate}`
                : 'Precios en USD disponibles. BCV no disponible por ahora.'}
            </p>
          </div>
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por producto, marca o categoría"
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.055] pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-purple-400/60"
            />
          </div>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {['Todos', ...categories].map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                activeCategory === category
                  ? 'border-purple-400 bg-[#8B5CF6] text-white'
                  : 'border-white/10 bg-white/[0.045] text-slate-300 hover:bg-white/[0.08]'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {error ? (
          <div className="rounded-[28px] border border-purple-300/20 bg-purple-500/10 p-5 text-purple-50">
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#8B5CF6] px-4 py-2 text-sm font-bold text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-[520px] animate-pulse rounded-[28px] border border-white/10 bg-white/[0.045]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {filteredProducts.map((product) => (
              <BeautyProductCard
                key={product.id}
                product={product}
                promotions={promotions}
                exchangeRate={bcvRate?.usdRate}
              />
            ))}
          </div>
        )}

        {!isLoading && !filteredProducts.length ? (
          <div className="rounded-[28px] border border-dashed border-white/15 bg-white/[0.035] p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-purple-300" />
            <h3 className="mt-4 text-lg font-semibold text-white">No encontramos productos con ese filtro</h3>
            <p className="mt-2 text-sm text-slate-400">Prueba con una marca, una categoría o una necesidad como manchas, acné o hidratación.</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-2xl bg-purple-500/15 text-purple-300">
        {icon}
      </div>
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}
