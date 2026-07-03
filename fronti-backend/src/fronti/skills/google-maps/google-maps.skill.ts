import { Injectable } from '@nestjs/common';
import { DeliveryEstimatorService } from '../delivery-estimator.service';
import { SkillMemoryService } from '../skill-memory.service';
import { FrontiSkill, SkillContext, SkillResult } from '../skill.types';

@Injectable()
export class GoogleMapsSkill implements FrontiSkill {
  readonly name = 'google_maps';
  readonly description =
    'Convierte ubicaciones en coordenadas, calcula rutas y genera enlace de navegacion.';
  readonly priority = 93;

  constructor(
    private readonly deliveryEstimator: DeliveryEstimatorService,
    private readonly skillMemory: SkillMemoryService,
  ) {}

  canHandle(context: SkillContext) {
    return context.chatDto.type === 'location';
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const latitude = context.chatDto.latitude ?? context.chatDto.customerLatitude;
    const longitude =
      context.chatDto.longitude ?? context.chatDto.customerLongitude;

    if (latitude === undefined || longitude === undefined) {
      return {
        handled: true,
        response: 'No pude leer tu ubicacion. Intenta enviarla nuevamente.',
        data: { error: 'missing_coordinates' },
      };
    }

    const estimate = await this.deliveryEstimator
      .estimateFromCoordinates(context.companyId, {
        latitude: Number(latitude),
        longitude: Number(longitude),
      })
      .catch(() => null);

    if (!estimate) {
      return {
        handled: true,
        response:
          'Ubicacion recibida correctamente. Un operador confirmara el costo exacto del delivery.',
        data: { latitude, longitude, routeCalculated: false },
      };
    }

    await this.skillMemory.saveFavoriteAddress({
      companyId: context.companyId,
      senderPhone: context.senderPhone,
      address: estimate.formattedAddress,
      latitude: estimate.latitude,
      longitude: estimate.longitude,
    });
    await this.skillMemory.clearConversationState(
      context.companyId,
      context.senderPhone,
    );

    return {
      handled: true,
      response: estimate.message
        ? estimate.message
        : estimate.deliveryZoneId
          ? [
              'Ubicación recibida correctamente.',
              `Distancia estimada: ${estimate.distanceKm} km.`,
              `Costo de delivery: ${estimate.deliveryFeeUsd} USD.`,
              `Tiempo estimado: ${estimate.durationMinutes} min.`,
              '¿Deseas confirmar tu pedido?',
            ].join('\n')
        : [
            'Ubicación recibida correctamente.',
            estimate.distanceKm
              ? `Distancia estimada: ${estimate.distanceKm} km.`
              : 'No pude calcular la ruta automáticamente.',
            'Un operador puede confirmar el costo del delivery.',
          ].join('\n'),
      data: estimate,
    };
  }
}
