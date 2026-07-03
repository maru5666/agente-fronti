import { Injectable } from '@nestjs/common';
import { OrdersService } from '../../orders/orders.service';

@Injectable()
export class OrderManagerService {
  constructor(private readonly ordersService: OrdersService) {}

  async confirm(input: { companyId: string; senderPhone: string; message: string; state?: { metadata?: unknown } | null }) {
    const text = input.message.toLowerCase();
    if (!/si|sí|confirmo|dale|ok/.test(text)) {
      return { response: 'Perfecto, dime qué quieres ajustar del pedido.', result: { confirmed: false } };
    }
    return { response: 'Perfecto. Para cerrar el pedido necesito confirmar el método de pago y la dirección de entrega.', result: { confirmed: true } };
  }

  async draft() {
    return { response: 'Puedo ayudarte a armar el pedido. Dime producto, cantidad, dirección y método de pago.', result: { draft: true } };
  }
}
