import { Injectable } from '@nestjs/common';
import { ChatDto } from '../dto/chat.dto';
import { DeliveryService } from '../../delivery/delivery.service';
import { ConversationMemoryService } from './conversation-memory.service';

@Injectable()
export class DeliveryConnectorService {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly memory: ConversationMemoryService,
  ) {}

  async handle(input: { chatDto: ChatDto; message: string; state?: { metadata?: unknown } | null }) {
    const latitude = input.chatDto.latitude ?? input.chatDto.customerLatitude;
    const longitude = input.chatDto.longitude ?? input.chatDto.customerLongitude;

    if (input.chatDto.type === 'location') {
      if (latitude === undefined || longitude === undefined) {
        return { response: 'No pude acceder a tu ubicación. Intenta nuevamente o escribe tu dirección.', result: { locationValid: false } };
      }
      const reply = await this.deliveryService.processLocation({
        companyId: input.chatDto.companyId,
        customerPhone: input.chatDto.customerPhone ?? input.chatDto.senderPhone,
        latitude: Number(latitude),
        longitude: Number(longitude),
        accuracy: input.chatDto.accuracy,
        timestamp: input.chatDto.timestamp,
      });
      return { response: reply.response, result: { delivery: reply.delivery, address: reply.address, locationValid: true } };
    }

    await this.memory.updateMetadata({
      companyId: input.chatDto.companyId,
      senderPhone: input.chatDto.senderPhone,
      metadata: { ...this.memory.getMetadata(input.state ?? null), deliveryContext: { requested: true } },
      currentIntent: 'delivery',
      awaitingField: 'address',
    });

    return {
      response: 'Claro. Comparte tu ubicación actual o escríbeme la dirección de entrega.',
      result: { awaitingAddress: true },
    };
  }
}
