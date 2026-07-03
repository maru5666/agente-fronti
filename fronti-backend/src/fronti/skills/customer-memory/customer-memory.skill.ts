import { Injectable } from '@nestjs/common';
import { OrdersService } from '../../../orders/orders.service';
import { FrontiSkill, SkillContext, SkillResult } from '../skill.types';
import { includesAny } from '../shared';

@Injectable()
export class CustomerMemorySkill implements FrontiSkill {
  readonly name = 'memoria_clientes';
  readonly description = 'Recuerda direcciones, pedidos frecuentes y preferencias del cliente.';
  readonly priority = 74;

  constructor(private readonly ordersService: OrdersService) {}

  canHandle(context: SkillContext) {
    return includesAny(context.normalizedMessage, [
      'mi direccion de siempre',
      'mi dirección de siempre',
      'direccion guardada',
      'dirección guardada',
      'lo de siempre',
      'pedido frecuente',
    ]);
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const address = await this.ordersService.getFavoriteAddress(
      context.companyId,
      context.senderPhone,
    );
    const latest = await this.ordersService.getLatestByCustomer(
      context.companyId,
      context.senderPhone,
    );

    if (!address && !latest) {
      return {
        handled: true,
        response: 'Todavía no tengo historial de este cliente. Puedo guardar su dirección y preferencias desde este pedido.',
        data: { hasMemory: false },
      };
    }

    const lines = [
      address ? `Dirección guardada: ${address.address}.` : null,
      latest ? `Último pedido: ${latest.items.map((item) => item.product?.name ?? item.productId).join(', ')}.` : null,
    ].filter(Boolean);

    return {
      handled: true,
      response: lines.join('\n'),
      data: {
        hasMemory: true,
        addressId: address?.id,
        latestOrderId: latest?.id,
      },
    };
  }
}
