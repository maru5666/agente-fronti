import { InventorySkill } from './inventory.skill';

describe('InventorySkill', () => {
  it('se activa con consultas de stock', () => {
    const skill = new InventorySkill({} as any, {} as any);
    expect(
      skill.canHandle({
        companyId: 'company',
        senderPhone: 'phone',
        message: 'tienen arroz',
        normalizedMessage: 'tienen arroz',
        chatDto: { companyId: 'company', senderPhone: 'phone', message: 'tienen arroz' },
      }),
    ).toBe(true);
  });
});
