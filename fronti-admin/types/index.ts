export type Company = {
  id: string;
  workspaceCode: string;
  name: string;
  commercialName?: string | null;
  rif: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  logo?: string | null;
  primaryColor?: string | null;
  catalogBanner?: string | null;
  establishmentName?: string | null;
  establishmentAddress?: string | null;
  establishmentLatitude?: string | null;
  establishmentLongitude?: string | null;
  googleMapsReference?: string | null;
  baseDeliveryZone?: string | null;
  deliveryBaseFeeUsd?: string | null;
  deliveryPricePerKmUsd?: string | null;
  deliveryMinimumFeeUsd?: string | null;
  deliveryFarZoneSurchargeUsd?: string | null;
  deliveryFreeFromUsd?: string | null;
  createdAt?: string;
};

export type CompanyBranch = {
  id: string;
  companyId: string;
  name: string;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  phone?: string | null;
  isMain: boolean;
  isActive: boolean;
  createdAt: string;
};

export type Product = {
  id: string;
  companyId: string;
  brandId?: string | null;
  brand?: Brand | null;
  name: string;
  description?: string | null;
  category?: string | null;
  mainImage?: string | null;
  coverImage?: string | null;
  galleryImages?: string[];
  priceUsd: string;
  currencyBase: 'USD';
  stock: number;
  minStock: number;
  isActive: boolean;
  createdAt: string;
  promotions?: Promotion[];
};

export type ProductMetrics = {
  total: number;
  active: number;
  lowStock: number;
  outOfStock: number;
};

export type Brand = {
  id: string;
  companyId: string;
  name: string;
  logo?: string | null;
  description?: string | null;
  createdAt: string;
};

export type Promotion = {
  id: string;
  companyId: string;
  productId?: string | null;
  title: string;
  description?: string | null;
  discountPercent: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  product?: Product | null;
};

export type PaymentMethod = {
  id: string;
  companyId: string;
  name: string;
  type: string;
  currency: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type DeliveryZone = {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  priceUsd: string;
  priceBs: string;
  fixedFeeUsd?: string | null;
  pricePerKmUsd?: string | null;
  minDistanceKm?: string | null;
  estimatedTime: string;
  maxDistanceKm?: string | null;
  color?: string | null;
  priority: number;
  localLatitude?: string | null;
  localLongitude?: string | null;
  localRadiusKm?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  distanceFromCompanyKm?: string | null;
  polygonCoordinates?: Array<{ latitude: number; longitude: number }> | null;
  isActive: boolean;
  createdAt: string;
};

export type LocalDeliveryReference = {
  name: string;
  aliases: string[];
  latitude: number;
  longitude: number;
  radiusKm: number;
  estimatedDistanceKm: number;
  suggestedFeeUsd: number;
  color: string;
};

export type DeliveryEstimate = {
  available: boolean;
  source: 'google_maps' | 'openstreetmap' | 'local' | 'unavailable';
  usedLocalFallback: boolean;
  originAddress: string;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  zoneId: string | null;
  zoneName: string | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  deliveryFeeUsd: number | null;
  deliveryFeeBs: string | null;
  googleMapsLink: string;
  message: string;
};

export type DeliveryLocationReply = {
  response: string;
  address: {
    formattedAddress: string;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    latitude: number;
    longitude: number;
  };
  delivery?: {
    originName?: string;
    destinationAddress?: string;
    status?: 'calculated' | 'needs_operator_review' | 'out_of_coverage';
    source?: 'google_maps' | 'openstreetmap' | 'local' | 'unavailable';
    zoneName?: string | null;
    distanceKm: number | null;
    durationMin?: number | null;
    durationMinutes?: number | null;
    costUsd?: number | null;
    costBs?: number | null;
    deliveryFeeUsd?: number | null;
    googleMapsLink?: string | null;
    usedLocalFallback?: boolean;
  } | null;
};

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'paid'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'pendiente_datos'
  | 'pendiente_confirmacion_cliente'
  | 'pendiente_confirmacion_operador'
  | 'pendiente_pago'
  | 'pago_en_revision'
  | 'pago_confirmado'
  | 'pendiente_delivery'
  | 'delivery_asignado'
  | 'en_preparacion'
  | 'en_camino'
  | 'entregado'
  | 'cancelado';

export type Order = {
  id: string;
  companyId: string;
  customerName?: string | null;
  customerPhone: string;
  customerAddress?: string | null;
  validatedAddress?: string | null;
  subtotalUsd: string;
  subtotalBs: string;
  deliveryFeeUsd: string;
  deliveryFeeBs: string;
  totalUsd: string;
  totalBs: string;
  distanceKm?: string | null;
  estimatedDeliveryMinutes?: number | null;
  googleMapsLink?: string | null;
  status: OrderStatus;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    product?: Product;
  }>;
  deliveryZone?: DeliveryZone | null;
  paymentMethod?: PaymentMethod | null;
};

export type OrderSummary = {
  pendingOrders: number;
  activeDeliveries: number;
  todayOrders: number;
  todayRevenueUsd: string;
  todayRevenueBs: string;
  recentOrders: Order[];
};

export type InternalNotificationType =
  | 'DELIVERY_REVIEW_REQUIRED'
  | 'ORDER_CONFIRMED'
  | 'PAYMENT_REVIEW_REQUIRED'
  | 'HUMAN_SUPPORT_REQUIRED';

export type InternalNotificationStatus =
  | 'pendiente_operador'
  | 'en_revision'
  | 'resuelta'
  | 'cancelada';

export type InternalNotificationPriority = 'baja' | 'media' | 'alta' | 'urgente';

export type InternalNotification = {
  id: string;
  companyId: string;
  orderId?: string | null;
  type: InternalNotificationType;
  title: string;
  message: string;
  priority: InternalNotificationPriority;
  status: InternalNotificationStatus;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  gpsLatitude?: string | null;
  gpsLongitude?: string | null;
  estimatedAmountUsd?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  order?: Order | null;
};

export type Category = {
  id: string;
  name: string;
  description?: string;
};

export type Supplier = {
  id: string;
  name: string;
  phone?: string;
  category?: string;
};

export type ChatReply = {
  response: string;
  messageId: string;
};

export type BcvRate = {
  id: string;
  currency: string;
  usdRate: number;
  formattedRate: string;
  source: string;
  publishedDate: string;
  fetchedAt: string;
  status: 'updated' | 'stale' | 'fallback';
  isFallback: boolean;
  error?: string;
  imageUrl?: string | null;
  extractionMethod?: string | null;
  officialUrl?: string;
};

export type HealthCheckItem = {
  status: 'connected' | 'not_configured' | 'error';
  message: string;
  error?: string;
  details?: Record<string, unknown>;
};

export type HealthStatus = {
  status: 'ok' | 'degraded';
  database: 'connected' | 'error';
  bcv: HealthCheckItem['status'];
  maps: HealthCheckItem['status'];
  timestamp: string;
  checks: Record<
    'backend' | 'postgresql' | 'prisma' | 'bcv' | 'maps' | 'whatsapp' | 'inventario',
    HealthCheckItem
  >;
};
