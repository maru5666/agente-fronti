import { DeliverySkill } from './delivery.skill';

describe('DeliverySkill', () => {
  it('se activa con delivery', () => {
    const skill = new DeliverySkill({} as any, {} as any);
    expect(
      skill.canHandle({
        companyId: 'company',
        senderPhone: 'phone',
        message: 'necesito delivery',
        normalizedMessage: 'necesito delivery',
        chatDto: {
          companyId: 'company',
          senderPhone: 'phone',
          message: 'necesito delivery',
        },
      }),
    ).toBe(true);
  });
});
