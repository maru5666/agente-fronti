import { OrdersSkill } from './orders.skill';

describe('OrdersSkill', () => {
  it('se activa con cancelar pedido', () => {
    const skill = new OrdersSkill(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(
      skill.canHandle({
        companyId: 'company',
        senderPhone: 'phone',
        message: 'cancelar pedido',
        normalizedMessage: 'cancelar pedido',
        chatDto: { companyId: 'company', senderPhone: 'phone', message: 'cancelar pedido' },
      }),
    ).toBe(true);
  });
});
