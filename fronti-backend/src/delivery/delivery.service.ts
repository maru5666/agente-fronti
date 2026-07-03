import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GeocodedAddress, MapsService } from '../maps/maps.service';
import { InternalNotificationsService } from '../internal-notifications/internal-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryCalculationService } from './delivery-calculation.service';
import { DeliveryLocationDto } from './dto/delivery-location.dto';

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapsService: MapsService,
    private readonly deliveryCalculationService: DeliveryCalculationService,
    private readonly internalNotificationsService: InternalNotificationsService,
  ) {}

  async processLocation(dto: DeliveryLocationDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    const coordinates = {
      latitude: Number(dto.latitude),
      longitude: Number(dto.longitude),
    };

    if (!Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) {
      throw new BadRequestException(
        'No pude acceder a tu ubicación. Intenta nuevamente o escribe tu dirección.',
      );
    }

    const geocoded = await this.mapsService
      .reverseGeocode(coordinates)
      .catch((error) => {
        console.error('[Delivery location] Error en reverse geocoding:', error);
        return null;
      });

    const address = geocoded ?? {
      ...coordinates,
      formattedAddress: 'Ubicación compartida',
      neighborhood: null,
      city: null,
      state: null,
      country: null,
    };

    await this.saveCustomerAddress(dto, address);

    const calculation = await this.deliveryCalculationService
      .calculateFromLocation({
        companyId: dto.companyId,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      })
      .catch((error) => {
        console.error('[Delivery location] Error al calcular delivery:', error);
        return null;
      });

    if (!calculation || calculation.status !== 'calculated') {
      await this.createDeliveryReviewTask({
        dto,
        company,
        address,
        reason: !calculation
          ? 'No se pudo calcular la ruta automáticamente.'
          : 'La ruta requiere confirmación de un operador.',
      });

      return {
        response:
          'Recibí tu ubicación. Un operador confirmará el costo del delivery y te avisará enseguida.',
        address: this.buildAddressPayload(address),
        delivery: calculation,
      };
    }

    const locationLabel = this.buildLocationLabel(address);
    const costLine =
      calculation.costUsd !== null
        ? `USD ${calculation.costUsd.toFixed(2)}${
            calculation.costBs !== null ? ` / Bs. ${this.formatBs(calculation.costBs)}` : ''
          }`
        : 'pendiente de confirmar';

    return {
      response: [
        'Perfecto, recibí tu ubicación.',
        `Estás en: ${locationLabel}.`,
        `El delivery desde ${calculation.originName} tarda aproximadamente ${calculation.durationMin} minutos.`,
        `Costo: ${costLine}.`,
        '¿Confirmo el envío?',
      ].join('\n'),
      address: this.buildAddressPayload(address),
      delivery: calculation,
    };
  }

  private async saveCustomerAddress(
    dto: DeliveryLocationDto,
    address: GeocodedAddress,
  ) {
    await this.prisma.customerAddress.updateMany({
      where: {
        companyId: dto.companyId,
        customerPhone: dto.customerPhone,
        isFavorite: true,
      },
      data: { isFavorite: false },
    });

    await this.prisma.customerAddress.create({
      data: {
        companyId: dto.companyId,
        customerPhone: dto.customerPhone,
        label: 'Dirección principal',
        address: address.formattedAddress,
        formattedAddress: address.formattedAddress,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        country: address.country,
        latitude: address.latitude,
        longitude: address.longitude,
        isFavorite: true,
      },
    });
  }

  private buildAddressPayload(address: GeocodedAddress) {
    return {
      formattedAddress: address.formattedAddress,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      country: address.country,
      latitude: address.latitude,
      longitude: address.longitude,
    };
  }

  private buildLocationLabel(address: GeocodedAddress) {
    const parts = [
      address.neighborhood,
      address.city,
      address.state,
      address.country,
    ].filter(Boolean);

    return parts.length ? this.unique(parts).join(', ') : address.formattedAddress;
  }

  private unique(values: Array<string | null | undefined>) {
    return values.filter((value, index, array) => value && array.indexOf(value) === index);
  }

  private formatBs(value: number) {
    return new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private async createDeliveryReviewTask(input: {
    dto: DeliveryLocationDto;
    company: { name?: string | null; commercialName?: string | null };
    address: GeocodedAddress;
    reason: string;
  }) {
    const latestOrder = await this.prisma.order.findFirst({
      where: {
        companyId: input.dto.companyId,
        customerPhone: input.dto.customerPhone,
      },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const products =
      latestOrder?.items.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
      })) ?? [];

    await this.internalNotificationsService.createDeliveryReview({
      companyId: input.dto.companyId,
      orderId: latestOrder?.id,
      customerPhone: input.dto.customerPhone,
      customerAddress: input.address.formattedAddress,
      latitude: input.address.latitude,
      longitude: input.address.longitude,
      products,
      estimatedAmountUsd: latestOrder
        ? Number(latestOrder.totalUsd.toString())
        : undefined,
      companyName: input.company.commercialName ?? input.company.name,
      reason: input.reason,
    });
  }
}
