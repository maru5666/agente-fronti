'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  Boxes,
  CheckCircle2,
  ImageIcon,
  PackagePlus,
  PackageSearch,
  RefreshCcw,
  Search,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { EmptyState, Input, LoadingState, Panel } from '@/components/ui';
import { CatalogErrorBoundary } from '@/components/catalog-error-boundary';
import { useCompany } from '@/hooks/use-company';
import { useResource } from '@/hooks/use-resource';
import { formatProductPrice } from '@/lib/product-pricing';
import { bcvApi, productsApi } from '@/services/api';
import type { Brand, Company, Product, Promotion } from '@/types';

type CatalogFilter =
  | 'all'
  | 'featured'
  | 'new'
  | 'available'
  | 'promo'
  | 'low_stock'
  | 'out_of_stock';

const filters: Array<{ value: CatalogFilter; label: string; icon: typeof Store }> = [
  { value: 'all', label: 'Todos', icon: Store },
  { value: 'featured', label: 'Destacados', icon: Sparkles },
  { value: 'new', label: 'Nuevos', icon: PackagePlus },
  { value: 'available', label: 'Disponibles', icon: CheckCircle2 },
  { value: 'promo', label: 'Promoción', icon: BadgePercent },
  { value: 'low_stock', label: 'Stock bajo', icon: AlertCircle },
  { value: 'out_of_stock', label: 'Agotados', icon: XCircle },
];

const sampleProducts = [
  { name: 'Arroz premium', brand: 'Casa Norte', category: 'Alimentos', price: '$4.20' },
  { name: 'Protector solar', brand: 'Dermalab', category: 'Skincare', price: '$12.00' },
  { name: 'Taladro inalámbrico', brand: 'Andes Pro', category: 'Ferretería', price: '$48.00' },
];

const suggestedCategories = ['Alimentos', 'Farmacia', 'Skincare', 'Ferretería', 'Limpieza', 'Mascotas'];

export default function CatalogoPage() {
  const { company, companyId } = useCompany();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CatalogFilter>('all');
  const [brand, setBrand] = useState('all');
  const [selected, setSelected] = useState<Product | null>(null);
  const {
    data: products,
    loading,
    error,
    reload,
  } = useResource(
    () => (companyId ? productsApi.list(companyId) : Promise.resolve([])),
    [companyId],
  );
  const { data: bcvRate } = useResource(() => bcvApi.latest(), []);

  const allProducts = useMemo(() => products ?? [], [products]);
  const brandOptions = useMemo(() => {
    const map = new Map<string, Brand>();
    allProducts.forEach((product) => {
      if (product.brand?.name) map.set(product.brand.name, product.brand);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allProducts]);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return allProducts.filter((product) => {
      const stock = getStockState(product);
      const promotion = getActivePromotion(product);
      const productName = getProductName(product).toLowerCase();
      const brandName = getBrandName(product).toLowerCase();
      const category = getCategoryLabel(product).toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        productName.includes(normalizedQuery) ||
        brandName.includes(normalizedQuery) ||
        category.includes(normalizedQuery);
      const matchesBrand = brand === 'all' || product.brand?.name === brand;
      const matchesFilter =
        filter === 'all' ||
        (filter === 'featured' && isFeatured(product)) ||
        (filter === 'new' && isNewProduct(product)) ||
        (filter === 'available' && stock === 'available') ||
        (filter === 'low_stock' && stock === 'low_stock') ||
        (filter === 'out_of_stock' && stock === 'out_of_stock') ||
        (filter === 'promo' && Boolean(promotion));

      return matchesQuery && matchesBrand && matchesFilter;
    });
  }, [allProducts, brand, filter, query]);

  const featuredProducts = useMemo(
    () => allProducts.filter((product) => isFeatured(product)).slice(0, 6),
    [allProducts],
  );
  const newProducts = useMemo(
    () =>
      [...allProducts]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6),
    [allProducts],
  );
  const promoProducts = useMemo(
    () => allProducts.filter((product) => getActivePromotion(product)).slice(0, 6),
    [allProducts],
  );

  return (
    <>
      <PageHeader
        title="Catálogo"
        description="Una vitrina comercial para vender, recomendar y atender clientes desde Fronti."
      />

      <CatalogHero company={company} productCount={allProducts.length} />

      {error ? <CatalogConnectionAlert onRetry={reload} /> : null}

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        <CatalogMetric icon={Boxes} label="Productos visibles" value={visibleProducts.length} />
        <CatalogMetric
          icon={CheckCircle2}
          label="Disponibles"
          value={allProducts.filter((product) => getStockState(product) === 'available').length}
          tone="success"
        />
        <CatalogMetric
          icon={BadgePercent}
          label="Con promoción"
          value={allProducts.filter((product) => getActivePromotion(product)).length}
          tone="brand"
        />
      </section>

      <div className="mt-5">
        <Panel title="Vitrina de productos" description="Busca por nombre, marca o categoría. Filtra por disponibilidad, promociones y novedades.">
          <CatalogToolbar
            query={query}
            onQueryChange={setQuery}
            filter={filter}
            onFilterChange={setFilter}
            brands={brandOptions}
            selectedBrand={brand}
            onBrandChange={setBrand}
          />

          {loading ? (
            <LoadingState label="Actualizando catálogo" />
          ) : allProducts.length === 0 ? (
            <CatalogWelcome company={company} />
          ) : visibleProducts.length ? (
            <div className="mt-5 grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {visibleProducts.map((product) => (
                <CatalogErrorBoundary key={product.id}>
                  <CatalogCard
                    product={product}
                    bcvRate={bcvRate?.usdRate ?? null}
                    companyColor={company?.primaryColor}
                    onSelect={setSelected}
                  />
                </CatalogErrorBoundary>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No encontramos productos con esos filtros"
              description="Prueba otra marca, categoría o estado de disponibilidad."
            />
          )}
        </Panel>
      </div>

      {allProducts.length ? (
        <div className="mt-5 grid gap-5">
          <CatalogStrip title="Productos destacados" products={featuredProducts} bcvRate={bcvRate?.usdRate ?? null} onSelect={setSelected} />
          <CatalogStrip title="Nuevos productos" products={newProducts} bcvRate={bcvRate?.usdRate ?? null} onSelect={setSelected} />
          <CatalogStrip title="Promociones activas" products={promoProducts} bcvRate={bcvRate?.usdRate ?? null} onSelect={setSelected} />
        </div>
      ) : null}

      <CatalogDetails
        product={selected}
        products={allProducts}
        bcvRate={bcvRate?.usdRate ?? null}
        companyColor={company?.primaryColor}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function CatalogHero({ company, productCount }: { company: Company | null; productCount: number }) {
  const name = company?.commercialName || company?.name || 'Tu negocio';
  const color = company?.primaryColor || '#C9A227';

  return (
    <section className="relative isolate overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#1E1E1E] shadow-[0_18px_60px_rgba(0,0,0,0.32)]">
      <div className="absolute inset-0 z-0 opacity-80">
        {company?.catalogBanner ? (
          <img src={company.catalogBanner} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `radial-gradient(circle at 20% 20%, ${color}44, transparent 34%), linear-gradient(135deg, #111827, #1E1E1E 62%, #0F172A)`,
            }}
          />
        )}
      </div>
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-black/78 via-black/45 to-black/15" />
      <div className="relative z-10 grid gap-8 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-2xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl">
              {company?.logo ? (
                <img src={company.logo} alt={name} className="h-full w-full object-cover" />
              ) : (
                <Store className="h-7 w-7" style={{ color }} />
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Vitrina oficial</p>
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">{name}</h1>
            </div>
          </div>
          <p className="max-w-xl text-sm leading-6 text-white/72">
            Catálogo visual con marcas, precios, disponibilidad y promociones listo para ventas por WhatsApp Business.
          </p>
        </div>
        <div className="grid gap-2 rounded-[24px] border border-white/12 bg-black/28 p-4 backdrop-blur-xl">
          <p className="text-xs text-white/58">Productos publicados</p>
          <p className="text-3xl font-semibold text-white">{productCount}</p>
          <Link href="/productos" className="mt-2 inline-flex items-center gap-2 text-sm font-medium" style={{ color }}>
            Administrar productos
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function CatalogToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  brands,
  selectedBrand,
  onBrandChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  filter: CatalogFilter;
  onFilterChange: (value: CatalogFilter) => void;
  brands: Brand[];
  selectedBrand: string;
  onBrandChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar por nombre, marca o categoría"
          className="h-12 rounded-2xl pl-10"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                filter === option.value
                  ? 'border-brand/40 bg-brand/15 text-brand'
                  : 'border-white/[0.08] bg-white/[0.045] text-slate-300 hover:bg-white/[0.08] hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </button>
          );
        })}
      </div>

      {brands.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <BrandFilter selected={selectedBrand === 'all'} label="Todas las marcas" onClick={() => onBrandChange('all')} />
          {brands.map((brand) => (
            <BrandFilter
              key={brand.id}
              brand={brand}
              selected={selectedBrand === brand.name}
              label={brand.name}
              onClick={() => onBrandChange(brand.name)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BrandFilter({
  brand,
  selected,
  label,
  onClick,
}: {
  brand?: Brand;
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
        selected
          ? 'border-blue/40 bg-blue/15 text-blue'
          : 'border-white/[0.08] bg-white/[0.045] text-slate-300 hover:bg-white/[0.08] hover:text-ink'
      }`}
    >
      {brand ? <BrandLogo brand={brand} /> : <Tag className="h-4 w-4" />}
      {label}
    </button>
  );
}

function CatalogConnectionAlert({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-[20px] border border-brand/20 bg-brand/10 p-4 text-sm text-brand sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <RefreshCcw className="h-4 w-4 animate-spin" />
        <span>Actualizando catálogo. Reintentando conexión…</span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand/25 bg-brand/10 px-3 py-2 text-sm font-medium transition hover:bg-brand/15"
      >
        <RefreshCcw className="h-4 w-4" />
        Reintentar
      </button>
    </div>
  );
}

function CatalogWelcome({ company }: { company: Company | null }) {
  const name = company?.commercialName || company?.name || 'tu empresa';

  return (
    <div className="mt-5 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#111827]">
      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.1fr] lg:p-7">
        <div className="flex flex-col justify-center">
          <div className="mb-4 grid h-16 w-16 place-items-center overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.05]">
            {company?.logo ? (
              <img src={company.logo} alt={name} className="h-full w-full object-cover" />
            ) : (
              <Store className="h-8 w-8 text-brand" />
            )}
          </div>
          <p className="text-sm text-muted">{name}</p>
          <h2 className="mt-2 text-3xl font-semibold text-ink">Construye tu vitrina profesional</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
            Agrega productos con fotos, marcas, precios y stock para que Fronti pueda vender y recomendar con datos reales.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/productos"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-canvas shadow-lg shadow-white/10 transition hover:bg-white"
            >
              <PackagePlus className="h-4 w-4" />
              Agregar primer producto
            </Link>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white/[0.045] px-4 text-sm font-medium text-ink transition hover:bg-white/[0.085]"
            >
              <Upload className="h-4 w-4" />
              Importar catálogo
            </button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {suggestedCategories.map((category) => (
              <span key={category} className="rounded-full border border-white/[0.08] bg-white/[0.045] px-3 py-1.5 text-xs text-slate-300">
                {category}
              </span>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {sampleProducts.map((product) => (
            <div key={product.name} className="overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#1E1E1E] shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
              <div className="grid aspect-[4/5] place-items-center bg-[radial-gradient(circle_at_top,rgba(201,162,39,0.18),transparent_36%),linear-gradient(135deg,#1E1E1E,#0F172A)]">
                <ImageIcon className="h-9 w-9 text-brand" />
              </div>
              <div className="p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-brand">{product.brand}</p>
                <p className="mt-1 text-sm font-semibold text-ink">{product.name}</p>
                <p className="mt-1 text-xs text-muted">{product.category}</p>
                <p className="mt-3 text-lg font-semibold text-ink">{product.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CatalogCard({
  product,
  bcvRate,
  companyColor,
  onSelect,
}: {
  product: Product;
  bcvRate: number | null;
  companyColor?: string | null;
  onSelect: (product: Product) => void;
}) {
  const image = getProductGallery(product)[0];
  const stock = getStockState(product);
  const promotion = getActivePromotion(product);
  const price = formatProductPrice(product, bcvRate);
  const color = companyColor || '#C9A227';
  const productName = getProductName(product);
  const brandName = getBrandName(product);
  const category = getCategoryLabel(product);
  const description = getProductDescription(product);

  return (
    <motion.button
      type="button"
      whileHover={{ y: -6 }}
      transition={{ duration: 0.18 }}
      onClick={() => onSelect(product)}
      className="group flex h-full min-h-[470px] flex-col overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#1E1E1E] text-left shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
    >
      <div className="relative grid h-56 shrink-0 place-items-center overflow-hidden bg-white/[0.04] p-4">
        {image ? (
          <img
            src={image}
            alt={productName}
            className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center rounded-2xl"
            style={{
              background: `radial-gradient(circle at top, ${color}33, transparent 38%), linear-gradient(145deg,#111827,#1E1E1E)`,
            }}
          >
            <ImageIcon className="h-10 w-10" style={{ color }} />
          </div>
        )}
        {promotion ? (
          <span className="absolute left-3 top-3 rounded-full border border-brand/30 bg-brand/90 px-3 py-1 text-xs font-semibold text-[#1E1E1E]">
            {promotion.title}
          </span>
        ) : null}
        <span className={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-xl ${getStockClass(stock)}`}>
          {getStockLabel(stock)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            {product.brand ? <BrandLogo brand={product.brand} /> : null}
            <p className="text-xs uppercase tracking-[0.16em]" style={{ color }}>
              {brandName}
            </p>
          </div>
          <h3 className="mt-1 line-clamp-2 min-h-[44px] text-base font-semibold leading-5 text-ink">
            {productName}
          </h3>
          <p className="mt-1 text-xs text-muted">{category}</p>
          <p className="mt-3 line-clamp-2 min-h-[40px] text-sm leading-5 text-slate-300">
            {description}
          </p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-white/[0.06] pt-4">
          <div>
            <p className="text-lg font-semibold text-ink">{price.formattedUsd}</p>
            <p className="text-xs text-muted">Bs: {price.formattedBs}</p>
          </div>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.045] px-3 py-1 text-xs text-slate-300">
            {getSafeStock(product)} disp.
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function CatalogStrip({
  title,
  products,
  bcvRate,
  onSelect,
}: {
  title: string;
  products: Product[];
  bcvRate: number | null;
  onSelect: (product: Product) => void;
}) {
  if (!products.length) return null;

  return (
    <section className="rounded-[24px] border border-white/[0.06] bg-[#1E1E1E] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {products.map((product) => (
          <CatalogStripItem key={product.id} product={product} bcvRate={bcvRate} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function CatalogStripItem({
  product,
  bcvRate,
  onSelect,
}: {
  product: Product;
  bcvRate: number | null;
  onSelect: (product: Product) => void;
}) {
  const image = getProductGallery(product)[0];
  const price = formatProductPrice(product, bcvRate);
  const productName = getProductName(product);

  return (
    <CatalogErrorBoundary fallbackTitle="Producto no disponible en la tira">
      <button
        type="button"
        onClick={() => onSelect(product)}
        className="grid min-h-28 w-full grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-2 text-left transition hover:bg-white/[0.06]"
      >
        <div className="grid h-full place-items-center overflow-hidden rounded-xl bg-white/[0.04] p-2">
          {image ? (
            <img src={image} alt={productName} className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-5 w-5 text-brand" />
          )}
        </div>
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-xs text-brand">{getBrandName(product) || getCategoryLabel(product)}</p>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-ink">{productName}</p>
          <p className="mt-auto text-xs text-muted">
            {price.formattedUsd}
            <span className="text-slate-500"> · {price.formattedBs}</span>
          </p>
        </div>
      </button>
    </CatalogErrorBoundary>
  );
}

function CatalogDetails({
  product,
  products,
  bcvRate,
  companyColor,
  onClose,
}: {
  product: Product | null;
  products: Product[];
  bcvRate: number | null;
  companyColor?: string | null;
  onClose: () => void;
}) {
  const gallery = product ? getProductGallery(product) : [];
  const price = product ? formatProductPrice(product, bcvRate) : null;
  const related = product
    ? products
        .filter((item) => item.id !== product.id)
        .filter(
          (item) =>
            (product.brandId && item.brandId === product.brandId) ||
            (product.category && item.category === product.category),
        )
        .slice(0, 4)
    : [];
  const color = companyColor || '#C9A227';

  return (
    <AnimatePresence>
      {product ? (
        <motion.aside initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl">
          <motion.div
            initial={{ x: 480 }}
            animate={{ x: 0 }}
            exit={{ x: 480 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="ml-auto h-full w-full max-w-2xl overflow-y-auto border-l border-white/[0.08] bg-[#111827] p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.045] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </button>
              <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.045] text-muted transition hover:bg-white/[0.08] hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#1E1E1E]">
              <div className="aspect-[4/3] bg-white/[0.04]">
                {gallery[0] ? (
                  <img src={gallery[0]} alt={getProductName(product)} className="h-full w-full object-contain p-4" />
                ) : (
                  <div className="grid h-full place-items-center">
                    <PackageSearch className="h-12 w-12" style={{ color }} />
                  </div>
                )}
              </div>
              {gallery.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto p-3">
                  {gallery.map((image, index) => (
                    <button key={`${image}-${index}`} type="button" onClick={() => window.open(image, '_blank')} className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04]">
                      <img src={image} alt={`Vista ${index + 1}`} className="h-full w-full object-contain p-1" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-2">
                {product.brand ? <BrandLogo brand={product.brand} /> : null}
                <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color }}>
                  {getBrandName(product)}
                </p>
              </div>
              <h2 className="mt-3 text-3xl font-semibold text-ink">{getProductName(product)}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {getProductDescription(product)}
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <DetailCard label="Precio USD" value={price?.formattedUsd ?? 'Precio no disponible'} />
              <DetailCard label="Precio BCV" value={price?.formattedBs ?? 'BCV no disponible'} />
              <DetailCard label="Stock" value={`${getSafeStock(product)} unidades`} />
            </div>

            <div className="mt-5 rounded-[24px] border border-white/[0.06] bg-white/[0.035] p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue" />
                <h3 className="text-sm font-semibold text-ink">Productos relacionados</h3>
              </div>
              {related.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {related.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/[0.06] bg-[#1E1E1E] p-3">
                      <p className="text-sm font-medium text-ink">{getProductName(item)}</p>
                      <p className="text-xs text-muted">{getBrandName(item) || getCategoryLabel(item)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">Agrega más productos de la misma marca o categoría para sugerencias.</p>
              )}
            </div>
          </motion.div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function CatalogMetric({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: typeof Boxes;
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'brand';
}) {
  const tones = {
    default: 'text-blue bg-blue/10 border-blue/20',
    success: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
    brand: 'text-brand bg-brand/10 border-brand/20',
  };

  return (
    <div className="rounded-[24px] border border-white/[0.06] bg-[#1E1E1E] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
      <div className={`grid h-11 w-11 place-items-center rounded-2xl border ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#1E1E1E] p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function BrandLogo({ brand }: { brand: Brand }) {
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.05]">
      {brand.logo ? (
        <img src={brand.logo} alt={brand.name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[10px] font-semibold text-brand">{brand.name.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}

function getProductGallery(product: Product) {
  const legacyImage = (product as Product & { imageUrl?: string | null }).imageUrl;
  return [product.mainImage, product.coverImage, legacyImage, ...(product.galleryImages ?? [])].filter(
    (image): image is string => typeof image === 'string' && image.trim().length > 0,
  );
}

function getActivePromotion(product: Product): Promotion | undefined {
  const now = new Date();
  return product.promotions?.find((promotion) => {
    const starts = new Date(promotion.startDate);
    const ends = new Date(promotion.endDate);
    return promotion.isActive && starts <= now && ends >= now;
  });
}

function getStockState(product: Product) {
  const stock = getSafeStock(product);
  const minStock = Number.isFinite(product.minStock) ? product.minStock : 0;
  if (!product.isActive) return 'inactive';
  if (stock <= 0) return 'out_of_stock';
  if (stock <= minStock) return 'low_stock';
  return 'available';
}

function getStockLabel(state: ReturnType<typeof getStockState>) {
  if (state === 'inactive') return 'Inactivo';
  if (state === 'out_of_stock') return 'Agotado';
  if (state === 'low_stock') return 'Stock bajo';
  return 'Disponible';
}

function getStockClass(state: ReturnType<typeof getStockState>) {
  if (state === 'inactive') return 'border-slate-300/20 bg-black/45 text-slate-200';
  if (state === 'out_of_stock') return 'border-red-400/30 bg-red-500/20 text-red-100';
  if (state === 'low_stock') return 'border-yellow-300/30 bg-yellow-300/20 text-yellow-50';
  return 'border-green-400/30 bg-green-500/20 text-green-50';
}

function isNewProduct(product: Product) {
  const createdAt = new Date(product.createdAt).getTime();
  return Date.now() - createdAt <= 1000 * 60 * 60 * 24 * 30;
}

function isFeatured(product: Product) {
  const stock = getSafeStock(product);
  const minStock = Number.isFinite(product.minStock) ? product.minStock : 0;
  return product.isActive && (Boolean(getActivePromotion(product)) || stock > minStock);
}

function getProductName(product: Product) {
  return cleanText(product.name) || 'Producto sin nombre';
}

function getBrandName(product: Product) {
  return cleanText(product.brand?.name) || 'Sin marca';
}

function getCategoryLabel(product: Product) {
  return cleanText(product.category) || 'Catálogo general';
}

function getProductDescription(product: Product) {
  return (
    cleanText(product.description) ||
    'Producto disponible para venta y recomendaciones de Fronti.'
  );
}

function getSafeStock(product: Product) {
  return Number.isFinite(product.stock) ? Math.max(0, product.stock) : 0;
}

function cleanText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}
