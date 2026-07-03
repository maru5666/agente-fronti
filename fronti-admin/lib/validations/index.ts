import { z } from 'zod';

export const companySchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  workspaceCode: z
    .string()
    .trim()
    .regex(/^[a-z0-9]{3,20}$/, 'El ID de la empresa debe tener solo letras minúsculas y números, de 3 a 20 caracteres'),
  rif: z.string().min(4, 'RIF requerido'),
  phone: z.string().min(7, 'Teléfono requerido'),
  address: z.string().optional(),
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export const loginSchema = z.object({
  accessCode: z
    .string()
    .trim()
    .min(3, 'Ingresa el ID de tu empresa o tu RIF'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});

export const productSchema = z.object({
  brandId: z.string().min(1, 'Selecciona una marca.'),
  name: z.string().min(2, 'Nombre requerido'),
  description: z.string().optional(),
  category: z.string().min(2, 'Categoría requerida'),
  mainImage: z.string().optional(),
  coverImage: z.string().optional(),
  galleryImagesText: z.string().optional(),
  priceUsd: z.coerce.number({ invalid_type_error: 'Ingresa un precio válido.' }).min(0, 'El precio no puede ser negativo.'),
  currencyBase: z.literal('USD').optional(),
  stock: z.coerce
    .number({ invalid_type_error: 'Ingresa una cantidad válida.' })
    .int('El stock debe ser un número entero.')
    .min(0, 'El stock no puede ser negativo.'),
  minStock: z.coerce
    .number({ invalid_type_error: 'Ingresa una cantidad válida.' })
    .int('El stock mínimo debe ser un número entero.')
    .min(0, 'El stock mínimo no puede ser negativo.'),
  productStatus: z.enum(['available', 'out_of_stock', 'inactive']).optional(),
});

export const companyIdentitySchema = z.object({
  commercialName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  logo: z.string().optional(),
  primaryColor: z
    .string()
    .regex(/^#([0-9A-Fa-f]{6})$/, 'Usa un color hexadecimal. Ejemplo: #C9A227')
    .optional()
    .or(z.literal('')),
  catalogBanner: z.string().optional(),
});

export const brandSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  logo: z.string().optional(),
  description: z.string().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  description: z.string().optional(),
});

export const promotionSchema = z.object({
  productId: z.string().optional(),
  title: z.string().min(2, 'Título requerido'),
  description: z.string().optional(),
  discountPercent: z.coerce
    .number({ invalid_type_error: 'Ingresa un descuento válido.' })
    .min(0, 'El descuento no puede ser negativo.')
    .max(100, 'El descuento no puede superar 100%.'),
  startDate: z.string().min(1, 'Selecciona la fecha de inicio.'),
  endDate: z.string().min(1, 'Selecciona la fecha de fin.'),
});

export const paymentMethodSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  type: z.string().min(2, 'Tipo requerido'),
  currency: z.string().min(2, 'Moneda requerida'),
  description: z.string().optional(),
});

export const deliveryZoneSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  description: z.string().optional(),
  priceUsd: z.coerce
    .number({ invalid_type_error: 'Ingresa un precio válido.' })
    .min(0, 'El precio no puede ser negativo.'),
  priceBs: z.coerce
    .number({ invalid_type_error: 'Ingresa un precio válido.' })
    .min(0, 'El precio no puede ser negativo.'),
  fixedFeeUsd: z.coerce
    .number({ invalid_type_error: 'Ingresa una tarifa válida.' })
    .min(0, 'La tarifa no puede ser negativa.')
    .optional(),
  pricePerKmUsd: z.coerce
    .number({ invalid_type_error: 'Ingresa una tarifa válida.' })
    .min(0, 'La tarifa no puede ser negativa.')
    .optional(),
  minDistanceKm: z.coerce
    .number({ invalid_type_error: 'Ingresa una distancia válida.' })
    .min(0, 'La distancia no puede ser negativa.')
    .optional(),
  estimatedTime: z.string().min(2, 'Tiempo estimado requerido'),
  maxDistanceKm: z.coerce
    .number({ invalid_type_error: 'Ingresa una distancia válida.' })
    .min(0, 'La distancia no puede ser negativa.')
    .optional(),
  color: z.string().optional(),
  priority: z.coerce
    .number({ invalid_type_error: 'Ingresa una prioridad válida.' })
    .int('La prioridad debe ser un número entero.')
    .min(0, 'La prioridad no puede ser negativa.')
    .optional(),
  localLatitude: z.coerce.number().optional(),
  localLongitude: z.coerce.number().optional(),
  localRadiusKm: z.coerce
    .number({ invalid_type_error: 'Ingresa un radio válido.' })
    .min(0, 'El radio no puede ser negativo.')
    .optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  distanceFromCompanyKm: z.coerce.number().min(0).optional(),
  polygonCoordinates: z
    .array(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
      }),
    )
    .optional(),
  isActive: z.boolean().optional(),
});

export const deliverySettingsSchema = z.object({
  establishmentName: z.string().optional(),
  establishmentAddress: z.string().min(4, 'Dirección del establecimiento requerida'),
  establishmentLatitude: z.coerce.number({ invalid_type_error: 'Ingresa una latitud válida.' }).optional(),
  establishmentLongitude: z.coerce.number({ invalid_type_error: 'Ingresa una longitud válida.' }).optional(),
  googleMapsReference: z.string().optional(),
  baseDeliveryZone: z.string().optional(),
  deliveryBaseFeeUsd: z.coerce.number().min(0, 'La tarifa no puede ser negativa.').optional(),
  deliveryPricePerKmUsd: z.coerce.number().min(0, 'La tarifa no puede ser negativa.').optional(),
  deliveryMinimumFeeUsd: z.coerce.number().min(0, 'La tarifa mínima no puede ser negativa.').optional(),
  deliveryFarZoneSurchargeUsd: z.coerce.number().min(0, 'El recargo no puede ser negativo.').optional(),
  deliveryFreeFromUsd: z.coerce.number().min(0, 'El monto no puede ser negativo.').optional(),
});

export const deliveryEstimateSchema = z.object({
  address: z.string().min(3, 'Escribe una dirección o referencia.'),
  orderSubtotalUsd: z.coerce.number().min(0, 'El monto no puede ser negativo.').optional(),
});

export const chatSchema = z.object({
  senderPhone: z.string().min(7, 'Ingresa un teléfono válido.'),
  message: z.string().min(1, 'Escribe un mensaje.'),
});

