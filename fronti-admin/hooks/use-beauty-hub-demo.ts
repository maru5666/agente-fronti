'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  bcvApi,
  companiesApi,
  deliveryZonesApi,
  paymentMethodsApi,
  productsApi,
  promotionsApi,
} from '@/services/api';
import type {
  BcvRate,
  Company,
  DeliveryZone,
  PaymentMethod,
  Product,
  Promotion,
} from '@/types';

export const BEAUTY_HUB_WORKSPACE = 'beautyhub';
export const BEAUTY_HUB_DEMO_PHONE = '+584121234567';

type DemoData = {
  company: Company | null;
  products: Product[];
  promotions: Promotion[];
  deliveryZones: DeliveryZone[];
  paymentMethods: PaymentMethod[];
  bcvRate: BcvRate | null;
};

const emptyData: DemoData = {
  company: null,
  products: [],
  promotions: [],
  deliveryZones: [],
  paymentMethods: [],
  bcvRate: null,
};

type CachedBeautyHubDemo = {
  company: Company;
  products: Product[];
  promotions?: Promotion[];
  zones?: DeliveryZone[];
  payments?: PaymentMethod[];
  bcv?: BcvRate;
};

export function useBeautyHubDemo() {
  const [data, setData] = useState<DemoData>(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const company = await companiesApi.getByWorkspace(BEAUTY_HUB_WORKSPACE);
      const [products, promotions, deliveryZones, paymentMethods, bcvRate] =
        await Promise.all([
          productsApi.list(company.id, { limit: 200 }),
          promotionsApi.active(company.id, { limit: 20 }).catch(() => []),
          deliveryZonesApi.list(company.id).catch(() => []),
          paymentMethodsApi.list(company.id).catch(() => []),
          bcvApi.latest().catch(() => null),
        ]);

      setData({
        company,
        products,
        promotions,
        deliveryZones,
        paymentMethods,
        bcvRate,
      });
    } catch (loadError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Beauty Hub demo] No se pudo cargar la demo:', loadError);
      }
      try {
        const cached = await loadCachedBeautyHubDemo();
        setData(cached);
        setError(null);
      } catch (cacheError) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[Beauty Hub demo] No se pudo cargar la caché pública:', cacheError);
        }

        setData(emptyData);
        setError('No pudimos cargar Beauty Hub. Verifica la conexión e intenta nuevamente.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeProducts = useMemo(
    () => data.products.filter((product) => product.isActive),
    [data.products],
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          activeProducts
            .map((product) => product.category?.trim())
            .filter((category): category is string => Boolean(category)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [activeProducts],
  );

  const brands = useMemo(
    () =>
      Array.from(
        new Set(
          activeProducts
            .map((product) => product.brand?.name?.trim())
            .filter((brand): brand is string => Boolean(brand)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [activeProducts],
  );

  return {
    ...data,
    products: activeProducts,
    categories,
    brands,
    isLoading,
    error,
    reload: load,
  };
}

async function loadCachedBeautyHubDemo(): Promise<DemoData> {
  const response = await fetch('/demo/beautyhub-demo-data.json', {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`No se pudo leer caché demo: ${response.status}`);
  }

  const cached = (await response.json()) as CachedBeautyHubDemo;
  const company = cached.company;
  const products = (cached.products ?? []).filter((product) => product.companyId === company.id);

  return {
    company,
    products,
    promotions: cached.promotions ?? [],
    deliveryZones: cached.zones ?? [],
    paymentMethods: cached.payments ?? [],
    bcvRate: cached.bcv ?? null,
  };
}
