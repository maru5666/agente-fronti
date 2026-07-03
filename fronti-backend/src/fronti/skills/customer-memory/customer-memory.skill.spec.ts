import { CustomerMemorySkill } from './customer-memory.skill';

describe('CustomerMemorySkill', () => {
  it('se activa con dirección guardada', () => {
    const skill = new CustomerMemorySkill({} as any);
    expect(
      skill.canHandle({
        companyId: 'company',
        senderPhone: 'phone',
        message: 'usar mi dirección guardada',
        normalizedMessage: 'usar mi direccion guardada',
        chatDto: { companyId: 'company', senderPhone: 'phone', message: 'usar mi dirección guardada' },
      }),
    ).toBe(true);
  });
});
