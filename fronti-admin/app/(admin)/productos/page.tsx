'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Boxes,
  Building2,
  ChevronDown,
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  History,
  ImageIcon,
  MoreHorizontal,
  Package,
  Redo2,
  RefreshCcw,
  Rocket,
  Save,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Undo2,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '@/components/page-header';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Panel,
} from '@/components/ui';
import { useCompany } from '@/hooks/use-company';
import { useResource } from '@/hooks/use-resource';
import { convertUsdToBs, formatBs, formatUsd } from '@/lib/exchange-rate';
import { brandSchema, productSchema } from '@/lib/validations';
import { bcvApi, brandsApi, getApiError, productsApi } from '@/services/api';
import type { Brand, Product, Promotion } from '@/types';

type ProductForm = z.infer<typeof productSchema>;
type BrandForm = z.infer<typeof brandSchema>;
type ProductFilter = 'all' | 'active' | 'low_stock' | 'out_of_stock';
type ProductSection = 'products' | 'brands' | 'categories';

const filters: Array<{ value: ProductFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'low_stock', label: 'Stock bajo' },
  { value: 'out_of_stock', label: 'Agotados' },
];
const CATALOG_BATCH_SIZE = 40;

export default function ProductosPage() {
  const { companyId } = useCompany();
  const [error, setError] = useState('');
  const [imageNotice, setImageNotice] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [activeSection, setActiveSection] = useState<ProductSection>('products');
  const [showCatalogDrawer, setShowCatalogDrawer] = useState(false);
  const [showAssistantDrawer, setShowAssistantDrawer] = useState(false);
  const { data: products, loading, error: loadError, reload } = useResource(
    () => (companyId ? productsApi.list(companyId) : Promise.resolve([])),
    [companyId],
  );
  const { data: brands, reload: reloadBrands } = useResource(
    () => (companyId ? brandsApi.list(companyId) : Promise.resolve([])),
    [companyId],
  );
  const {
    data: bcvRate,
    loading: bcvLoading,
    error: bcvError,
    reload: reloadBcv,
  } = useResource(() => bcvApi.latest(), []);
  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      stock: 0,
      minStock: 0,
      priceUsd: 0,
      currencyBase: 'USD',
      galleryImagesText: '',
      productStatus: 'available',
    },
  });
  const brandForm = useForm<BrandForm>({
    resolver: zodResolver(brandSchema),
    defaultValues: { name: '', logo: '', description: '' },
  });
  const galleryPreview = splitGalleryImages(form.watch('galleryImagesText'));
  const calculatedPriceBs = convertUsdToBs(
    Number(form.watch('priceUsd') || 0),
    bcvRate?.usdRate,
  );

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return (products ?? []).filter((product) => {
      const stockState = getStockState(product);
      const sku = getSku(product);
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        (product.brand?.name ?? '').toLowerCase().includes(normalizedQuery) ||
        (product.category ?? '').toLowerCase().includes(normalizedQuery) ||
        sku.toLowerCase().includes(normalizedQuery);

      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && product.isActive) ||
        (filter === 'low_stock' && stockState === 'low_stock') ||
        (filter === 'out_of_stock' && stockState === 'out_of_stock');

      return matchesQuery && matchesFilter;
    });
  }, [filter, products, query]);

  const productCategories = useMemo(() => {
    return Array.from(
      new Set((products ?? []).map((product) => product.category).filter((category): category is string => Boolean(category))),
    ).sort((a, b) => a.localeCompare(b));
  }, [products]);

  async function submit(values: ProductForm) {
    if (!companyId) {
      setError('No pudimos identificar la empresa. Cierra sesión e inicia nuevamente.');
      console.error('[Productos] Falló frontend: no hay companyId en sesión.');
      return;
    }
    setError('');
    const payload = buildProductPayload(values);
    const requestPayload = editing ? payload : { ...payload, companyId };
    console.log('[Productos] Enviando producto:', {
      endpoint: editing ? `PATCH /products/${editing.id}` : 'POST /products',
      companyId,
      payload: requestPayload,
    });

    try {
      let savedProduct: Product;
      if (editing) {
        savedProduct = await productsApi.update(editing.id, payload);
      } else {
        savedProduct = await productsApi.create(requestPayload);
      }
      console.log('[Productos] Producto guardado:', savedProduct);
      setEditing(null);
      form.reset({ stock: 0, minStock: 0, priceUsd: 0, currencyBase: 'USD', galleryImagesText: '', productStatus: 'available' });
      reload();
    } catch (err) {
      console.error('[Productos] Error al guardar producto:', {
        etapa: 'API o base de datos',
        endpoint: editing ? `PATCH /products/${editing.id}` : 'POST /products',
        companyId,
        payload: requestPayload,
        error: err,
      });
      setError(`No pudimos guardar el producto. ${getApiError(err)}`);
    }
  }

  async function submitBrand(values: BrandForm) {
    if (!companyId) return;
    setError('');
    try {
      if (editingBrand) {
        await brandsApi.update(editingBrand.id, values);
      } else {
        await brandsApi.create({ ...values, companyId });
      }
      setEditingBrand(null);
      brandForm.reset({ name: '', logo: '', description: '' });
      reloadBrands();
      reload();
      setActiveSection('products');
    } catch (err) {
      console.error('[Marcas] Error al guardar marca:', err);
      setError(getApiError(err));
    }
  }

  function startEditBrand(brand: Brand) {
    setEditingBrand(brand);
    brandForm.reset({
      name: brand.name,
      logo: brand.logo ?? '',
      description: brand.description ?? '',
    });
  }

  function cancelEditBrand() {
    setEditingBrand(null);
    brandForm.reset({ name: '', logo: '', description: '' });
  }

  async function deleteBrand(id: string) {
    setError('');
    try {
      await brandsApi.remove(id);
      if (editingBrand?.id === id) {
        cancelEditBrand();
      }
      reloadBrands();
      reload();
    } catch (err) {
      setError(getApiError(err));
    }
  }

  function updateGalleryImages(images: string[]) {
    form.setValue('galleryImagesText', images.join('\n'), { shouldValidate: true });
  }

  function removeGalleryImage(index: number) {
    updateGalleryImages(galleryPreview.filter((_, currentIndex) => currentIndex !== index));
  }

  function moveGalleryImage(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= galleryPreview.length) return;

    const next = [...galleryPreview];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    updateGalleryImages(next);
  }

  function useGalleryImageAsMain(image: string) {
    form.setValue('mainImage', image, { shouldValidate: true });
  }

  function startEdit(product: Product) {
    setEditing(product);
    form.reset({
      name: product.name,
      brandId: product.brandId ?? '',
      description: product.description ?? '',
      category: product.category ?? '',
      mainImage: product.mainImage ?? '',
      coverImage: product.coverImage ?? '',
      galleryImagesText: (product.galleryImages ?? []).join('\n'),
      priceUsd: Number(product.priceUsd),
      currencyBase: 'USD',
      stock: product.stock,
      minStock: product.minStock,
      productStatus: !product.isActive ? 'inactive' : product.stock <= 0 ? 'out_of_stock' : 'available',
    });
  }

  async function duplicateProduct(product: Product) {
    if (!companyId) return;
    setError('');
    try {
      await productsApi.create({
        companyId,
        name: `${product.name} copia`,
        brandId: product.brandId ?? undefined,
        description: product.description ?? '',
        category: product.category ?? '',
        mainImage: product.mainImage ?? undefined,
        coverImage: product.coverImage ?? undefined,
        galleryImages: product.galleryImages ?? [],
        priceUsd: Number(product.priceUsd),
        currencyBase: 'USD',
        stock: product.stock,
        minStock: product.minStock,
      });
      reload();
    } catch (err) {
      setError(getApiError(err));
    }
  }

  async function deactivate(id: string) {
    setError('');
    try {
      await productsApi.remove(id);
      reload();
    } catch (err) {
      setError(getApiError(err));
    }
  }

  return (
    <>
      <PageHeader title="Productos" description="Administra un catalogo visual con marcas, imagenes y disponibilidad." />

      <ProductSectionTabs activeSection={activeSection} onChange={setActiveSection} />

      {activeSection === 'products' ? (
      <div className="mt-5 grid gap-5">
        <ProductEditorToolbar
          formId="fronti-product-form"
          editing={editing}
          submitting={form.formState.isSubmitting}
          onDuplicate={() => {
            if (editing) void duplicateProduct(editing);
          }}
          onDelete={() => {
            if (editing) void deactivate(editing.id);
          }}
          onPreview={() => {
            if (editing) setSelectedProduct(editing);
          }}
          onPublish={() => {
            form.setValue('productStatus', 'available', { shouldValidate: true });
            document.getElementById('fronti-product-form')?.dispatchEvent(
              new Event('submit', { cancelable: true, bubbles: true }),
            );
          }}
          onHistory={() => {
            if (editing) setSelectedProduct(editing);
          }}
          onOpenCatalog={() => setShowCatalogDrawer(true)}
          onOpenAssistant={() => setShowAssistantDrawer(true)}
          onUndo={() => {
            if (editing) {
              startEdit(editing);
              return;
            }
            form.reset({ stock: 0, minStock: 0, priceUsd: 0, currencyBase: 'USD', galleryImagesText: '', productStatus: 'available' });
          }}
        />

      <div className="grid gap-5 2xl:grid-cols-[minmax(360px,40%)_minmax(480px,60%)]">
        <Panel title={editing ? 'Editar producto' : 'Nuevo producto'} description="Crea una ficha visual lista para vender.">
          <form id="fronti-product-form" className="grid gap-3" onSubmit={form.handleSubmit(submit)}>
            {error ? <ErrorState message={error} /> : null}
            {imageNotice ? (
              <div className="rounded-2xl border border-brand/20 bg-brand/10 px-3 py-2 text-sm text-brand">
                {imageNotice}
              </div>
            ) : null}
            {bcvError ? (
              <ErrorState message="Tasa BCV no disponible. Intenta actualizar." />
            ) : null}
            <ProductFormSection title="Informacion general" description="Datos visibles que identifican el producto." defaultOpen>
            <Field label="Nombre" error={form.formState.errors.name?.message}>
              <Input {...form.register('name')} />
            </Field>
            <Field label="Marca" error={form.formState.errors.brandId?.message}>
              <select
                {...form.register('brandId')}
                className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-brand"
              >
                <option value="">Sin marca</option>
                {(brands ?? []).map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setActiveSection('brands')}
                className="mt-1 w-fit rounded-lg border border-brand/20 bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand transition hover:bg-brand/15"
              >
                + Nueva marca
              </button>
            </Field>
            <Field label="Descripción">
              <Input {...form.register('description')} />
            </Field>
            <Field label="Categoría" error={form.formState.errors.category?.message}>
              <Input placeholder="Alimentos, farmacia, limpieza" {...form.register('category')} />
            </Field>
            </ProductFormSection>
            <ProductFormSection title="Multimedia" description="Imagen principal, portada y galeria visual." defaultOpen>
            <ProductMediaManager
              mainImage={form.watch('mainImage')}
              coverImage={form.watch('coverImage')}
              galleryImages={galleryPreview}
              onMainImageChange={(value) => form.setValue('mainImage', value, { shouldValidate: true })}
              onCoverImageChange={(value) => form.setValue('coverImage', value, { shouldValidate: true })}
              onGalleryImagesChange={updateGalleryImages}
              onUseAsMain={useGalleryImageAsMain}
              onUseAsCover={(value) => form.setValue('coverImage', value, { shouldValidate: true })}
              onRemoveGalleryImage={removeGalleryImage}
              onMoveGalleryImage={moveGalleryImage}
              onStatus={setImageNotice}
              onError={setError}
            />
            </ProductFormSection>
            <ProductFormSection title="Precio" description="Conversión automática con la tasa BCV." defaultOpen>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Precio USD">
                <Input type="number" step="0.01" {...form.register('priceUsd')} />
              </Field>
              <Field label="Precio Bs calculado">
                <div className="flex h-10 items-center rounded-xl border border-line bg-white/[0.035] px-3 text-sm font-medium text-brand">
                  {formatBs(calculatedPriceBs)}
                </div>
              </Field>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.035] px-3 py-2 text-xs">
              <span className="text-muted">
                {bcvRate?.formattedRate
                  ? `BCV: Bs. ${bcvRate.formattedRate} por USD`
                  : bcvLoading
                    ? 'Consultando tasa BCV...'
                    : 'Tasa BCV pendiente'}
              </span>
              <button
                type="button"
                onClick={reloadBcv}
                disabled={bcvLoading}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-brand transition hover:bg-brand/10 disabled:opacity-50"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${bcvLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
            </ProductFormSection>
            <ProductFormSection title="Inventario" description="Disponibilidad comercial y mínimos de reposición." defaultOpen>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stock">
                <Input type="number" {...form.register('stock')} />
              </Field>
              <Field label="Stock mínimo">
                <Input type="number" {...form.register('minStock')} />
              </Field>
            </div>
            <Field label="Estado comercial">
              <select
                {...form.register('productStatus')}
                className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-brand"
              >
                <option value="available">Disponible</option>
                <option value="out_of_stock">Agotado</option>
                <option value="inactive">Inactivo</option>
              </select>
            </Field>
            </ProductFormSection>
            <ProductFormSection title="SEO" description="Vista de como se leera el producto en buscadores y catalogo.">
              <ReadonlyPreviewLine label="Titulo sugerido" value={form.watch('name') || 'Nombre del producto'} />
              <ReadonlyPreviewLine label="Descripcion corta" value={form.watch('description') || 'Agrega una descripcion clara para mejorar la conversion.'} />
            </ProductFormSection>
            <ProductFormSection title="Variantes" description="Preparado para tallas, presentaciones o colores.">
              <ReadonlyPreviewLine label="Estado" value="Sin variantes configuradas" />
              <ReadonlyPreviewLine label="Sugerencia" value="Cuando existan variaciones, usa nombres claros como 50 ml, 100 ml o Pack x2." />
            </ProductFormSection>
          </form>
        </Panel>

        <LiveProductPreview
          form={form}
          brands={brands ?? []}
          galleryPreview={galleryPreview}
          bcvRate={bcvRate?.usdRate ?? null}
        />
      </div>
      </div>
      ) : null}

      {activeSection === 'brands' ? (
        <BrandsSection
          brands={brands ?? []}
          brandForm={brandForm}
          editingBrand={editingBrand}
          onSubmit={submitBrand}
          onEdit={startEditBrand}
          onCancelEdit={cancelEditBrand}
          onDelete={deleteBrand}
        />
      ) : null}

      {activeSection === 'categories' ? (
        <CategoriesSection categories={productCategories} />
      ) : null}

      <ProductDetailsPanel
        product={selectedProduct}
        products={products ?? []}
        bcvRate={bcvRate?.usdRate ?? null}
        onClose={() => setSelectedProduct(null)}
      />

      <ProductCatalogDrawer
        open={showCatalogDrawer}
        products={visibleProducts}
        loading={loading}
        loadError={loadError}
        query={query}
        filter={filter}
        bcvRate={bcvRate?.usdRate ?? null}
        onQueryChange={setQuery}
        onFilterChange={setFilter}
        onClose={() => setShowCatalogDrawer(false)}
        onEdit={(product) => {
          startEdit(product);
          setShowCatalogDrawer(false);
        }}
        onDuplicate={duplicateProduct}
        onDelete={deactivate}
        onDetails={setSelectedProduct}
      />

      <ProductAssistantDrawer
        open={showAssistantDrawer}
        form={form}
        brands={brands ?? []}
        products={products ?? []}
        galleryPreview={galleryPreview}
        onClose={() => setShowAssistantDrawer(false)}
      />
    </>
  );
}

function ProductSectionTabs({
  activeSection,
  onChange,
}: {
  activeSection: ProductSection;
  onChange: (section: ProductSection) => void;
}) {
  const items: Array<{ value: ProductSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { value: 'products', label: 'Productos', icon: Package },
    { value: 'brands', label: 'Marcas', icon: Building2 },
    { value: 'categories', label: 'Categorías', icon: Boxes },
  ];

  return (
    <div className="mt-5 flex flex-wrap gap-2 rounded-[24px] border border-white/[0.06] bg-[#1E1E1E] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.16)]">
      {items.map((item) => {
        const Icon = item.icon;
        const active = activeSection === item.value;

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm transition ${
              active
                ? 'border-brand/35 bg-brand/15 text-brand'
                : 'border-transparent text-slate-300 hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-ink'
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function ProductEditorToolbar({
  formId,
  editing,
  submitting,
  onDuplicate,
  onDelete,
  onPreview,
  onPublish,
  onHistory,
  onOpenCatalog,
  onOpenAssistant,
  onUndo,
}: {
  formId: string;
  editing: Product | null;
  submitting: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onPreview: () => void;
  onPublish: () => void;
  onHistory: () => void;
  onOpenCatalog: () => void;
  onOpenAssistant: () => void;
  onUndo: () => void;
}) {
  return (
    <div className="sticky top-4 z-20 rounded-[24px] border border-white/[0.08] bg-[#111827]/90 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-2xl border border-brand/25 bg-brand/10">
            <Sparkles className="h-4 w-4 text-brand" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Editor profesional de producto</p>
            <p className="text-xs text-muted">Los cambios se reflejan en la vista previa al instante.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            form={formId}
            disabled={submitting}
            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-brand px-4 text-sm font-semibold text-[#1E1E1E] transition hover:bg-[#B8901F] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {submitting ? 'Guardando' : 'Guardar'}
          </button>
          <ToolbarButton icon={Rocket} label="Publicar" onClick={onPublish} />
          <ToolbarButton icon={Eye} label="Vista previa" onClick={onPreview} disabled={!editing} />
          <details className="relative">
            <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.045] px-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.085] hover:text-ink">
              <MoreHorizontal className="h-4 w-4" />
              Mas
            </summary>
            <div className="absolute right-0 top-12 z-30 grid min-w-44 gap-1 rounded-2xl border border-white/[0.08] bg-[#111827] p-2 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
              <MenuAction icon={Package} label="Abrir catalogo" onClick={onOpenCatalog} />
              <MenuAction icon={Sparkles} label="Asistente IA" onClick={onOpenAssistant} />
              <MenuAction icon={Undo2} label="Deshacer" onClick={onUndo} />
              <MenuAction icon={Redo2} label="Rehacer" disabled />
              <MenuAction icon={History} label="Historial" onClick={onHistory} disabled={!editing} />
              <MenuAction icon={Copy} label="Duplicar" onClick={onDuplicate} disabled={!editing} />
              <MenuAction icon={Trash2} label="Eliminar" onClick={onDelete} disabled={!editing} danger />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function MenuAction({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 items-center gap-2 rounded-xl px-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${
        danger
          ? 'text-red-200 hover:bg-red-400/10'
          : 'text-slate-200 hover:bg-white/[0.06] hover:text-ink'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.045] px-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.085] hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ProductFormSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-b border-white/[0.06] py-4 last:border-b-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold text-ink">{title}</span>
          {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
        </span>
        <ChevronDown className="h-4 w-4 text-muted transition group-open:rotate-180" />
      </summary>
      <div className="mt-4 grid gap-3">{children}</div>
    </details>
  );
}

function ProductMediaManager({
  mainImage,
  coverImage,
  galleryImages,
  onMainImageChange,
  onCoverImageChange,
  onGalleryImagesChange,
  onUseAsMain,
  onUseAsCover,
  onRemoveGalleryImage,
  onMoveGalleryImage,
  onStatus,
  onError,
}: {
  mainImage?: string;
  coverImage?: string;
  galleryImages: string[];
  onMainImageChange: (value: string) => void;
  onCoverImageChange: (value: string) => void;
  onGalleryImagesChange: (images: string[]) => void;
  onUseAsMain: (value: string) => void;
  onUseAsCover: (value: string) => void;
  onRemoveGalleryImage: (index: number) => void;
  onMoveGalleryImage: (index: number, direction: -1 | 1) => void;
  onStatus: (value: string) => void;
  onError: (value: string) => void;
}) {
  async function handleFiles(files: FileList | null) {
    try {
      onStatus('Estamos optimizando la imagen para guardarla.');
      const optimizedImages = await readImageFiles(files);
      if (!optimizedImages.length) {
        onStatus('');
        return;
      }

      const nextGallery = [...galleryImages, ...optimizedImages];
      onGalleryImagesChange(nextGallery);
      if (!mainImage) onMainImageChange(optimizedImages[0]);
      if (!coverImage) onCoverImageChange(optimizedImages[0]);
      onStatus('Imagen optimizada correctamente.');
    } catch (uploadError) {
      console.error('[Productos] Error al optimizar imagen:', uploadError);
      onStatus('');
      onError(getImageProcessingError(uploadError));
    }
  }

  const featuredImages = [
    { label: 'Imagen principal', value: mainImage, action: onMainImageChange },
    { label: 'Portada', value: coverImage, action: onCoverImageChange },
  ];

  return (
    <div className="grid gap-3">
      <label
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void handleFiles(event.dataTransfer.files);
        }}
        className="group grid min-h-[150px] cursor-pointer place-items-center rounded-[22px] border border-dashed border-brand/35 bg-brand/[0.07] p-5 text-center transition hover:border-brand hover:bg-brand/[0.1]"
      >
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <span className="grid place-items-center gap-2">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-[#1E1E1E] transition group-hover:scale-105">
            <ImageIcon className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold text-ink">Arrastra imagenes o haz clic para subir</span>
          <span className="max-w-[260px] text-xs leading-5 text-muted">
            Fronti optimiza JPG, PNG o WEBP y marca una imagen principal para la vitrina.
          </span>
        </span>
      </label>

      {!mainImage ? (
        <p className="rounded-2xl border border-brand/20 bg-brand/10 px-3 py-2 text-xs text-brand">
          Recomendado: agrega una imagen principal para que la vitrina se vea profesional.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {featuredImages.map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-[#1E1E1E] p-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-white/[0.04]">
              {item.value ? (
                <img src={item.value} alt={item.label} className="h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-xs text-muted">{item.label}</div>
              )}
              <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
                {item.label}
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={item.value ?? ''}
                onChange={(event) => item.action(event.target.value)}
                placeholder="URL de imagen"
                className="min-w-0 flex-1 rounded-xl border border-line bg-white/[0.045] px-3 py-2 text-xs text-ink outline-none transition placeholder:text-slate-500 focus:border-brand"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.035] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Galeria</p>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.045] px-2 py-1 text-[11px] text-muted">
            {galleryImages.length} imagenes
          </span>
        </div>

        {galleryImages.length ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {galleryImages.map((image, index) => (
              <div key={`${image}-${index}`} className="group overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111827]">
                <div className="relative aspect-square">
                  <img src={image} alt={`Imagen ${index + 1}`} className="h-full w-full object-cover" />
                  {image === mainImage ? (
                    <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-1 text-[10px] font-semibold text-[#1E1E1E]">
                      Principal
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-1.5 p-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button type="button" onClick={() => onUseAsMain(image)} className="rounded-lg border border-brand/20 bg-brand/10 px-2 py-1 text-[11px] text-brand">
                      Principal
                    </button>
                    <button type="button" onClick={() => onUseAsCover(image)} className="rounded-lg border border-white/[0.08] bg-white/[0.045] px-2 py-1 text-[11px] text-slate-200">
                      Portada
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button type="button" onClick={() => onMoveGalleryImage(index, -1)} className="rounded-lg border border-white/[0.08] bg-white/[0.045] px-2 py-1 text-[11px] text-slate-200">
                      Subir
                    </button>
                    <button type="button" onClick={() => onMoveGalleryImage(index, 1)} className="rounded-lg border border-white/[0.08] bg-white/[0.045] px-2 py-1 text-[11px] text-slate-200">
                      Bajar
                    </button>
                    <button type="button" onClick={() => onRemoveGalleryImage(index)} className="rounded-lg border border-red-400/20 bg-red-400/10 px-2 py-1 text-[11px] text-red-200">
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-2xl border border-white/[0.06] bg-[#111827] p-3 text-sm text-muted">
            Aun no hay imagenes en la galeria.
          </p>
        )}

        <details className="mt-3 rounded-2xl border border-white/[0.06] bg-[#111827] p-3">
          <summary className="cursor-pointer list-none text-xs font-medium text-slate-300">Pegar URLs de galeria</summary>
          <textarea
            value={galleryImages.join('\n')}
            onChange={(event) => onGalleryImagesChange(splitGalleryImages(event.target.value))}
            rows={4}
            placeholder="Una URL por linea"
            className="mt-3 min-h-24 w-full rounded-xl border border-line bg-white/[0.045] px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-500 focus:border-brand"
          />
        </details>
      </div>
    </div>
  );
}

function ReadonlyPreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111827] px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
  );
}

function LiveProductPreview({
  form,
  brands,
  galleryPreview,
  bcvRate,
}: {
  form: UseFormReturn<ProductForm>;
  brands: Brand[];
  galleryPreview: string[];
  bcvRate: number | null;
}) {
  const [previewTab, setPreviewTab] = useState<'catalog' | 'web' | 'whatsapp' | 'mobile'>('catalog');
  const values = form.watch();
  const brand = brands.find((item) => item.id === values.brandId);
  const image = values.mainImage || values.coverImage || galleryPreview[0];
  const priceUsd = Number(values.priceUsd || 0);
  const priceBs = convertUsdToBs(priceUsd, bcvRate);
  const stock = Number(values.stock || 0);
  const minStock = Number(values.minStock || 0);
  const status = values.productStatus === 'inactive'
    ? 'Inactivo'
    : values.productStatus === 'out_of_stock' || stock <= 0
      ? 'Agotado'
      : stock <= minStock
        ? 'Stock bajo'
        : 'Disponible';
  const previewTabs = [
    { value: 'catalog', label: 'Catalogo' },
    { value: 'web', label: 'Tienda web' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'mobile', label: 'Movil' },
  ] as const;

  return (
    <section className="sticky top-24 self-start rounded-[24px] border border-white/[0.08] bg-[#111827] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-brand">Vista previa</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">Producto en canales de venta</h2>
        </div>
        <div className="flex flex-wrap gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-1">
          {previewTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setPreviewTab(tab.value)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                previewTab === tab.value
                  ? 'bg-brand text-[#1E1E1E]'
                  : 'text-slate-300 hover:bg-white/[0.06] hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div layout className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#1E1E1E]">
        {previewTab === 'catalog' ? (
          <ProductCatalogPreview
            name={values.name}
            description={values.description}
            category={values.category}
            brandName={brand?.name}
            image={image}
            priceUsd={priceUsd}
            priceBs={priceBs}
            stock={stock}
            status={status}
          />
        ) : null}

        {previewTab === 'web' ? (
          <ProductWebPreview
            name={values.name}
            description={values.description}
            brandName={brand?.name}
            image={image}
            priceUsd={priceUsd}
            priceBs={priceBs}
            status={status}
          />
        ) : null}

        {previewTab === 'whatsapp' ? (
          <ProductWhatsAppPreview
            name={values.name}
            brandName={brand?.name}
            priceUsd={priceUsd}
            stock={stock}
            status={status}
          />
        ) : null}

        {previewTab === 'mobile' ? (
          <ProductMobilePreview
            name={values.name}
            brandName={brand?.name}
            image={image}
            priceUsd={priceUsd}
            status={status}
          />
        ) : null}
      </motion.div>

    </section>
  );
}

function ProductCatalogPreview({
  name,
  description,
  category,
  brandName,
  image,
  priceUsd,
  priceBs,
  stock,
  status,
}: {
  name?: string;
  description?: string;
  category?: string;
  brandName?: string;
  image?: string;
  priceUsd: number;
  priceBs: number | null;
  stock: number;
  status: string;
}) {
  return (
    <article className="grid gap-0 lg:grid-cols-[46%_1fr]">
      <PreviewImage image={image} name={name} className="aspect-[4/5] lg:aspect-auto" />
      <div className="grid content-between gap-5 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">{category || 'Categoria'}</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{name || 'Nombre del producto'}</h3>
          <p className="mt-2 text-sm text-muted">{brandName || 'Marca pendiente'}</p>
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-300">
            {description || 'Descripcion breve y comercial para ayudar al cliente a decidir.'}
          </p>
        </div>
        <div className="grid gap-4">
          <div>
            <p className="text-3xl font-semibold text-ink">{formatUsd(priceUsd)}</p>
            <p className="mt-1 text-sm font-medium text-brand">{formatBs(priceBs)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.045] px-3 py-1 text-xs text-slate-200">{status}</span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.045] px-3 py-1 text-xs text-slate-200">{stock} unidades</span>
          </div>
          <button type="button" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-semibold text-[#1E1E1E] transition hover:bg-[#B8901F]">
            <ShoppingBag className="h-4 w-4" />
            Comprar ahora
          </button>
        </div>
      </div>
    </article>
  );
}

function ProductWebPreview({
  name,
  description,
  brandName,
  image,
  priceUsd,
  priceBs,
  status,
}: {
  name?: string;
  description?: string;
  brandName?: string;
  image?: string;
  priceUsd: number;
  priceBs: number | null;
  status: string;
}) {
  return (
    <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1fr]">
      <PreviewImage image={image} name={name} className="aspect-square rounded-[20px]" />
      <div className="grid content-center gap-4">
        <p className="text-sm font-medium text-brand">{brandName || 'Marca pendiente'}</p>
        <h3 className="text-4xl font-semibold tracking-tight text-ink">{name || 'Nombre del producto'}</h3>
        <p className="text-sm leading-6 text-muted">{description || 'Agrega una descripcion que explique beneficio, uso y cliente ideal.'}</p>
        <div>
          <p className="text-2xl font-semibold text-ink">{formatUsd(priceUsd)}</p>
          <p className="text-sm text-brand">{formatBs(priceBs)}</p>
        </div>
        <span className="w-fit rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs text-green-200">{status}</span>
      </div>
    </div>
  );
}

function ProductWhatsAppPreview({
  name,
  brandName,
  priceUsd,
  stock,
  status,
}: {
  name?: string;
  brandName?: string;
  priceUsd: number;
  stock: number;
  status: string;
}) {
  return (
    <div className="grid min-h-[420px] content-end bg-[#0B141A] p-5">
      <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-[#005C4B] p-4 text-sm text-white shadow-lg">
        Tenemos {name || 'este producto'}{brandName ? ` de ${brandName}` : ''}.
        <br />
        Precio: {formatUsd(priceUsd)}.
        <br />
        Estado: {status}. {stock > 0 ? `Quedan ${stock} unidades.` : 'Por ahora esta agotado.'}
      </div>
      <div className="mt-3 max-w-[82%] rounded-2xl rounded-bl-md bg-[#202C33] p-4 text-sm text-slate-100 shadow-lg">
        Fronti puede mostrar precio, disponibilidad y armar el pedido sin pedir datos repetidos.
      </div>
    </div>
  );
}

function ProductMobilePreview({
  name,
  brandName,
  image,
  priceUsd,
  status,
}: {
  name?: string;
  brandName?: string;
  image?: string;
  priceUsd: number;
  status: string;
}) {
  return (
    <div className="grid place-items-center p-5">
      <div className="w-full max-w-[300px] rounded-[32px] border border-white/[0.12] bg-black p-3 shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
        <div className="overflow-hidden rounded-[24px] bg-[#111827]">
          <PreviewImage image={image} name={name} className="aspect-[4/5]" />
          <div className="grid gap-3 p-4">
            <p className="text-xs text-brand">{brandName || 'Marca pendiente'}</p>
            <h3 className="text-lg font-semibold text-ink">{name || 'Nombre del producto'}</h3>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-ink">{formatUsd(priceUsd)}</p>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.045] px-2 py-1 text-[11px] text-slate-200">{status}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewImage({ image, name, className = '' }: { image?: string; name?: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[radial-gradient(circle_at_30%_10%,rgba(201,162,39,0.22),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] ${className}`}>
      {image ? (
        <img src={image} alt={name || 'Producto'} className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-6 grid place-items-center rounded-[22px] border border-white/[0.08] bg-black/20 text-center">
          <div>
            <ImageIcon className="mx-auto h-12 w-12 text-brand" />
            <p className="mt-3 text-sm font-medium text-slate-300">Agrega una imagen principal.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductAISuggestions({
  name,
  description,
  category,
  brandName,
  hasImage,
  priceUsd,
  stock,
  minStock,
  related,
  defaultOpen = false,
}: {
  name?: string;
  description: string;
  category?: string;
  brandName?: string;
  hasImage: boolean;
  priceUsd: number;
  stock: number;
  minStock: number;
  related: Product[];
  defaultOpen?: boolean;
}) {
  const qualityScore = Math.min(
    100,
    (name ? 18 : 0) +
      (brandName ? 14 : 0) +
      (category ? 14 : 0) +
      (description.length >= 80 ? 20 : description.length >= 35 ? 12 : 0) +
      (priceUsd > 0 ? 14 : 0) +
      (hasImage ? 20 : 0),
  );
  const missingWords = [
    !description.toLowerCase().includes('beneficio') ? 'beneficio' : '',
    !description.toLowerCase().includes('uso') ? 'uso' : '',
    !description.toLowerCase().includes('ideal') ? 'ideal para' : '',
  ].filter(Boolean);

  return (
    <details open={defaultOpen} className="rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Sparkles className="h-4 w-4 text-brand" />
          Sugerencias de IA
        </span>
        <ChevronDown className="h-4 w-4 text-muted" />
      </summary>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <InsightMeter label="Indicador de conversion" value={qualityScore} />
        <InsightItem title="Calidad de descripcion" value={descriptionQuality(description)} />
        <InsightItem title="Palabras faltantes" value={missingWords.length ? missingWords.join(', ') : 'Descripcion bien orientada'} />
        <InsightItem title="Estado SEO" value={name && category ? 'Base lista para catalogo' : 'Faltan nombre y categoria'} />
        <div className="grid gap-2 text-sm text-slate-300 md:col-span-2">
          <SmartSuggestion done={Boolean(name)} text="Usa un nombre claro y facil de recordar." />
          <SmartSuggestion done={description.length >= 80} text="Explica beneficio, uso y cliente ideal." />
          <SmartSuggestion done={hasImage} text="La imagen principal mejora la conversion del catalogo." />
          <SmartSuggestion done={stock > minStock} text="Mantén stock por encima del minimo." />
        </div>
        {related.length ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3 md:col-span-2">
            <p className="text-xs text-muted">Productos relacionados</p>
            <p className="mt-1 text-sm text-slate-200">{related.map((product) => product.name).join(', ')}</p>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function InsightMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-semibold text-ink">{value}%</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function InsightItem({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3">
      <p className="text-xs text-muted">{title}</p>
      <p className="mt-1 text-sm font-medium text-slate-200">{value}</p>
    </div>
  );
}

function SmartSuggestion({ done, text }: { done: boolean; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3">
      {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-300" /> : <Star className="mt-0.5 h-4 w-4 text-brand" />}
      <span>{text}</span>
    </div>
  );
}

function descriptionQuality(description: string) {
  if (description.length >= 120) return 'Excelente: clara y comercial';
  if (description.length >= 70) return 'Buena: puede vender mejor con mas beneficios';
  if (description.length >= 25) return 'Basica: agrega uso, beneficio y cliente ideal';
  return 'Pendiente: escribe una descripcion comercial';
}

function BrandsSection({
  brands,
  brandForm,
  editingBrand,
  onSubmit,
  onEdit,
  onCancelEdit,
  onDelete,
}: {
  brands: Brand[];
  brandForm: UseFormReturn<BrandForm>;
  editingBrand: Brand | null;
  onSubmit: (values: BrandForm) => Promise<void>;
  onEdit: (brand: Brand) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[420px_1fr]">
      <Panel title={editingBrand ? 'Editar marca' : 'Nueva marca'} description="Crea marcas compactas para asociarlas a tus productos.">
        <form className="grid gap-3" onSubmit={brandForm.handleSubmit(onSubmit)}>
          <Field label="Nombre de marca" error={brandForm.formState.errors.name?.message}>
            <Input placeholder="Ej: Dr. Althea" {...brandForm.register('name')} />
          </Field>
          <ImageUploadField
            label="Logo de marca"
            value={brandForm.watch('logo')}
            onChange={(value) => brandForm.setValue('logo', value, { shouldValidate: true })}
          />
          <Field label="Descripción interna">
            <Input placeholder="Opcional. No se muestra como tarjeta larga." {...brandForm.register('description')} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={brandForm.formState.isSubmitting}>
              <Building2 className="h-4 w-4" />
              {editingBrand ? 'Guardar marca' : 'Crear marca'}
            </Button>
            {editingBrand ? (
              <Button type="button" variant="secondary" onClick={onCancelEdit}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel title="Marcas registradas" description="Listado compacto para editar o eliminar sin romper el flujo de productos.">
        {brands.length ? (
          <div className="grid gap-2">
            {brands.map((brand) => (
              <div
                key={brand.id}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#1E1E1E] p-3"
              >
                <BrandLogo brand={brand} compact />
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{brand.name}</p>
                <button
                  type="button"
                  onClick={() => onEdit(brand)}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.045] px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/[0.08]"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(brand.id)}
                  className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-xs text-red-200 transition hover:bg-red-400/15"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin marcas" description="Crea tu primera marca y luego selecciónala al crear productos." />
        )}
      </Panel>
    </div>
  );
}

function CategoriesSection({ categories }: { categories: string[] }) {
  return (
    <div className="mt-5">
      <Panel title="Categorías" description="Categorías detectadas desde tus productos.">
        {categories.length ? (
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <span
                key={category}
                className="rounded-full border border-white/[0.08] bg-white/[0.045] px-4 py-2 text-sm text-slate-200"
              >
                {category}
              </span>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin categorías" description="Escribe una categoría al crear productos para organizar tu catálogo." />
        )}
      </Panel>
    </div>
  );
}

function ProductCatalogDrawer({
  open,
  products,
  loading,
  loadError,
  query,
  filter,
  bcvRate,
  onQueryChange,
  onFilterChange,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  onDetails,
}: {
  open: boolean;
  products: Product[];
  loading: boolean;
  loadError?: string | null;
  query: string;
  filter: ProductFilter;
  bcvRate: number | null;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: ProductFilter) => void;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onDelete: (id: string) => void;
  onDetails: (product: Product) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(CATALOG_BATCH_SIZE);
  const visibleItems = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  useEffect(() => {
    if (open) {
      setVisibleCount(CATALOG_BATCH_SIZE);
    }
  }, [filter, open, products.length, query]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm"
        >
          <motion.div
            initial={{ x: 520 }}
            animate={{ x: 0 }}
            exit={{ x: 520 }}
            transition={{ duration: 0.22 }}
            className="ml-auto grid h-full w-full max-w-[560px] grid-rows-[auto_auto_1fr] border-l border-white/[0.08] bg-[#111827] shadow-[0_18px_70px_rgba(0,0,0,0.42)]"
          >
            <header className="flex items-center justify-between border-b border-line p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Catalogo</p>
                <h2 className="mt-1 text-xl font-semibold text-ink">Productos guardados</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.045] text-slate-200 transition hover:bg-white/[0.08] hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="grid gap-3 border-b border-line p-5">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder="Buscar productos por nombre, marca, SKU o categoria"
                  className="h-11 rounded-2xl pl-10"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {filters.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onFilterChange(option.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      filter === option.value
                        ? 'border-brand/40 bg-brand/15 text-brand'
                        : 'border-white/[0.08] bg-white/[0.045] text-slate-300 hover:bg-white/[0.08] hover:text-ink'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto p-5">
              {loadError ? <ErrorState message={loadError} /> : null}
              {loading ? (
                <LoadingState />
              ) : products.length ? (
                <>
                  <div className="mb-4 flex items-center justify-between gap-3 text-xs text-muted">
                    <span>
                      Mostrando {visibleItems.length} de {products.length} productos
                    </span>
                    {hasMore ? <span>Carga por lotes para mantener fluidez</span> : null}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {visibleItems.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        promotion={getActivePromotion(product)}
                        bcvRate={bcvRate}
                        onEdit={onEdit}
                        onDuplicate={onDuplicate}
                        onDelete={onDelete}
                        onDetails={onDetails}
                      />
                    ))}
                  </div>
                  {hasMore ? (
                    <div className="mt-5 flex justify-center">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setVisibleCount((current) =>
                            Math.min(current + CATALOG_BATCH_SIZE, products.length),
                          )
                        }
                      >
                        Mostrar más productos
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState title="Sin productos" description="Crea tu primer producto para activar el catalogo de Fronti." />
              )}
            </div>
          </motion.div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function ProductAssistantDrawer({
  open,
  form,
  brands,
  products,
  galleryPreview,
  onClose,
}: {
  open: boolean;
  form: UseFormReturn<ProductForm>;
  brands: Brand[];
  products: Product[];
  galleryPreview: string[];
  onClose: () => void;
}) {
  const values = form.watch();
  const brand = brands.find((item) => item.id === values.brandId);
  const image = values.mainImage || values.coverImage || galleryPreview[0];
  const related = products
    .filter((product) => product.category && product.category === values.category)
    .slice(0, 3);

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm"
        >
          <motion.div
            initial={{ x: 440 }}
            animate={{ x: 0 }}
            exit={{ x: 440 }}
            transition={{ duration: 0.22 }}
            className="ml-auto grid h-full w-full max-w-[440px] grid-rows-[auto_1fr] border-l border-white/[0.08] bg-[#111827] shadow-[0_18px_70px_rgba(0,0,0,0.42)]"
          >
            <header className="flex items-center justify-between border-b border-line p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-brand">Asistente IA</p>
                <h2 className="mt-1 text-xl font-semibold text-ink">Mejoras para vender mejor</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.045] text-slate-200 transition hover:bg-white/[0.08] hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="overflow-y-auto p-5">
              <ProductAISuggestions
                name={values.name}
                description={values.description ?? ''}
                category={values.category}
                brandName={brand?.name}
                hasImage={Boolean(image)}
                priceUsd={Number(values.priceUsd || 0)}
                stock={Number(values.stock || 0)}
                minStock={Number(values.minStock || 0)}
                related={related}
                defaultOpen
              />
            </div>
          </motion.div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function ProductCard({
  product,
  promotion,
  bcvRate,
  onEdit,
  onDuplicate,
  onDelete,
  onDetails,
}: {
  product: Product;
  promotion?: Promotion;
  bcvRate: number | null;
  onEdit: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onDelete: (id: string) => void;
  onDetails: (product: Product) => void;
}) {
  const stock = getStockMeta(product);
  const StatusIcon = stock.icon;
  const priceUsd = Number(product.priceUsd);
  const priceBs = convertUsdToBs(priceUsd, bcvRate);

  return (
    <motion.article
      whileHover={{ y: -5 }}
      transition={{ duration: 0.18 }}
      className="group overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#1E1E1E] shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
    >
      <ProductImage product={product} />
      <div className="grid gap-4 p-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              {product.brand ? (
                <div className="mb-2 flex items-center gap-2">
                  <BrandLogo brand={product.brand} compact />
                  <span className="text-xs font-medium text-brand">{product.brand.name}</span>
                </div>
              ) : null}
              <h2 className="line-clamp-2 text-base font-semibold text-ink">{product.name}</h2>
              <p className="mt-1 text-xs text-muted">{product.category ?? 'Sin categoría'}</p>
            </div>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.045] px-2 py-1 text-[11px] text-muted">
              {product.isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p className="mt-2 font-mono text-xs text-slate-400">SKU {getSku(product)}</p>
        </div>

        <div className="grid gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Stock disponible</span>
            <span className="font-semibold text-ink">{product.stock}</span>
          </div>
          <div className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${stock.className}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {stock.label}
          </div>
        </div>

        <div>
          <p className="text-2xl font-semibold tracking-tight text-ink">{formatUsd(priceUsd)}</p>
          <p className="mt-1 text-sm font-medium text-brand">{formatBs(priceBs)}</p>
          <p className="mt-1 text-xs text-muted">Tasa BCV oficial del día</p>
          {promotion ? (
            <p className="mt-2 inline-flex rounded-full border border-green-400/20 bg-green-400/10 px-2.5 py-1 text-xs text-green-200">
              {promotion.title}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ActionButton icon={Edit3} label="Editar" onClick={() => onEdit(product)} />
          <ActionButton icon={Copy} label="Duplicar" onClick={() => onDuplicate(product)} />
          <ActionButton icon={Eye} label="Ver detalles" onClick={() => onDetails(product)} />
          <ActionButton icon={Trash2} label="Eliminar" onClick={() => onDelete(product.id)} danger />
        </div>
      </div>
    </motion.article>
  );
}

function ProductImage({ product }: { product: Product }) {
  const image = product.mainImage ?? product.coverImage ?? product.galleryImages?.[0];

  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(201,162,39,0.22),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]">
      {image ? (
        <img src={image} alt={product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
      ) : (
        <div className="absolute inset-6 grid place-items-center rounded-[24px] border border-white/[0.08] bg-black/15 backdrop-blur">
          <div className="grid place-items-center text-center">
            <ImageIcon className="h-10 w-10 text-brand" />
            <p className="mt-2 max-w-[160px] truncate text-xs font-medium text-slate-300">{product.name}</p>
          </div>
        </div>
      )}
      {product.brand ? (
        <div className="absolute left-3 top-3 rounded-full border border-black/10 bg-black/45 px-3 py-1 text-xs font-medium text-white backdrop-blur">
          {product.brand.name}
        </div>
      ) : null}
      <div className="hidden">
        <div className="grid place-items-center text-center">
          <ImageIcon className="h-10 w-10 text-brand" />
          <p className="mt-2 max-w-[160px] truncate text-xs font-medium text-slate-300">{product.name}</p>
        </div>
      </div>
    </div>
  );
}

function ProductDetailsPanel({
  product,
  products,
  bcvRate,
  onClose,
}: {
  product: Product | null;
  products: Product[];
  bcvRate: number | null;
  onClose: () => void;
}) {
  const stock = product ? getStockMeta(product) : null;
  const priceUsd = product ? Number(product.priceUsd) : 0;
  const priceBs = product ? convertUsdToBs(priceUsd, bcvRate) : null;
  const gallery = product ? getProductGallery(product) : [];
  const relatedProducts = product
    ? products
        .filter((item) => item.id !== product.id)
        .filter(
          (item) =>
            (product.brandId && item.brandId === product.brandId) ||
            (product.category && item.category === product.category),
        )
        .slice(0, 4)
    : [];

  return (
    <AnimatePresence>
      {product ? (
        <motion.aside
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm"
        >
          <motion.div
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ duration: 0.22 }}
            className="ml-auto grid h-full w-full max-w-[460px] grid-rows-[auto_1fr] border-l border-white/[0.08] bg-[#111827] shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
          >
            <header className="flex items-center justify-between border-b border-line p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Detalles del producto</p>
                <h2 className="mt-1 text-xl font-semibold text-ink">{product.name}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.045] text-muted transition hover:bg-white/[0.08] hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="overflow-y-auto p-5">
              <div className="overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#1E1E1E]">
                <ProductImage product={product} />
              </div>
              {gallery.length ? (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {gallery.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => window.open(image, '_blank')}
                      className="aspect-square overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035]"
                    >
                      <img src={image} alt={`${product.name} ${index + 1}`} className="h-full w-full object-cover transition hover:scale-105" />
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 grid gap-3">
                <DetailLine label="Marca" value={product.brand?.name ?? 'Sin marca'} />
                <DetailLine label="Descripción" value={product.description ?? 'Sin descripción'} />
                <DetailLine label="Categoría" value={product.category ?? 'Sin categoría'} />
                <DetailLine label="SKU" value={getSku(product)} />
                <DetailLine label="Precio USD" value={formatUsd(priceUsd)} />
                <DetailLine label="Precio Bs" value={formatBs(priceBs)} />
                <DetailLine label="Fecha de creación" value={formatDate(product.createdAt)} />
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
                  <p className="text-sm text-muted">Estado del stock</p>
                  {stock ? (
                    <p className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${stock.className}`}>
                      <stock.icon className="h-4 w-4" />
                      {stock.label}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <h3 className="text-sm font-semibold text-ink">Historial de inventario</h3>
                <TimelineItem title="Stock actual registrado" detail={`${product.stock} unidades disponibles`} />
                <TimelineItem title="Stock mínimo configurado" detail={`${product.minStock} unidades`} />
                <TimelineItem title="Última revisión Fronti" detail="Inventario sincronizado para respuestas por WhatsApp." />
              </div>

              <div className="mt-5 grid gap-3">
                <h3 className="text-sm font-semibold text-ink">Últimos movimientos</h3>
                <TimelineItem title="Precio calculado con BCV" detail={formatBs(priceBs)} />
                <TimelineItem title="Producto disponible para ventas" detail={product.isActive ? 'Activo' : 'Inactivo'} />
              </div>

              <div className="mt-5 grid gap-3">
                <h3 className="text-sm font-semibold text-ink">Productos relacionados</h3>
                {relatedProducts.length ? (
                  relatedProducts.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3">
                      <div className="h-14 w-14 overflow-hidden rounded-xl bg-white/[0.04]">
                        {getProductGallery(item)[0] ? (
                          <img src={getProductGallery(item)[0]} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center">
                            <ImageIcon className="h-5 w-5 text-brand" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">{item.name}</p>
                        <p className="text-xs text-muted">{item.brand?.name ?? item.category ?? 'Producto relacionado'}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4 text-sm text-muted">
                    Aun no hay productos relacionados.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs transition ${
        danger
          ? 'border-red-400/20 bg-red-400/10 text-red-200 hover:bg-red-400/15'
          : 'border-white/[0.08] bg-white/[0.045] text-slate-200 hover:bg-white/[0.08] hover:text-ink'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function DetailLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink">{value || '-'}</p>
    </div>
  );
}

function TimelineItem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
      <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-xl border border-brand/20 bg-brand/10">
        <TrendingUp className="h-3.5 w-3.5 text-brand" />
      </div>
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-1 text-xs text-muted">{detail}</p>
      </div>
    </div>
  );
}

function getStockState(product: Product) {
  if (product.stock <= 0) return 'out_of_stock';
  if (product.stock <= product.minStock) return 'low_stock';
  return 'healthy';
}

function getStockMeta(product: Product) {
  if (!product.isActive) {
    return {
      label: 'Inactivo',
      icon: XCircle,
      className: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
    };
  }

  const state = getStockState(product);

  if (state === 'out_of_stock') {
    return {
      label: 'Agotado',
      icon: XCircle,
      className: 'border-red-400/25 bg-red-400/10 text-red-300',
    };
  }

  if (state === 'low_stock') {
    return {
      label: 'Stock bajo',
      icon: AlertTriangle,
      className: 'border-yellow-300/25 bg-yellow-300/10 text-yellow-200',
    };
  }

  return {
    label: 'Disponible',
    icon: CheckCircle2,
    className: 'border-green-400/25 bg-green-400/10 text-green-300',
  };
}

function getSku(product: Product) {
  return `SKU-${product.id.slice(0, 8).toUpperCase()}`;
}

function getActivePromotion(product: Product) {
  return product.promotions?.find((promotion) => promotion.isActive);
}

function getProductGallery(product: Product) {
  return [
    product.mainImage,
    product.coverImage,
    ...(product.galleryImages ?? []),
  ].filter((image): image is string => Boolean(image));
}

function splitGalleryImages(value?: string) {
  return (value ?? '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildProductPayload(values: ProductForm) {
  const galleryImages = splitGalleryImages(values.galleryImagesText);
  const isInactive = values.productStatus === 'inactive';
  const isOutOfStock = values.productStatus === 'out_of_stock';

  return {
    brandId: values.brandId || undefined,
    name: values.name,
    description: values.description || undefined,
    category: values.category || undefined,
    mainImage: values.mainImage || undefined,
    coverImage: values.coverImage || undefined,
    galleryImages,
    priceUsd: values.priceUsd,
    currencyBase: 'USD' as const,
    stock: isOutOfStock ? 0 : values.stock,
    minStock: values.minStock,
    isActive: !isInactive,
  };
}

function BrandLogo({ brand, compact = false }: { brand: Brand; compact?: boolean }) {
  const size = compact ? 'h-6 w-6 rounded-lg' : 'h-10 w-10 rounded-xl';

  return (
    <div className={`${size} grid shrink-0 place-items-center overflow-hidden border border-white/[0.08] bg-white/[0.05]`}>
      {brand.logo ? (
        <img src={brand.logo} alt={brand.name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-semibold text-brand">{brand.name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function ImageUploadField({
  label,
  value,
  onChange,
  onStatus,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  onStatus?: (message: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="grid gap-2">
        {value ? (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035]">
            <img src={value} alt={label} className="h-32 w-full object-cover" />
          </div>
        ) : null}
        <Input value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder="URL jpg, png o webp" />
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={async (event) => {
            try {
              onStatus?.('Estamos optimizando la imagen para guardarla.');
              const [image] = await readImageFiles(event.target.files);
              if (image) {
                onChange(image);
                onStatus?.('Imagen optimizada correctamente.');
              } else {
                onStatus?.('');
              }
            } catch (uploadError) {
              console.error('[Productos] Error al optimizar imagen:', uploadError);
              onStatus?.(getImageProcessingError(uploadError));
            } finally {
              event.target.value = '';
            }
          }}
          className="text-xs text-muted file:mr-3 file:rounded-xl file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#1E1E1E]"
        />
      </div>
    </Field>
  );
}

async function readImageFiles(files: FileList | null) {
  if (!files?.length) {
    return [];
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  const selected = Array.from(files).filter((file) => allowed.includes(file.type));
  return Promise.all(selected.map(optimizeImageFile));
}

async function optimizeImageFile(file: File) {
  const firstPass = await resizeImageToDataUrl(file, {
    maxWidth: 1200,
    quality: 0.75,
    mimeType: 'image/webp',
  });

  if (getDataUrlSize(firstPass) <= 10 * 1024 * 1024) {
    return firstPass;
  }

  const secondPass = await resizeImageToDataUrl(file, {
    maxWidth: 1000,
    quality: 0.6,
    mimeType: 'image/webp',
  });

  if (getDataUrlSize(secondPass) <= 10 * 1024 * 1024) {
    return secondPass;
  }

  throw new Error('image_too_large_after_optimization');
}

function resizeImageToDataUrl(
  file: File,
  options: { maxWidth: number; quality: number; mimeType: 'image/webp' | 'image/jpeg' },
) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, options.maxWidth / image.width);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('canvas_not_supported'));
        return;
      }

      context.drawImage(image, 0, 0, width, height);

      const webpDataUrl = canvas.toDataURL(options.mimeType, options.quality);
      if (webpDataUrl.startsWith('data:image/webp')) {
        resolve(webpDataUrl);
        return;
      }

      resolve(canvas.toDataURL('image/jpeg', options.quality));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('image_read_failed'));
    };

    image.src = objectUrl;
  });
}

function getDataUrlSize(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.ceil((base64.length * 3) / 4);
}

function getImageProcessingError(error: unknown) {
  if (error instanceof Error && error.message === 'image_too_large_after_optimization') {
    return 'No pudimos optimizar esta imagen. Intenta con una imagen más liviana.';
  }

  return 'No pudimos procesar la imagen. Verifica que sea JPG, PNG o WEBP.';
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}


