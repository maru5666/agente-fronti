import { RecommendationsSkill } from './recommendations.skill';

describe('RecommendationsSkill', () => {
  it('se activa con recomienda', () => {
    const skill = new RecommendationsSkill({} as any);
    expect(
      skill.canHandle({
        companyId: 'company',
        senderPhone: 'phone',
        message: 'recomienda una crema',
        normalizedMessage: 'recomienda una crema',
        chatDto: { companyId: 'company', senderPhone: 'phone', message: 'recomienda una crema' },
      }),
    ).toBe(true);
  });
});
