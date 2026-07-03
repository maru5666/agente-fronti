import { BillingSkill } from './billing.skill';

describe('BillingSkill', () => {
  it('se activa con solicitud de factura', () => {
    const skill = new BillingSkill({} as any);
    expect(
      skill.canHandle({
        companyId: 'company',
        senderPhone: 'phone',
        message: 'necesito factura',
        normalizedMessage: 'necesito factura',
        chatDto: { companyId: 'company', senderPhone: 'phone', message: 'necesito factura' },
      }),
    ).toBe(true);
  });
});
