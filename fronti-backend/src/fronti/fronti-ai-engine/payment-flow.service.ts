import { Injectable } from '@nestjs/common';
import { PaymentMethodsService } from '../../payment-methods/payment-methods.service';
import { ConversationMemoryService } from './conversation-memory.service';

@Injectable()
export class PaymentFlowService {
  constructor(
    private readonly paymentMethods: PaymentMethodsService,
    private readonly memory: ConversationMemoryService,
  ) {}

  async handle(input: { companyId: string; senderPhone: string; message: string; state?: { metadata?: unknown } | null }) {
    const methods = await this.paymentMethods.findByCompany(input.companyId);
    if (!methods.length) return { response: 'Todavía no hay métodos de pago activos para esta empresa.', result: { methods: 0 } };
    const text = input.message.toLowerCase();
    const match = methods.find((method: any) => text.includes(String(method.name).toLowerCase()) || text.includes(String(method.currency).toLowerCase()));
    if (match) return { response: `Sí, puedes pagar con ${match.name} en ${match.currency}.`, result: { method: match.name } };
    return { response: `Puedes pagar con: ${methods.map((method: any) => `${method.name} (${method.currency})`).join(', ')}.`, result: { methods: methods.length } };
  }

  async handleCurrency(input: { companyId: string; senderPhone: string; message: string; state?: { metadata?: unknown } | null }) {
    return this.handle(input);
  }
}
