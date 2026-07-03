import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryZonesService } from '../delivery-zones/delivery-zones.service';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';

export type DeliveryCalculationStatus =
  | 'calculated'
  | 'needs_operator_review'
  | 'out_of_coverage';

export type DeliveryCalculationResult = {
  originName: string;
  destinationAddress: string;
  distanceKm: number | null;
  durationMin: number | null;
  costUsd: number | null;
  costBs: number | null;
  status: DeliveryCalculationStatus;
  source: 'google_maps' | 'openstreetmap' | 'local' | 'unavailable';
  zoneName: string | null;
  googleMapsLink: string | null;
  usedLocalFallback: boolean;
};

@Injectable()
export class DeliveryCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryZonesService: DeliveryZonesService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async calculateFromLocation(input: {
    companyId: string;
    latitude: number;
    longitude: number;
    orderSubtotalUsd?: number;
  }): Promise<DeliveryCalculationResult> {
    const company = await this.prisma.company.findUnique({
      where: { id: input.companyId },
      select: {
        name: true,
        commercialName: true,
        establishmentName: true,
      },
    });

    const estimate = await this.deliveryZonesService.estimateDelivery({
      companyId: input.companyId,
      latitude: input.latitude,
      longitude: input.longitude,
      orderSubtotalUsd: input.orderSubtotalUsd,
    });

    const costUsd = this.toNumberOrNull(estimate.deliveryFeeUsd);
    const usdRate = await this.exchangeRateService.getCurrentUsdRate().catch(() => null);
    const costBs = costUsd !== null && usdRate ? Number((costUsd * usdRate).toFixed(2)) : null;
    const needsReview =
      estimate.source === 'unavailable' ||
      estimate.usedLocalFallback ||
      estimate.distanceKm === null ||
      estimate.durationMinutes === null ||
      costUsd === null;

    return {
      originName:
        company?.establishmentName ??
        company?.commercialName ??
        company?.name ??
        'Sucursal principal',
      destinationAddress: estimate.destinationAddress,
      distanceKm: this.toNumberOrNull(estimate.distanceKm),
      durationMin: this.toNumberOrNull(estimate.durationMinutes),
      costUsd,
      costBs,
      status: needsReview
        ? 'needs_operator_review'
        : estimate.available
          ? 'calculated'
          : 'out_of_coverage',
      source: estimate.source,
      zoneName: estimate.zoneName,
      googleMapsLink: estimate.googleMapsLink,
      usedLocalFallback: estimate.usedLocalFallback,
    };
  }

  private toNumberOrNull(value: unknown) {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
}
