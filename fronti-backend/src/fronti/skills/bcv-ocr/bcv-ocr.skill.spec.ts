import { BcvOcrSkill } from './bcv-ocr.skill';

describe('BcvOcrSkill', () => {
  it('se activa con tasa BCV', () => {
    const skill = new BcvOcrSkill({} as any);
    expect(
      skill.canHandle({
        companyId: 'company',
        senderPhone: 'phone',
        message: 'tasa bcv',
        normalizedMessage: 'tasa bcv',
        chatDto: { companyId: 'company', senderPhone: 'phone', message: 'tasa bcv' },
      }),
    ).toBe(true);
  });
});
