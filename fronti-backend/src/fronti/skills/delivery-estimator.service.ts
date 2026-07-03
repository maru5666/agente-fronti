import { Injectable } from '@nestjs/common';
import { DeliveryZonesService } from '../../delivery-zones/delivery-zones.service';
import { DeliveryEstimate } from './skill.types';

@Injectable()
export class DeliveryEstimatorService {
  constructor(
    private readonly deliveryZonesService: DeliveryZonesService,
  ) {}

  async estimateFromAddress(
    companyId: string,
    address: string,
  ): Promise<DeliveryEstimate> {
    const estimate = await this.deliveryZonesService.estimateDelivery({
      companyId,
      address,
    });

    return {
      formattedAddress: estimate.destinationAddress,
      latitude: estimate.destinationLatitude,
      longitude: estimate.destinationLongitude,
      distanceKm: estimate.distanceKm ?? undefined,
      durationMinutes: estimate.durationMinutes ?? undefined,
      deliveryZoneId: estimate.zoneId ?? undefined,
      deliveryZoneName: estimate.zoneName ?? undefined,
      deliveryFeeUsd: estimate.deliveryFeeUsd ?? undefined,
      deliveryFeeBs: estimate.deliveryFeeBs,
      navigationLink: estimate.googleMapsLink,
      routeCalculated: estimate.source === 'google_maps',
      usedLocalFallback: estimate.usedLocalFallback,
      message: estimate.message,
    };
  }

  async estimateFromCoordinates(
    companyId: string,
    destination: {
      latitude: number;
      longitude: number;
      formattedAddress?: string;
    },
  ): Promise<DeliveryEstimate> {
    const estimate = await this.deliveryZonesService.estimateDelivery({
      companyId,
      latitude: destination.latitude,
      longitude: destination.longitude,
    });

    return {
      formattedAddress: estimate.destinationAddress,
      latitude: destination.latitude,
      longitude: destination.longitude,
      distanceKm: estimate.distanceKm ?? undefined,
      durationMinutes: estimate.durationMinutes ?? undefined,
      deliveryZoneId: estimate.zoneId ?? undefined,
      deliveryZoneName: estimate.zoneName ?? undefined,
      deliveryFeeUsd: estimate.deliveryFeeUsd ?? undefined,
      deliveryFeeBs: estimate.deliveryFeeBs,
      navigationLink: estimate.googleMapsLink,
      routeCalculated: estimate.source === 'google_maps',
      usedLocalFallback: estimate.usedLocalFallback,
      message: estimate.message,
    };
  }
}
