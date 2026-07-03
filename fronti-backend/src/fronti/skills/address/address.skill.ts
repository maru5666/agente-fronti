import { Injectable } from '@nestjs/common';
import { DeliveryEstimatorService } from '../delivery-estimator.service';
import { SkillMemoryService } from '../skill-memory.service';
import { FrontiSkill, SkillContext, SkillResult } from '../skill.types';
import { includesAny } from '../shared';

@Injectable()
export class AddressSkill implements FrontiSkill {
  readonly name = 'direccion';
  readonly description =
    'Detecta direcciones escritas por el cliente y evita tratarlas como productos.';
  readonly priority = 95;

  constructor(
    private readonly deliveryEstimator: DeliveryEstimatorService,
    private readonly skillMemory: SkillMemoryService,
  ) {}

  canHandle(context: SkillContext) {
    const looksLikeOrder =
      context.state?.currentIntent !== 'delivery' &&
      includesAny(context.normalizedMessage, [
        'pedido',
        'pedir',
        'comprar',
        'quiero un',
        'quiero una',
        'me llevo',
        'mandame',
        'agregame',
      ]);

    if (
      looksLikeOrder &&
      context.chatDto.type !== 'delivery_address' &&
      context.state?.awaitingField !== 'address'
    ) {
      return false;
    }

    return (
      context.chatDto.type === 'delivery_address' ||
      context.state?.awaitingField === 'address' ||
      includesAny(context.normalizedMessage, [
        'mi direccion es',
        'mi dirección es',
        'estoy en',
        'delivery a',
        'envio a',
        'barrio',
        'calle',
        'carrera',
        'avenida',
        'urbanizacion',
        'sector',
        'edificio',
        'residencias',
      ])
    );
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const address = this.extractAddress(context.message);

    if (!address) {
      await this.skillMemory.setConversationState(
        context.companyId,
        context.senderPhone,
        'delivery',
        'address',
      );

      return {
        handled: true,
        response: 'Claro. Escríbeme la dirección de entrega y la verifico.',
        data: { awaitingAddress: true },
      };
    }

    const estimate = await this.deliveryEstimator
      .estimateFromAddress(context.companyId, address)
      .catch(() => null);

    if (!estimate) {
      await this.skillMemory.clearConversationState(
        context.companyId,
        context.senderPhone,
      );

      return {
        handled: true,
        response: [
          'Perfecto, recibí tu dirección.',
          'No pude calcular la ruta automáticamente. Un operador puede confirmar el costo del delivery.',
        ].join('\n'),
        data: { address, mapsValidated: false },
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
      response: this.formatEstimate(estimate),
      data: {
        address,
        ...estimate,
      },
    };
  }

  private formatEstimate(estimate: {
    formattedAddress: string;
    distanceKm?: number;
    durationMinutes?: number;
    deliveryZoneId?: string;
    deliveryFeeUsd?: string | number;
    routeCalculated: boolean;
    message?: string;
  }) {
    if (estimate.message) {
      return estimate.message;
    }

    if (estimate.routeCalculated && estimate.deliveryZoneId) {
      return [
        `Delivery disponible para ${estimate.formattedAddress}.`,
        `Distancia estimada: ${estimate.distanceKm} km.`,
        `Tiempo estimado: ${estimate.durationMinutes} min.`,
        `Costo de envío: ${estimate.deliveryFeeUsd} USD.`,
        '?Deseas continuar con el pedido?',
      ].join('\n');
    }

    return [
      `Perfecto, guardé la dirección: ${estimate.formattedAddress}.`,
      estimate.distanceKm
        ? `Distancia estimada: ${estimate.distanceKm} km.`
        : 'Un operador confirmar? el costo del delivery.',
      'Dejaré el pedido pendiente de confirmación si deseas continuar.',
    ].join('\n');
  }

  private extractAddress(message: string) {
    return message
      .replace(/^mi direccion es\s*/i, '')
      .replace(/^mi dirección es\s*/i, '')
      .replace(/^estoy en\s*/i, '')
      .replace(/^delivery a\s*/i, '')
      .replace(/^envio a\s*/i, '')
      .replace(/^envío a\s*/i, '')
      .trim();
  }}

