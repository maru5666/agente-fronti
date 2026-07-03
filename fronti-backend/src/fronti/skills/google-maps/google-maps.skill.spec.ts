import { GoogleMapsSkill } from './google-maps.skill';

describe('GoogleMapsSkill', () => {
  it('solo se activa con mensajes de ubicación', () => {
    const skill = new GoogleMapsSkill({} as any, {} as any);
    expect(
      skill.canHandle({
        companyId: 'company',
        senderPhone: 'phone',
        message: '',
        normalizedMessage: '',
        chatDto: { companyId: 'company', senderPhone: 'phone', type: 'location' },
      }),
    ).toBe(true);
  });
});
