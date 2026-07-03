import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CompaniesService } from '../companies/companies.service';
import { DeliveryZonesService } from '../delivery-zones/delivery-zones.service';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { InternalNotificationsService } from '../internal-notifications/internal-notifications.service';
import { MapsService } from '../maps/maps.service';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { SubmitPaymentProofDto } from './dto/submit-payment-proof.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
    private readonly deliveryZonesService: DeliveryZonesService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly mapsService: MapsService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly internalNotificationsService: InternalNotificationsService,
  ) {}

  async create(createOrderDto: CreateOrderDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: createOrderDto.companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    const productIds = createOrderDto.items.map((item) => item.productId);
    const uniqueProductIds = [...new Set(productIds)];

    if (productIds.length !== uniqueProductIds.length) {
      throw new BadRequestException(
        'No repitas productos en el mismo pedido. Agrupa las cantidades.',
      );
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: uniqueProductIds },
        companyId: createOrderDto.companyId,
        isActive: true,
      },
    });

    if (products.length !== uniqueProductIds.length) {
      throw new BadRequestException(
        'Uno o mas productos no existen o no pertenecen a esta empresa.',
      );
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const usdRate = await this.exchangeRateService.getCurrentUsdRateDecimal();
    let subtotalUsd = new Decimal(0);
    let subtotalBs = new Decimal(0);

    const orderItems = createOrderDto.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new BadRequestException('Producto no encontrado.');
      }

      const quantity = new Decimal(item.quantity);
      const itemSubtotalUsd = product.priceUsd.mul(quantity);
      const unitPriceBs = this.exchangeRateService.usdToBs(
        product.priceUsd,
        usdRate,
      );
      const itemSubtotalBs = unitPriceBs.mul(quantity).toDecimalPlaces(2);
      subtotalUsd = subtotalUsd.add(itemSubtotalUsd);
      subtotalBs = subtotalBs.add(itemSubtotalBs);

      return {
        productId: product.id,
        quantity: item.quantity,
        unitPriceUsd: product.priceUsd,
        unitPriceBs,
        subtotalUsd: itemSubtotalUsd,
        subtotalBs: itemSubtotalBs,
      };
    });

    const deliveryData = await this.resolveDeliveryData(company, createOrderDto);
    const paymentMethod = await this.resolvePaymentMethod(createOrderDto);
    const deliveryFeeUsd =
      deliveryData.deliveryFeeUsd ??
      deliveryData.deliveryZone?.fixedFeeUsd ??
      deliveryData.deliveryZone?.priceUsd ??
      new Decimal(0);
    const deliveryFeeBs =
      deliveryData.deliveryFeeBs ??
      this.exchangeRateService.usdToBs(deliveryFeeUsd, usdRate);

    const order = await this.prisma.order.create({
      data: {
        companyId: createOrderDto.companyId,
        customerName: createOrderDto.customerName,
        customerPhone: createOrderDto.customerPhone,
        customerAddress: createOrderDto.customerAddress,
        customerLatitude: deliveryData.customerLatitude,
        customerLongitude: deliveryData.customerLongitude,
        validatedAddress: deliveryData.validatedAddress,
        deliveryZoneId: deliveryData.deliveryZone?.id,
        paymentMethodId: paymentMethod?.id,
        subtotalUsd,
        subtotalBs,
        deliveryFeeUsd,
        deliveryFeeBs,
        totalUsd: subtotalUsd.add(deliveryFeeUsd),
        totalBs: subtotalBs.add(deliveryFeeBs),
        distanceKm: deliveryData.distanceKm,
        estimatedDeliveryMinutes: deliveryData.estimatedDeliveryMinutes,
        googleMapsLink: deliveryData.googleMapsLink,
        status: createOrderDto.status ?? 'pending',
        items: {
          create: orderItems,
        },
      },
      include: this.orderInclude,
    });

    await this.saveCustomerAddress(createOrderDto, deliveryData);
    await this.createOperatorTasksAfterOrder(order, deliveryData, company);

    return order;
  }

  async findByCompany(companyId: string, limit?: number) {
    await this.companiesService.ensureExists(companyId);

    return this.prisma.order.findMany({
      where: { companyId },
      include: this.orderInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getSummary(companyId: string) {
    await this.companiesService.ensureExists(companyId);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [pendingOrders, activeDeliveries, todayTotals, recentOrders] =
      await Promise.all([
        this.prisma.order.count({
          where: {
            companyId,
            status: { in: ['pending', 'pendiente_confirmacion_operador'] },
          },
        }),
        this.prisma.order.count({
          where: {
            companyId,
            status: { in: ['out_for_delivery', 'en_camino', 'delivery_asignado'] },
          },
        }),
        this.prisma.order.aggregate({
          where: {
            companyId,
            createdAt: { gte: todayStart },
            status: { notIn: ['cancelled', 'cancelado'] },
          },
          _sum: { totalUsd: true, totalBs: true },
          _count: { id: true },
        }),
        this.findByCompany(companyId, 6),
      ]);

    return {
      pendingOrders,
      activeDeliveries,
      todayOrders: todayTotals._count.id,
      todayRevenueUsd: todayTotals._sum.totalUsd ?? new Decimal(0),
      todayRevenueBs: todayTotals._sum.totalBs ?? new Decimal(0),
      recentOrders,
    };
  }

  async findByStatus(companyId: string, status: string) {
    await this.companiesService.ensureExists(companyId);
    this.assertOrderStatus(status);

    return this.prisma.order.findMany({
      where: { companyId, status },
      include: this.orderInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: string) {
    this.assertOrderStatus(status);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException('Pedido no encontrado.');
      }

      const shouldDiscountStock =
        ['confirmed', 'paid', 'pago_confirmado', 'preparing', 'en_preparacion'].includes(status) &&
        !order.stockDiscounted;

      if (shouldDiscountStock) {
        for (const item of order.items) {
          const updated = await tx.product.updateMany({
            where: {
              id: item.productId,
              companyId: order.companyId,
              stock: { gte: item.quantity },
              isActive: true,
            },
            data: { stock: { decrement: item.quantity } },
          });

          if (updated.count !== 1) {
            throw new BadRequestException(
              'Stock insuficiente para confirmar este pedido.',
            );
          }
        }
      }

      return tx.order.update({
        where: { id },
        data: {
          status: status as OrderStatus,
          stockDiscounted: order.stockDiscounted || shouldDiscountStock,
        },
        include: this.orderInclude,
      });
    });
  }

  async getLatestByCustomer(companyId: string, customerPhone: string) {
    return this.prisma.order.findFirst({
      where: { companyId, customerPhone },
      include: this.orderInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFavoriteAddress(companyId: string, customerPhone: string) {
    return this.prisma.customerAddress.findFirst({
      where: { companyId, customerPhone, isFavorite: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submitPaymentProof(dto: SubmitPaymentProofDto) {
    await this.companiesService.ensureExists(dto.companyId);
    const order = dto.orderId
      ? await this.prisma.order.findFirst({
          where: { id: dto.orderId, companyId: dto.companyId },
          include: this.orderInclude,
        })
      : await this.getLatestByCustomer(dto.companyId, dto.customerPhone);

    const proof = await this.prisma.paymentProof.create({
      data: {
        companyId: dto.companyId,
        orderId: order?.id,
        customerPhone: dto.customerPhone,
        fileUrl: dto.fileUrl,
        reference: dto.reference,
        amountUsd: dto.amountUsd,
        amountBs: dto.amountBs,
        status: 'pago_en_revision',
      },
    });

    if (order) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'pago_en_revision' },
      });
    }

    await this.internalNotificationsService.createPaymentReview({
      companyId: dto.companyId,
      orderId: order?.id,
      customerPhone: dto.customerPhone,
      fileUrl: dto.fileUrl,
      reference: dto.reference,
      amountUsd: dto.amountUsd,
      amountBs: dto.amountBs,
    });

    return {
      proof,
      response:
        'Recibí el comprobante. Lo enviaré a verificación y te avisaremos apenas sea confirmado.',
    };
  }

  private async resolveDeliveryData(company: any, createOrderDto: CreateOrderDto) {
    let needsOperatorReview = false;
    let operatorReviewReason: string | undefined;

    if (
      createOrderDto.customerAddress ||
      (createOrderDto.customerLatitude !== undefined &&
        createOrderDto.customerLongitude !== undefined)
    ) {
      const estimate = await this.deliveryZonesService
        .estimateDelivery({
          companyId: createOrderDto.companyId,
          address: createOrderDto.customerAddress,
          latitude: createOrderDto.customerLatitude,
          longitude: createOrderDto.customerLongitude,
          orderSubtotalUsd: 0,
        })
        .catch(() => null);

      if (estimate) {
        const deliveryZone = estimate.zoneId
          ? await this.deliveryZonesService.findOneOrThrow(estimate.zoneId)
          : undefined;

        return {
          customerLatitude: estimate.destinationLatitude,
          customerLongitude: estimate.destinationLongitude,
          validatedAddress: estimate.destinationAddress,
          distanceKm:
            estimate.distanceKm !== null
              ? new Decimal(estimate.distanceKm)
              : undefined,
          estimatedDeliveryMinutes: estimate.durationMinutes ?? undefined,
          googleMapsLink: estimate.googleMapsLink,
          deliveryZone,
          deliveryFeeUsd:
            estimate.deliveryFeeUsd !== null
              ? new Decimal(estimate.deliveryFeeUsd)
              : undefined,
          deliveryFeeBs: estimate.deliveryFeeBs
            ? new Decimal(estimate.deliveryFeeBs)
            : undefined,
          needsOperatorReview: !estimate.available || estimate.usedLocalFallback,
          operatorReviewReason: !estimate.available
            ? 'Dirección fuera de cobertura o sin zona confirmada.'
            : estimate.usedLocalFallback
              ? 'La ruta se estimó con respaldo local.'
              : undefined,
        };
      }

      needsOperatorReview = true;
      operatorReviewReason =
        'No se pudo calcular la ruta automáticamente con el estimador de delivery.';
    }

    let customerLatitude = createOrderDto.customerLatitude;
    let customerLongitude = createOrderDto.customerLongitude;
    let validatedAddress: string | undefined;

    if (!customerLatitude || !customerLongitude) {
      if (createOrderDto.customerAddress) {
        const geocoded = await this.mapsService
          .validateAddress(createOrderDto.customerAddress)
          .catch(() => null);

        if (geocoded) {
          customerLatitude = geocoded.latitude;
          customerLongitude = geocoded.longitude;
          validatedAddress = geocoded.formattedAddress;
        } else {
          validatedAddress = createOrderDto.customerAddress;
          needsOperatorReview = true;
          operatorReviewReason =
            operatorReviewReason ??
            'No se pudo validar la dirección automáticamente.';
        }
      }
    } else {
      const geocoded = await this.mapsService
        .reverseGeocodeCoordinates({
          latitude: customerLatitude,
          longitude: customerLongitude,
        })
        .catch(() => null);

      validatedAddress =
        geocoded?.formattedAddress ?? createOrderDto.customerAddress;
    }

    let distanceKm: Decimal | undefined;
    let estimatedDeliveryMinutes: number | undefined;
    let googleMapsLink: string | undefined;

    if (
      company.latitude &&
      company.longitude &&
      customerLatitude &&
      customerLongitude
    ) {
      const distance = await this.mapsService
        .calculateDistance(
          {
            latitude: Number(company.latitude.toString()),
            longitude: Number(company.longitude.toString()),
          },
          {
            latitude: customerLatitude,
            longitude: customerLongitude,
          },
        )
        .catch(() => null);

      if (distance) {
        distanceKm = new Decimal(distance.distanceKm);
        estimatedDeliveryMinutes = distance.durationMinutes;
        googleMapsLink = this.mapsService.generateNavigationLink({
          latitude: customerLatitude,
          longitude: customerLongitude,
        });
      } else {
        needsOperatorReview = true;
        operatorReviewReason =
          operatorReviewReason ??
          'No se pudo calcular la distancia real automáticamente.';
      }
    }

    let deliveryZone = createOrderDto.deliveryZoneId
      ? await this.deliveryZonesService.findOneOrThrow(
          createOrderDto.deliveryZoneId,
        )
      : undefined;

    if (deliveryZone && deliveryZone.companyId !== createOrderDto.companyId) {
      throw new BadRequestException(
        'La zona de delivery no pertenece a esta empresa.',
      );
    }

    if (!deliveryZone && distanceKm) {
      deliveryZone = await this.deliveryZonesService.findByDistance(
        createOrderDto.companyId,
        Number(distanceKm.toString()),
      );
    }

    if (!deliveryZone && (customerLatitude || createOrderDto.customerAddress)) {
      needsOperatorReview = true;
      operatorReviewReason =
        operatorReviewReason ??
        'No encontramos una zona de delivery configurada para esa dirección.';
    }

    return {
      customerLatitude,
      customerLongitude,
      validatedAddress,
      distanceKm,
      estimatedDeliveryMinutes:
        estimatedDeliveryMinutes ??
        this.parseEstimatedMinutes(deliveryZone?.estimatedTime),
      googleMapsLink,
      deliveryZone,
      needsOperatorReview,
      operatorReviewReason,
    };
  }

  private async resolvePaymentMethod(createOrderDto: CreateOrderDto) {
    if (!createOrderDto.paymentMethodId) {
      return undefined;
    }

    const paymentMethod = await this.paymentMethodsService.findOneOrThrow(
      createOrderDto.paymentMethodId,
    );

    if (
      paymentMethod.companyId !== createOrderDto.companyId ||
      !paymentMethod.isActive
    ) {
      throw new BadRequestException(
        'El metodo de pago no esta disponible para esta empresa.',
      );
    }

    return paymentMethod;
  }

  private async saveCustomerAddress(
    createOrderDto: CreateOrderDto,
    deliveryData: {
      customerLatitude?: number;
      customerLongitude?: number;
      validatedAddress?: string;
    },
  ) {
    if (!deliveryData.validatedAddress && !createOrderDto.customerAddress) {
      return;
    }

    await this.prisma.customerAddress.updateMany({
      where: {
        companyId: createOrderDto.companyId,
        customerPhone: createOrderDto.customerPhone,
        isFavorite: true,
      },
      data: { isFavorite: false },
    });

    await this.prisma.customerAddress.create({
      data: {
        companyId: createOrderDto.companyId,
        customerPhone: createOrderDto.customerPhone,
        label: 'Dirección principal',
        address:
          deliveryData.validatedAddress ??
          createOrderDto.customerAddress ??
          'Ubicación GPS',
        latitude: deliveryData.customerLatitude,
        longitude: deliveryData.customerLongitude,
        isFavorite: true,
      },
    });
  }

  private async createOperatorTasksAfterOrder(
    order: any,
    deliveryData: {
      needsOperatorReview?: boolean;
      operatorReviewReason?: string;
      customerLatitude?: number;
      customerLongitude?: number;
      validatedAddress?: string;
    },
    company: { name?: string | null; commercialName?: string | null },
  ) {
    const products = order.items.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
    }));
    const estimatedAmountUsd = Number(order.totalUsd.toString());

    if (deliveryData.needsOperatorReview) {
      await this.internalNotificationsService.createDeliveryReview({
        companyId: order.companyId,
        orderId: order.id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress:
          deliveryData.validatedAddress ??
          order.validatedAddress ??
          order.customerAddress,
        latitude: deliveryData.customerLatitude,
        longitude: deliveryData.customerLongitude,
        products,
        estimatedAmountUsd,
        companyName: company.commercialName ?? company.name,
        reason: deliveryData.operatorReviewReason,
      });
    }

    if (order.status === 'pendiente_confirmacion_operador') {
      await this.internalNotificationsService.createOrderConfirmed({
        companyId: order.companyId,
        orderId: order.id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.validatedAddress ?? order.customerAddress,
        products,
        estimatedAmountUsd,
      });
    }
  }

  private parseEstimatedMinutes(value?: string) {
    if (!value) {
      return undefined;
    }

    const match = value.match(/\d+/);
    return match ? Number(match[0]) : undefined;
  }

  private assertOrderStatus(status: string): asserts status is OrderStatus {
    if (
      ![
        'pending',
        'confirmed',
        'paid',
        'preparing',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'pendiente_datos',
        'pendiente_confirmacion_cliente',
        'pendiente_confirmacion_operador',
        'pendiente_pago',
        'pago_en_revision',
        'pago_confirmado',
        'pendiente_delivery',
        'delivery_asignado',
        'en_preparacion',
        'en_camino',
        'entregado',
        'cancelado',
      ].includes(status)
    ) {
      throw new BadRequestException('Estado de pedido inválido.');
    }
  }

  private readonly orderInclude = {
    items: {
      include: { product: true },
    },
    deliveryZone: true,
    paymentMethod: true,
  } satisfies Prisma.OrderInclude;
}
