import { Injectable } from '@nestjs/common';
import { DeliveryZonesService } from '../../../delivery-zones/delivery-zones.service';
import { SkillMemoryService } from '../skill-memory.service';
import { FrontiSkill, SkillContext, SkillResult } from '../skill.types';
import { includesAny } from '../shared';

@Injectable()
export class DeliverySkill implements FrontiSkill {
  readonly name = 'delivery';
  readonly description =
    'Solicita ubicación o dirección y prepara el cálculo de distancia, tiempo y costo.';
  readonly priority = 90;

  constructor(
    private readonly deliveryZonesService: DeliveryZonesService,
    private readonly skillMemory: SkillMemoryService,
  ) {}

  canHandle(context: SkillContext) {
    return includesAny(context.normalizedMessage, [
      'delivery',
      'envio',
      'enviar',
      'domicilio',
      'cuanto cuesta el delivery',
      'cuanto tarda',
    ]);
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const zones = await this.deliveryZonesService.findByCompany(
      context.companyId,
    );

    await this.skillMemory.setConversationState(
      context.companyId,
      context.senderPhone,
      'delivery',
      'address',
      { zones: zones.length },
    );

    if (!zones.length) {
      return {
        handled: true,
        response: [
          'Claro. Comparte tu ubicación actual o escribe tu dirección.',
          'La empresa todavía no configuró zonas de delivery, pero puedo registrar la dirección y dejar el pedido pendiente de confirmación.',
        ].join('\n'),
        data: { deliveryZones: 0, awaitingAddress: true },
      };
    }

    return {
      handled: true,
      response:
        'Claro. Comparte tu ubicación actual o escribe tu dirección para calcular distancia, tiempo y costo.',
      data: { deliveryZones: zones.length, awaitingAddress: true },
    };
  }
}
