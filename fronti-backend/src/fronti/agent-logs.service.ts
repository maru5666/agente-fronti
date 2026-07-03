import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CriticReview, FrontiIntent, FrontiTool } from './agent.types';

@Injectable()
export class AgentLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async save(input: {
    companyId: string;
    senderPhone: string;
    message: string;
    intent: FrontiIntent;
    tool: FrontiTool;
    skill?: string | null;
    toolResult: Record<string, unknown>;
    generatedResponse: string;
    criticReview: CriticReview;
    finalResponse: string;
  }) {
    console.log('Fronti intent detectado:', input.intent);
    console.log('Fronti herramienta usada:', input.tool);
    console.log('Fronti skill usada:', input.skill ?? 'sin_skill');
    console.log('Fronti resultado herramienta:', input.toolResult);
    console.log('Fronti respuesta generada:', input.generatedResponse);
    console.log('Fronti revision critic:', input.criticReview);
    console.log('Fronti respuesta final:', input.finalResponse);

    return this.prisma.agentLog.create({
      data: {
        companyId: input.companyId,
        senderPhone: input.senderPhone,
        message: input.message,
        intent: input.intent,
        tool: input.tool,
        skill: input.skill,
        toolResult: input.toolResult as Prisma.InputJsonValue,
        generatedResponse: input.generatedResponse,
        criticReview: input.criticReview as unknown as Prisma.InputJsonValue,
        finalResponse: input.finalResponse,
      },
    });
  }
}
