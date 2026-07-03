import { Injectable } from '@nestjs/common';
import { PromotionsService } from '../../../promotions/promotions.service';
import { FrontiSkill, SkillContext, SkillResult } from '../skill.types';
import { includesAny } from '../shared';

@Injectable()
export class PromotionsSkill implements FrontiSkill {
  readonly name = 'promociones';
  readonly description = 'Muestra promociones activas según el catálogo de la empresa.';
  readonly priority = 86;

  constructor(private readonly promotionsService: PromotionsService) {}

  canHandle(context: SkillContext) {
    return includesAny(context.normalizedMessage, [
      'promocion',
      'promoción',
      'oferta',
      'descuento',
      'combo',
      '2x1',
    ]);
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const promotions = await this.promotionsService.findActive(context.companyId);

    if (!promotions.length) {
      return {
        handled: true,
        response: 'Hoy no hay promociones activas. Puedo ayudarte a elegir productos disponibles.',
        data: { promotions: 0 },
      };
    }

    return {
      handled: true,
      response: `Promociones activas:\n${promotions
        .slice(0, 5)
        .map((promotion) => `- ${promotion.title}: ${promotion.discountPercent.toString()}% de descuento`)
        .join('\n')}`,
      data: {
        promotions: promotions.length,
        promotionIds: promotions.slice(0, 5).map((promotion) => promotion.id),
      },
    };
  }
}
