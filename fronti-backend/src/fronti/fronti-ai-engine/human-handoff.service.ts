import { Injectable } from '@nestjs/common';
import { InternalNotificationsService } from '../../internal-notifications/internal-notifications.service';

@Injectable()
export class HumanHandoffService {
  constructor(private readonly notifications: InternalNotificationsService) {}

  async escalate(input: { companyId: string; senderPhone: string; message: string; reason: string }) {
    await this.notifications.create({
      companyId: input.companyId,
      type: 'HUMAN_SUPPORT_REQUIRED',
      title: 'Cliente necesita atención',
      message: input.reason,
      priority: 'alta',
      payload: { customerPhone: input.senderPhone, message: input.message },
    }).catch(() => null);
    return { response: 'Lamento que estés pasando por eso. Cuéntame qué ocurrió y buscamos la mejor solución.', result: { escalated: true } };
  }
}

