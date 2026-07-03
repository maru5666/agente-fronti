import { Injectable, NotFoundException } from '@nestjs/common';
import {
  InternalNotificationPriority,
  InternalNotificationStatus,
  InternalNotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInternalNotificationDto } from './dto/create-internal-notification.dto';
import { UpdateInternalNotificationDto } from './dto/update-internal-notification.dto';

@Injectable()
export class InternalNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateInternalNotificationDto) {
    return this.prisma.internalNotification.create({
      data: {
        companyId: dto.companyId,
        orderId: dto.orderId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        priority: dto.priority ?? InternalNotificationPriority.media,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerAddress: dto.customerAddress,
        gpsLatitude: dto.gpsLatitude,
        gpsLongitude: dto.gpsLongitude,
        estimatedAmountUsd: dto.estimatedAmountUsd,
        payload: (dto.payload ?? {}) as Prisma.InputJsonValue,
      },
      include: this.notificationInclude,
    });
  }

  createDeliveryReview(input: {
    companyId: string;
    orderId?: string;
    customerName?: string | null;
    customerPhone?: string | null;
    customerAddress?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    products?: unknown;
    estimatedAmountUsd?: number | null;
    companyName?: string | null;
    reason?: string;
  }) {
    return this.create({
      companyId: input.companyId,
      orderId: input.orderId,
      type: InternalNotificationType.DELIVERY_REVIEW_REQUIRED,
      title: 'Nuevo delivery por confirmar',
      message:
        'El cliente envió una ubicación o dirección. Un operador debe confirmar costo de delivery y unidad disponible.',
      priority: InternalNotificationPriority.alta,
      customerName: input.customerName ?? undefined,
      customerPhone: input.customerPhone ?? undefined,
      customerAddress: input.customerAddress ?? undefined,
      gpsLatitude: input.latitude ?? undefined,
      gpsLongitude: input.longitude ?? undefined,
      estimatedAmountUsd: input.estimatedAmountUsd ?? undefined,
      payload: {
        products: input.products ?? [],
        company: input.companyName,
        hour: new Date().toISOString(),
        status: InternalNotificationStatus.pendiente_operador,
        reason: input.reason,
      },
    });
  }

  createOrderConfirmed(input: {
    companyId: string;
    orderId: string;
    customerName?: string | null;
    customerPhone?: string | null;
    customerAddress?: string | null;
    products?: unknown;
    estimatedAmountUsd?: number | null;
  }) {
    return this.create({
      companyId: input.companyId,
      orderId: input.orderId,
      type: InternalNotificationType.ORDER_CONFIRMED,
      title: 'Nuevo pedido confirmado',
      message: 'Nuevo pedido confirmado. Asignar delivery.',
      priority: InternalNotificationPriority.alta,
      customerName: input.customerName ?? undefined,
      customerPhone: input.customerPhone ?? undefined,
      customerAddress: input.customerAddress ?? undefined,
      estimatedAmountUsd: input.estimatedAmountUsd ?? undefined,
      payload: {
        products: input.products ?? [],
        status: InternalNotificationStatus.pendiente_operador,
        hour: new Date().toISOString(),
      },
    });
  }

  createPaymentReview(input: {
    companyId: string;
    orderId?: string;
    customerPhone: string;
    fileUrl?: string;
    reference?: string;
    amountUsd?: number;
    amountBs?: number;
  }) {
    return this.create({
      companyId: input.companyId,
      orderId: input.orderId,
      type: InternalNotificationType.PAYMENT_REVIEW_REQUIRED,
      title: 'Pago por verificar',
      message: 'El cliente envió un comprobante. Un operador debe verificar el pago antes de aprobarlo.',
      priority: InternalNotificationPriority.alta,
      customerPhone: input.customerPhone,
      estimatedAmountUsd: input.amountUsd,
      payload: {
        fileUrl: input.fileUrl,
        reference: input.reference,
        amountUsd: input.amountUsd,
        amountBs: input.amountBs,
        status: InternalNotificationStatus.pendiente_operador,
        hour: new Date().toISOString(),
      },
    });
  }

  findByCompany(companyId: string, status?: string) {
    const where: Prisma.InternalNotificationWhereInput = { companyId };

    if (status && status !== 'all') {
      where.status = status as InternalNotificationStatus;
    }

    return this.prisma.internalNotification.findMany({
      where,
      include: this.notificationInclude,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async countPending(companyId: string) {
    const count = await this.prisma.internalNotification.count({
      where: { companyId, status: InternalNotificationStatus.pendiente_operador },
    });

    return { count };
  }

  async update(id: string, dto: UpdateInternalNotificationDto) {
    const notification = await this.prisma.internalNotification.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!notification) {
      throw new NotFoundException('Solicitud interna no encontrada.');
    }

    return this.prisma.internalNotification.update({
      where: { id },
      data: dto,
      include: this.notificationInclude,
    });
  }

  private readonly notificationInclude = {
    order: {
      include: {
        items: { include: { product: true } },
        paymentMethod: true,
        deliveryZone: true,
      },
    },
  } satisfies Prisma.InternalNotificationInclude;
}
