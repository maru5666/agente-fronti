import { PromotionsSkill } from './promotions.skill';

describe('PromotionsSkill', () => {
  it('se activa con promociones', () => {
    const skill = new PromotionsSkill({} as any);
    expect(
      skill.canHandle({
        companyId: 'company',
        senderPhone: 'phone',
        message: 'que promociones tienen',
        normalizedMessage: 'que promociones tienen',
        chatDto: { companyId: 'company', senderPhone: 'phone', message: 'que promociones tienen' },
      }),
    ).toBe(true);
  });
});
