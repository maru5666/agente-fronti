import { Injectable } from '@nestjs/common';
import { ProductAgentService } from '../../product-agent.service';
import { FrontiSkill, SkillContext, SkillResult } from '../skill.types';
import { includesAny } from '../shared';

@Injectable()
export class RecommendationsSkill implements FrontiSkill {
  readonly name = 'recomendaciones';
  readonly description = 'Sugiere productos relacionados sin inventar y validando stock.';
  readonly priority = 70;

  constructor(private readonly productAgent: ProductAgentService) {}

  canHandle(context: SkillContext) {
    return includesAny(context.normalizedMessage, [
      'recomienda',
      'recomiendas',
      'sugiere',
      'que me sirve',
      'producto relacionado',
      'rutina',
    ]);
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const productResponse = await this.productAgent.respond({
      companyId: context.companyId,
      senderPhone: context.senderPhone,
      message: context.message,
      normalizedMessage: context.normalizedMessage,
      intent: 'recomendacion',
      state: context.state,
    });

    return {
      handled: true,
      response: productResponse.response,
      data: productResponse.result,
    };
  }
}
