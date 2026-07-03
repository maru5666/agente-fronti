import axios from 'axios';
import { normalizeText, normalizeValue } from '@/lib/normalize-text';
import type {
  BcvRate,
  Brand,
  ChatReply,
  Company,
  CompanyBranch,
  DeliveryEstimate,
  DeliveryLocationReply,
  DeliveryZone,
  Order,
  OrderSummary,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductMetrics,
  Promotion,
  HealthStatus,
  InternalNotification,
  InternalNotificationStatus,
  LocalDeliveryReference,
} from '@/types';

type ProductPayload = {
  companyId?: string;
  brandId?: string;
  name?: string;
  description?: string;
  category?: string;
  mainImage?: string;
  coverImage?: string;
  galleryImages?: string[];
  priceUsd?: number;
  currencyBase?: 'USD';
  stock?: number;
  minStock?: number;
  isActive?: boolean;
};

type BrandPayload = {
  companyId?: string;
  name?: string;
  logo?: string;
  description?: string;
};

type CompanyPayload = {
  commercialName?: string;
  phone?: string;
  address?: string;
  logo?: string;
  primaryColor?: string;
  catalogBanner?: string;
  establishmentName?: string;
  establishmentAddress?: string;
  establishmentLatitude?: number;
  establishmentLongitude?: number;
  googleMapsReference?: string;
  baseDeliveryZone?: string;
  deliveryBaseFeeUsd?: number;
  deliveryPricePerKmUsd?: number;
  deliveryMinimumFeeUsd?: number;
  deliveryFarZoneSurchargeUsd?: number;
  deliveryFreeFromUsd?: number;
};

type WorkspaceAvailability = {
  available: boolean;
};

type PromotionPayload = {
  companyId?: string;
  productId?: string;
  title?: string;
  description?: string;
  discountPercent?: number;
  startDate?: string;
  endDate?: string;
};

type BranchPayload = {
  companyId?: string;
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  isMain?: boolean;
  isActive?: boolean;
};

type DeliveryZonePayload = {
  companyId?: string;
  name?: string;
  description?: string;
  priceUsd?: number;
  priceBs?: number;
  fixedFeeUsd?: number;
  pricePerKmUsd?: number;
  minDistanceKm?: number;
  estimatedTime?: string;
  maxDistanceKm?: number;
  color?: string;
  priority?: number;
  localLatitude?: number;
  localLongitude?: number;
  localRadiusKm?: number;
  city?: string;
  state?: string;
  country?: string;
  distanceFromCompanyKm?: number;
  polygonCoordinates?: Array<{ latitude: number; longitude: number }>;
  isActive?: boolean;
};

type DeliveryEstimatePayload = {
  companyId: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  orderSubtotalUsd?: number;
};

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL?.trim() || '/api/backend',
  timeout: 12000,
});

api.interceptors.response.use((response) => {
  response.data = normalizeValue(response.data);
  return response;
});

const GENERIC_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intenta nuevamente.';

export function getApiError(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      !error.response
    ) {
      return mapFriendlyError(error.code ?? error.message);
    }

    const statusMessage = getStatusErrorMessage(error.response.status);
    const responseMessage = extractResponseMessage(error.response.data);

    if (responseMessage) {
      const friendlyMessage = mapFriendlyError(responseMessage, error.response.status);
      if (friendlyMessage) {
        return friendlyMessage;
      }
    }

    return statusMessage ?? GENERIC_ERROR_MESSAGE;
  }

  if (error instanceof Error) {
    return mapFriendlyError(error.message) ?? GENERIC_ERROR_MESSAGE;
  }

  return GENERIC_ERROR_MESSAGE;
}

function extractResponseMessage(data: unknown) {
  if (!data) return '';

  if (typeof data === 'string') {
    return data;
  }

  if (typeof data === 'object') {
    const payload = data as {
      message?: string | string[];
      error?: string;
      detail?: string;
    };

    if (Array.isArray(payload.message)) {
      return payload.message.join(', ');
    }

    return payload.message ?? payload.error ?? payload.detail ?? '';
  }

  return '';
}

function getStatusErrorMessage(status?: number) {
  if (status === 400) {
    return 'Revisa los datos ingresados e intenta nuevamente.';
  }

  if (status === 401 || status === 403) {
    return 'No tienes acceso para realizar esta acción.';
  }

  if (status === 404) {
    return 'No encontramos la información solicitada.';
  }

  if (status === 409) {
    return 'Ya existe un registro con esos datos.';
  }

  if (status === 413) {
    return 'La imagen es demasiado grande. Intenta subir una imagen más pequeña.';
  }

  if (status === 422) {
    return 'Hay datos que necesitan corrección antes de continuar.';
  }

  if (status === 429) {
    return 'Hay demasiadas solicitudes. Intenta nuevamente en unos segundos.';
  }

  if (status && status >= 500) {
    return 'Ocurrió un error interno. Intenta nuevamente en unos segundos.';
  }

  return null;
}

function mapFriendlyError(message?: string, status?: number) {
  const statusMessage = getStatusErrorMessage(status);
  const normalized = normalizeErrorText(message);

  if (!normalized) {
    return statusMessage ?? GENERIC_ERROR_MESSAGE;
  }

  if (
    normalized.includes('request entity too large') ||
    normalized.includes('payload too large') ||
    normalized.includes('entity too large') ||
    normalized.includes('413')
  ) {
    return 'La imagen es demasiado grande. Intenta subir una imagen más pequeña.';
  }

  if (
    normalized.includes('network error') ||
    normalized.includes('err_network') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('econnrefused') ||
    normalized.includes('connection refused') ||
    normalized.includes('timeout') ||
    normalized.includes('econnaborted')
  ) {
    return 'No pudimos conectarnos. Verifica tu conexión e inténtalo nuevamente.';
  }

  if (
    normalized.includes('internal server error') ||
    normalized.includes('500') ||
    normalized.includes('prisma') ||
    normalized.includes('p20') ||
    normalized.includes('stack trace') ||
    normalized.includes('syntaxerror')
  ) {
    return 'Ocurrió un error interno. Intenta nuevamente en unos segundos.';
  }

  if (
    normalized.includes('bad request') ||
    normalized.includes('must be') ||
    normalized.includes('should not') ||
    normalized.includes('is not allowed') ||
    normalized.includes('cannot post') ||
    normalized.includes('cannot get')
  ) {
    return 'Revisa los datos ingresados e intenta nuevamente.';
  }

  if (normalized.includes('unauthorized') || normalized.includes('forbidden')) {
    return 'No tienes acceso para realizar esta acción.';
  }

  if (normalized.includes('empresa no encontrada')) {
    return 'No encontramos una empresa con ese ID o RIF.';
  }

  if (normalized.includes('not found')) {
    return 'No encontramos la información solicitada.';
  }

  if (normalized.includes('<html') || normalized.includes('<!doctype')) {
    return statusMessage ?? GENERIC_ERROR_MESSAGE;
  }

  return isUserFriendlySpanish(message) ? message!.trim() : statusMessage ?? GENERIC_ERROR_MESSAGE;
}

function normalizeErrorText(message?: string) {
  return normalizeText(message ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isUserFriendlySpanish(message?: string) {
  if (!message) return false;

  const normalized = normalizeErrorText(message);
  const technicalHints = [
    'error:',
    'axioserror',
    'exception',
    'stack',
    'trace',
    'request failed',
    'status code',
    'localhost',
    'http://',
    'https://',
    'undefined',
    'null',
    'nan',
  ];

  if (technicalHints.some((hint) => normalized.includes(hint))) {
    return false;
  }

  return /[áéíóúñ¿¡]/i.test(message) || /\b(el|la|los|las|un|una|de|con|para|intenta|empresa|producto|contraseña|correo)\b/i.test(message);
}

export const companiesApi = {
  create: (data: Partial<Company>) =>
    api.post<Company>('/companies', data).then((res) => res.data),
  get: (id: string) => api.get<Company>(`/companies/${id}`).then((res) => res.data),
  update: (id: string, data: CompanyPayload) =>
    api.patch<Company>(`/companies/${id}`, data).then((res) => res.data),
  getByWorkspace: (workspaceCode: string) =>
    api
      .get<Company>(`/companies/workspace/${workspaceCode}`)
      .then((res) => res.data),
  getByAccess: (accessCode: string) =>
    api
      .get<Company>(`/companies/access/${encodeURIComponent(accessCode)}`)
      .then((res) => res.data),
  login: (data: { identifier: string; password: string }) =>
    api.post<Company>('/companies/login', data).then((res) => res.data),
  checkWorkspaceAvailability: (workspaceCode: string) =>
    api
      .get<WorkspaceAvailability>(`/companies/workspace/${workspaceCode}/availability`)
      .then((res) => res.data),
  list: () => api.get<Company[]>('/companies').then((res) => res.data),
};

export const healthApi = {
  check: () => api.get<HealthStatus>('/health').then((res) => res.data),
};

export const productsApi = {
  create: (data: ProductPayload) =>
    api.post<Product>('/products', data).then((res) => res.data),
  list: (companyId: string, options?: { limit?: number }) =>
    api
      .get<Product[]>(`/products/company/${companyId}`, {
        params: { limit: options?.limit },
      })
      .then((res) => res.data),
  metrics: (companyId: string) =>
    api
      .get<ProductMetrics>(`/products/company/${companyId}/metrics`)
      .then((res) => res.data),
  lowStock: (companyId: string, options?: { limit?: number }) =>
    api
      .get<Product[]>(`/products/company/${companyId}/low-stock`, {
        params: { limit: options?.limit },
      })
      .then((res) => res.data),
  update: (id: string, data: ProductPayload) =>
    api.patch<Product>(`/products/${id}`, data).then((res) => res.data),
  remove: (id: string) => api.delete<Product>(`/products/${id}`).then((res) => res.data),
};

export const brandsApi = {
  create: (data: BrandPayload) =>
    api.post<Brand>('/brands', data).then((res) => res.data),
  list: (companyId: string) =>
    api.get<Brand[]>(`/brands/company/${companyId}`).then((res) => res.data),
  update: (id: string, data: BrandPayload) =>
    api.patch<Brand>(`/brands/${id}`, data).then((res) => res.data),
  remove: (id: string) => api.delete<Brand>(`/brands/${id}`).then((res) => res.data),
};

export const promotionsApi = {
  create: (data: PromotionPayload) =>
    api.post<Promotion>('/promotions', data).then((res) => res.data),
  active: (companyId: string, options?: { limit?: number }) =>
    api
      .get<Promotion[]>(`/promotions/company/${companyId}/active`, {
        params: { limit: options?.limit },
      })
      .then((res) => res.data),
  update: (id: string, data: PromotionPayload) =>
    api.patch<Promotion>(`/promotions/${id}`, data).then((res) => res.data),
  remove: (id: string) =>
    api.delete<Promotion>(`/promotions/${id}`).then((res) => res.data),
};

export const paymentMethodsApi = {
  create: (data: Partial<PaymentMethod>) =>
    api.post<PaymentMethod>('/payment-methods', data).then((res) => res.data),
  list: (companyId: string) =>
    api
      .get<PaymentMethod[]>(`/payment-methods/company/${companyId}`)
      .then((res) => res.data),
  update: (id: string, data: Partial<PaymentMethod>) =>
    api
      .patch<PaymentMethod>(`/payment-methods/${id}`, data)
      .then((res) => res.data),
  remove: (id: string) =>
    api.delete<PaymentMethod>(`/payment-methods/${id}`).then((res) => res.data),
};

export const deliveryZonesApi = {
  create: (data: DeliveryZonePayload) =>
    api.post<DeliveryZone>('/delivery-zones', data).then((res) => res.data),
  list: (companyId: string) =>
    api
      .get<DeliveryZone[]>(`/delivery-zones/company/${companyId}`)
      .then((res) => res.data),
  update: (id: string, data: DeliveryZonePayload) =>
    api
      .patch<DeliveryZone>(`/delivery-zones/${id}`, data)
      .then((res) => res.data),
  remove: (id: string) =>
    api.delete<DeliveryZone>(`/delivery-zones/${id}`).then((res) => res.data),
  localReferences: () =>
    api
      .get<LocalDeliveryReference[]>('/delivery-zones/local-references/san-cristobal')
      .then((res) => res.data),
  estimate: (data: DeliveryEstimatePayload) =>
    api.post<DeliveryEstimate>('/delivery-zones/estimate', data).then((res) => res.data),
};

export const deliveryApi = {
  sendLocation: (data: {
    companyId: string;
    customerPhone: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp?: number;
    type: 'location';
  }) =>
    api
      .post<DeliveryLocationReply>('/delivery/location', data, { timeout: 35000 })
      .then((res) => res.data),
};

export const branchesApi = {
  create: (data: BranchPayload) =>
    api.post<CompanyBranch>('/branches', data).then((res) => res.data),
  list: (companyId: string) =>
    api.get<CompanyBranch[]>(`/branches/company/${companyId}`).then((res) => res.data),
  update: (id: string, data: BranchPayload) =>
    api.patch<CompanyBranch>(`/branches/${id}`, data).then((res) => res.data),
  remove: (id: string) =>
    api.delete<CompanyBranch>(`/branches/${id}`).then((res) => res.data),
};

export const ordersApi = {
  create: (data: {
    companyId: string;
    customerName?: string;
    customerPhone: string;
    customerAddress?: string;
    customerLatitude?: number;
    customerLongitude?: number;
    deliveryZoneId?: string;
    paymentMethodId?: string;
    status?: OrderStatus;
    items: Array<{ productId: string; quantity: number }>;
  }) => api.post<Order>('/orders', data).then((res) => res.data),
  list: (companyId: string, options?: { limit?: number }) =>
    api
      .get<Order[]>(`/orders/company/${companyId}`, {
        params: { limit: options?.limit },
      })
      .then((res) => res.data),
  summary: (companyId: string) =>
    api.get<OrderSummary>(`/orders/company/${companyId}/summary`).then((res) => res.data),
  byStatus: (companyId: string, status: OrderStatus) =>
    api
      .get<Order[]>(`/orders/company/${companyId}/status/${status}`)
      .then((res) => res.data),
  updateStatus: (id: string, status: OrderStatus) =>
    api.patch<Order>(`/orders/${id}/status`, { status }).then((res) => res.data),
  submitPaymentProof: (data: {
    companyId: string;
    customerPhone: string;
    orderId?: string;
    fileUrl?: string;
    reference?: string;
    amountUsd?: number;
    amountBs?: number;
  }) => api.post<{ proof: unknown; response: string }>('/orders/payment-proof', data).then((res) => res.data),
};

export const internalNotificationsApi = {
  list: (companyId: string, status: InternalNotificationStatus | 'all' = 'pendiente_operador') =>
    api
      .get<InternalNotification[]>(`/internal-notifications/company/${companyId}`, {
        params: { status },
      })
      .then((res) => res.data),
  pendingCount: (companyId: string) =>
    api
      .get<{ count: number }>(`/internal-notifications/company/${companyId}/pending-count`)
      .then((res) => res.data),
  update: (id: string, data: Partial<InternalNotification>) =>
    api.patch<InternalNotification>(`/internal-notifications/${id}`, data).then((res) => res.data),
};

export const bcvApi = {
  latest: () => api.get<BcvRate>('/bcv/latest').then((res) => res.data),
  sync: () => api.post<BcvRate>('/bcv/sync').then((res) => res.data),
  syncThenLatest: async () => {
    await api.post<BcvRate>('/bcv/sync');
    return api.get<BcvRate>('/bcv/latest').then((res) => res.data);
  },
};

export const frontiApi = {
  chat: async (data: {
    companyId: string;
    senderPhone: string;
    message?: string;
    type?: string;
    customerPhone?: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    timestamp?: number;
    customerAddress?: string;
    customerLatitude?: number;
    customerLongitude?: number;
    fileUrl?: string;
    imageUrl?: string;
    paymentReference?: string;
  }) => {
    const payload = removeEmptyValues(data);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Fronti chat] payload enviado:', payload);
    }

    try {
      const res = await api.post<ChatReply>('/fronti/chat', payload, { timeout: 35000 });

      if (process.env.NODE_ENV !== 'production') {
        console.log('[Fronti chat] respuesta recibida:', res.data);
      }

      return res.data;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production' && axios.isAxiosError(error)) {
        console.error('[Fronti chat] error HTTP:', {
          status: error.response?.status,
          data: error.response?.data,
          code: error.code,
          message: error.message,
        });
      } else if (process.env.NODE_ENV !== 'production') {
        console.error('[Fronti chat] error inesperado:', error);
      }

      throw error;
    }
  },
};

function removeEmptyValues<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as Partial<T>;
}
