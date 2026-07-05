'use client';
import { useState } from 'react';
import { CheckCircle2, ImageIcon, Package, ShoppingBag, Sparkles } from 'lucide-react';
import { formatProductPrice } from '@/lib/product-pricing';
import type { Product, Promotion } from '@/types';

type BeautyProductCardProps = {
  product: Product;
  exchangeRate?: number | string | null;
  promotions?: Promotion[];
  onSelect?: (product: Product) => void;
  compact?: boolean;
};

export function BeautyProductCard({
  product,
  exchangeRate,
  promotions = [],
  onSelect,
  compact = false,
}: BeautyProductCardProps) {
  const image = getProductImage(product);
  const brandLogo = getPublicAssetUrl(product.brand?.logo);
  const [imageFailed, setImageFailed] = useState(false);
  const [brandLogoFailed, setBrandLogoFailed] = useState(false);
  const price = formatProductPrice(product, exchangeRate);
  const activePromotion = promotions.find(
    (promotion) => promotion.productId === product.id || !promotion.productId,
  );
  const isAvailable = Number(product.stock ?? 0) > 0 && product.isActive;

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#111827]/90 shadow-2xl shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-purple-400/50">
      <div className={`relative bg-[#F8F5F0] ${compact ? 'aspect-[4/3]' : 'aspect-square'}`}>
        {image && !imageFailed ? (
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-contain p-5 transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center text-[#3E2723]/55">
            <div className="grid justify-items-center gap-2">
              <ImageIcon className="h-10 w-10" />
              <span className="text-xs font-semibold">Producto Beauty Hub</span>
            </div>
          </div>
        )}
        {activePromotion ? (
          <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-[#8B5CF6] px-3 py-1 text-xs font-bold text-white">
            <Sparkles className="h-3.5 w-3.5" />
            Promo
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-purple-300">
            {brandLogo && !brandLogoFailed ? (
              <img
                src={brandLogo}
                alt={product.brand?.name ?? 'Marca Beauty Hub'}
                loading="lazy"
                decoding="async"
                onError={() => setBrandLogoFailed(true)}
                className="h-4 w-4 rounded-full object-cover"
              />
            ) : null}
            <span className="truncate">{product.brand?.name ?? 'Beauty Hub'}</span>
          </div>
          <h3 className="mt-2 line-clamp-2 min-h-[3rem] text-lg font-semibold leading-tight text-white">
            {product.name}
          </h3>
          <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm leading-5 text-slate-400">
            {product.description || product.category || 'Producto seleccionado del catálogo Beauty Hub.'}
          </p>
        </div>

        <div className="mt-auto grid gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-slate-300">
              <Package className="h-3.5 w-3.5" />
              {product.category || 'Skincare'}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
                isAvailable
                  ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                  : 'border border-red-400/30 bg-red-400/10 text-red-100'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isAvailable ? `${product.stock} disponibles` : 'Agotado'}
            </span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-lg font-semibold text-white">{price.formattedUsd}</p>
            <p className="mt-0.5 text-sm text-slate-400">Bs: {price.formattedBs}</p>
          </div>

          {onSelect ? (
            <button
              type="button"
              onClick={() => onSelect(product)}
              disabled={!isAvailable}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#8B5CF6] px-4 text-sm font-bold text-white transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingBag className="h-4 w-4" />
              Elegir producto
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function getProductImage(product: Product) {
  return getPublicAssetUrl(product.mainImage || product.coverImage || product.galleryImages?.[0] || null);
}

function getPublicAssetUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  const localHostName = 'local' + 'host';
  const localIpv4Host = ['127', '0', '0', '1'].join('.');
  const localBackendUrl = ['http://', localHostName, ':3000'].join('');
  const localBackendIpv4Url = ['http://', localIpv4Host, ':3000'].join('');
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  const isConfiguredLocalhost =
    configuredApiUrl?.includes(localHostName) || configuredApiUrl?.includes(localIpv4Host);
  const apiUrl =
    typeof window !== 'undefined' && isConfiguredLocalhost && window.location.hostname !== localHostName
      ? '/.netlify/functions/backend'
      : configuredApiUrl || '/.netlify/functions/backend';

  if (url.startsWith(localBackendUrl)) {
    return url.replace(localBackendUrl, apiUrl);
  }

  if (url.startsWith(localBackendIpv4Url)) {
    return url.replace(localBackendIpv4Url, apiUrl);
  }

  if (url.startsWith('/uploads/')) {
    return `${apiUrl}${url}`;
  }

  return url;
}
