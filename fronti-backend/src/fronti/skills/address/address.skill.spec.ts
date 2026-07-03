import { AddressSkill } from './address.skill';

describe('AddressSkill', () => {
  it('detecta una direccion escrita', () => {
    const skill = new AddressSkill({} as any, {} as any);
    expect(
      skill.canHandle({
        companyId: 'company',
        senderPhone: 'phone',
        message: 'Barrio Sucre',
        normalizedMessage: 'barrio sucre',
        chatDto: {
          companyId: 'company',
          senderPhone: 'phone',
          message: 'Barrio Sucre',
        },
      }),
    ).toBe(true);
  });
});
