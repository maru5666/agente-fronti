import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SkillMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  setConversationState(
    companyId: string,
    senderPhone: string,
    currentIntent: string | null,
    awaitingField: string | null,
    metadata: Prisma.InputJsonValue = {},
  ) {
    return this.prisma.conversationState.upsert({
      where: {
        companyId_senderPhone: {
          companyId,
          senderPhone,
        },
      },
      create: {
        companyId,
        senderPhone,
        currentIntent,
        awaitingField,
        metadata,
      },
      update: {
        currentIntent,
        awaitingField,
        metadata,
      },
    });
  }

  clearConversationState(companyId: string, senderPhone: string) {
    return this.setConversationState(companyId, senderPhone, null, null);
  }

  async saveFavoriteAddress(input: {
    companyId: string;
    senderPhone: string;
    address: string;
    latitude: number;
    longitude: number;
    label?: string;
  }) {
    await this.prisma.customerAddress.updateMany({
      where: {
        companyId: input.companyId,
        customerPhone: input.senderPhone,
        isFavorite: true,
      },
      data: { isFavorite: false },
    });

    return this.prisma.customerAddress.create({
      data: {
        companyId: input.companyId,
        customerPhone: input.senderPhone,
        label: input.label ?? 'Direccion principal',
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        isFavorite: true,
      },
    });
  }
}
