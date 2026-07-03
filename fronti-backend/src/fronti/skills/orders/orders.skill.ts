import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, Product } from '@prisma/client';
import axios from 'axios';
import { ExchangeRateService } from '../../../exchange-rate/exchange-rate.service';
import { OrdersService } from '../../../orders/orders.service';
import { PaymentMethodsService } from '../../../payment-methods/payment-methods.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProductsService } from '../../../products/products.service';
import { FrontiSkill, SkillContext, SkillResult } from '../skill.types';
import { includesAny } from '../shared';

type OrderDraftItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceUsd: string;
  unitPriceBs: string;
};

type OrderDraft = {
  status: 'collecting_data' | 'pending_confirmation';
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  paymentMethodId?: string;
  paymentMethodName?: string;
  items: OrderDraftItem[];
  missingFields: string[];
  sourceChannel: 'whatsapp' | 'fronti_chat' | 'api';
  extractedFrom: string;
  updatedAt: string;
};

type ExtractedOrderData = {
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  paymentText?: string;
  requestedProducts: Array<{
    query: string;
    quantity: number;
  }>;
};

@Injectable()
export class OrdersSkill implements FrontiSkill {
  readonly name = 'pedidos';
  readonly description =
    'Atiende clientes, extrae datos informales, arma pedidos, pide confirmacion y guarda ordenes reales.';
  readonly priority = 84;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly productsService: ProductsService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  canHandle(context: SkillContext) {
    const draft = this.getDraft(context);

    if (draft) {
      return true;
    }

    if (this.isConfirmationMessage(context.normalizedMessage)) {
      return true;
    }

    if (this.isPriceOnlyIntent(context.normalizedMessage)) {
      return false;
    }

    return includesAny(context.normalizedMessage, [
      'pedido',
      'pedir',
      'comprar',
      'compra',
      'orden',
      'ordenar',
      'encargar',
      'quiero un',
      'quiero una',
      'quiero el',
      'quiero la',
      'me llevo',
      'mandame',
      'mandeme',
      'agregame',
      'agrega',
      'confirmo',
      'cancelar pedido',
      'modificar pedido',
      'estado del pedido',
    ]);
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const latest = await this.ordersService.getLatestByCustomer(
      context.companyId,
      context.senderPhone,
    );
    const draft = this.getDraft(context);

    if (draft && this.isPriceOnlyIntent(context.normalizedMessage)) {
      return {
        handled: true,
        response: this.buildDraftPriceMessage(draft),
        data: { action: 'draft_price', draft },
      };
    }

    if (this.isStatusIntent(context.normalizedMessage)) {
      return {
        handled: true,
        response: latest
          ? `Tu pedido mas reciente esta ${this.translateStatus(latest.status)}.`
          : 'No veo pedidos recientes con este telefono. Si quieres, puedo ayudarte a armar uno nuevo.',
        data: { action: 'status', orderId: latest?.id, status: latest?.status },
      };
    }

    if (this.isCancelIntent(context.normalizedMessage)) {
      if (draft) {
        await this.clearDraft(context);
        return {
          handled: true,
          response:
            'Listo, cancele ese pedido antes de guardarlo. Si quieres cambiar algo, puedes escribirme el pedido nuevamente.',
          data: { action: 'cancel_draft' },
        };
      }

      if (!latest) {
        return {
          handled: true,
          response: 'No veo pedidos recientes para cancelar. Si quieres modificar algo, dime que necesitas y lo revisamos.',
          data: { action: 'cancel', found: false },
        };
      }

      const order = await this.ordersService.updateStatus(
        latest.id,
        'cancelled',
      );
      return {
        handled: true,
        response: `Listo, cancele el pedido ${order.id.slice(0, 8)}.`,
        data: { action: 'cancel', orderId: order.id },
      };
    }

    if (draft?.status === 'pending_confirmation') {
      if (this.isPositiveConfirmation(context.normalizedMessage)) {
        return this.confirmDraft(context, draft);
      }

      if (this.isNegativeConfirmation(context.normalizedMessage)) {
        await this.clearDraft(context);
        return {
          handled: true,
          response:
            'Sin problema, no guarde el pedido. Si quieres modificarlo, escribeme nuevamente los datos y lo armamos bien.',
          data: { action: 'reject_confirmation' },
        };
      }

      if (this.isModifyIntent(context.normalizedMessage)) {
        const updatedDraft = await this.buildDraft(context, draft);
        return this.respondWithDraft(context, updatedDraft, 'modify_draft');
      }

      return {
        handled: true,
        response:
          'Para continuar necesito que me confirmes el pedido. Responde "si" para guardarlo o "no" para cancelarlo.',
        data: { action: 'awaiting_confirmation' },
      };
    }

    const nextDraft = await this.buildDraft(context, draft);
    return this.respondWithDraft(context, nextDraft, 'draft_order');
  }

  private async buildDraft(context: SkillContext, previous?: OrderDraft) {
    const extracted = this.extractInformalOrderData(context.message);
    const products = await this.productsService.findByCompany(context.companyId);
    const matchedItems = await this.matchProducts(products, extracted, previous);
    const paymentMethod = await this.resolvePaymentMethod(
      context.companyId,
      extracted.paymentText,
      previous?.paymentMethodName,
    );

    const draft: OrderDraft = {
      status: 'collecting_data',
      customerName: extracted.customerName ?? previous?.customerName,
      customerPhone:
        extracted.customerPhone ?? previous?.customerPhone ?? context.senderPhone,
      customerAddress: extracted.customerAddress ?? previous?.customerAddress,
      paymentMethodId: paymentMethod?.id ?? previous?.paymentMethodId,
      paymentMethodName: paymentMethod?.name ?? previous?.paymentMethodName,
      items: matchedItems,
      missingFields: [],
      sourceChannel: this.resolveSourceChannel(context),
      extractedFrom: context.message,
      updatedAt: new Date().toISOString(),
    };

    draft.missingFields = this.getMissingFields(draft);
    draft.status = draft.missingFields.length
      ? 'collecting_data'
      : 'pending_confirmation';

    await this.saveDraft(context, draft);

    return draft;
  }

  private async respondWithDraft(
    context: SkillContext,
    draft: OrderDraft,
    action: string,
  ): Promise<SkillResult> {
    if (draft.status === 'pending_confirmation') {
      return {
        handled: true,
        response: this.buildConfirmationMessage(draft),
        data: { action, draft },
      };
    }

    return {
      handled: true,
      response: this.buildMissingDataMessage(draft),
      data: { action, draft },
    };
  }

  private async confirmDraft(
    context: SkillContext,
    draft: OrderDraft,
  ): Promise<SkillResult> {
    if (draft.missingFields.length) {
      return {
        handled: true,
        response: this.buildMissingDataMessage(draft),
        data: { action: 'missing_before_confirm', draft },
      };
    }

    const order = await this.ordersService.create({
      companyId: context.companyId,
      customerName: draft.customerName,
      customerPhone: draft.customerPhone ?? context.senderPhone,
      customerAddress: draft.customerAddress,
      paymentMethodId: draft.paymentMethodId,
      status: 'pendiente_confirmacion_operador',
      items: draft.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    });

    await this.clearDraft(context);
    await this.notifyBusiness(context, draft, order.id);

    return {
      handled: true,
      response: [
        'Perfecto, ya quedo confirmado.',
        '',
        `Numero de pedido: ${order.id.slice(0, 8)}.`,
        'Un operador revisará el delivery y la preparación del pedido.',
      ].join('\n'),
      data: {
        action: 'confirmed',
        orderId: order.id,
        status: order.status,
        notified: true,
      },
    };
  }

  private extractInformalOrderData(message: string): ExtractedOrderData {
    const normalized = this.normalize(message);
    const cleaned = message.replace(/[¿?¡!]/g, ' ').replace(/\s+/g, ' ').trim();
    const requestedProducts = this.extractProductRequests(cleaned, normalized);

    return {
      customerName: this.extractCustomerName(cleaned),
      customerPhone: this.extractPhone(cleaned),
      customerAddress: this.extractAddress(cleaned),
      paymentText: this.extractPaymentText(normalized),
      requestedProducts,
    };
  }

  private extractProductRequests(message: string, normalized: string) {
    const quantity = this.extractQuantity(normalized);
    const beforeRecipient = message
      .replace(/^(quiero|quiero comprar|hazme|hacer|pedir|pedido|orden|comprar|mandame|mándame|me llevo|agregame|agrégame)\s+/i, '')
      .split(/\bpara\b|\ba nombre de\b|\bdireccion\b|\bdirección\b|\bav\b|\bavenida\b|\bcalle\b|\bcarrera\b|\ben\b/i)[0]
      .replace(/\b(un|una|el|la|los|las|de)\b/gi, ' ')
      .replace(/\b\d+\b/g, ' ')
      .trim();

    const candidates = beforeRecipient
      .split(/,| y /i)
      .map((item) => item.trim())
      .filter(Boolean);

    return candidates.length
      ? candidates.map((query) => ({ query, quantity }))
      : [];
  }

  private async matchProducts(
    products: Array<Product & { brand?: { name: string } | null }>,
    extracted: ExtractedOrderData,
    previous?: OrderDraft,
  ): Promise<OrderDraftItem[]> {
    const existing = previous?.items ?? [];
    const usdRate = await this.exchangeRateService
      .getCurrentUsdRateDecimal()
      .catch(() => null);
    const matches = extracted.requestedProducts
      .map((request) => {
        const product = this.findBestProduct(products, request.query);

        if (!product) {
          return null;
        }

        return {
          productId: product.id,
          productName: product.name,
          quantity: request.quantity,
          unitPriceUsd: product.priceUsd.toString(),
          unitPriceBs: usdRate
            ? this.exchangeRateService.usdToBs(product.priceUsd, usdRate).toString()
            : '0',
        };
      })
      .filter((item): item is OrderDraftItem => Boolean(item));

    if (!matches.length) {
      return existing;
    }

    const merged = new Map(existing.map((item) => [item.productId, item]));
    for (const item of matches) {
      merged.set(item.productId, item);
    }

    return [...merged.values()];
  }

  private findBestProduct(
    products: Array<Product & { brand?: { name: string } | null }>,
    query: string,
  ) {
    const normalizedQuery = this.normalize(query);
    let best:
      | {
          product: Product & { brand?: { name: string } | null };
          score: number;
        }
      | undefined;

    for (const product of products.filter((item) => item.isActive)) {
      const haystack = this.normalize(
        [
          product.name,
          product.category,
          product.description,
          product.brand?.name,
          ...product.tags,
        ]
          .filter(Boolean)
          .join(' '),
      );
      const score = this.scoreMatch(normalizedQuery, haystack);

      if (!best || score > best.score) {
        best = { product, score };
      }
    }

    return best && best.score >= 0.55 ? best.product : undefined;
  }

  private scoreMatch(query: string, haystack: string) {
    if (!query) {
      return 0;
    }

    if (haystack.includes(query)) {
      return 1;
    }

    const queryTokens = query.split(/\s+/).filter(Boolean);
    const matchedTokens = queryTokens.filter((token) => haystack.includes(token));

    if (!queryTokens.length) {
      return 0;
    }

    return matchedTokens.length / queryTokens.length;
  }

  private async resolvePaymentMethod(
    companyId: string,
    paymentText?: string,
    previousPaymentName?: string,
  ): Promise<PaymentMethod | undefined> {
    const query = paymentText ?? previousPaymentName;

    if (!query) {
      return undefined;
    }

    return this.paymentMethodsService.findMatching(companyId, query);
  }

  private buildConfirmationMessage(draft: OrderDraft) {
    const totalUsd = draft.items.reduce(
      (sum, item) => sum + Number(item.unitPriceUsd) * item.quantity,
      0,
    );
    const totalBs = draft.items.reduce(
      (sum, item) => sum + Number(item.unitPriceBs) * item.quantity,
      0,
    );
    const products = draft.items
      .map((item) => `- ${item.quantity} x ${item.productName}`)
      .join('\n');

    return [
      'Confirmemos el pedido',
      '',
      `Cliente: ${draft.customerName}`,
      `Telefono: ${draft.customerPhone}`,
      `Direccion: ${draft.customerAddress}`,
      `Metodo de pago: ${draft.paymentMethodName}`,
      '',
      'Productos:',
      products,
      '',
      `Subtotal: USD ${totalUsd.toFixed(2)} / Bs ${this.formatBs(totalBs)}`,
      '',
      '¿Confirmas el pedido? Responde SI para guardarlo o NO para cancelarlo.',
    ].join('\n');
  }

  private buildMissingDataMessage(draft: OrderDraft) {
    const knownProducts = draft.items.length
      ? `Tengo anotado: ${draft.items
          .map((item) => `${item.quantity} x ${item.productName}`)
          .join(', ')}.`
      : 'Todavia necesito saber que producto quieres.';
    const missingLabels = draft.missingFields.map((field) =>
      this.translateMissingField(field),
    );
    const nextQuestions = missingLabels.slice(0, 2).join(' y ');

    return [
      'Perfecto, puedo armar tu pedido.',
      knownProducts,
      `Me falta ${nextQuestions}.`,
    ].join(' ');
  }

  private buildDraftPriceMessage(draft: OrderDraft) {
    if (!draft.items.length) {
      return 'Todavia necesito saber que producto quieres para decirte el precio exacto.';
    }

    const totalUsd = draft.items.reduce(
      (sum, item) => sum + Number(item.unitPriceUsd) * item.quantity,
      0,
    );
    const totalBs = draft.items.reduce(
      (sum, item) => sum + Number(item.unitPriceBs) * item.quantity,
      0,
    );
    const productLines = draft.items
      .map(
        (item) =>
          `${item.quantity} x ${item.productName}: USD ${(Number(item.unitPriceUsd) * item.quantity).toFixed(2)} / Bs ${this.formatBs(Number(item.unitPriceBs) * item.quantity)}`,
      )
      .join('\n');
    const missing = draft.missingFields.length
      ? `\n\nPara enviarlo solo me falta ${draft.missingFields
          .map((field) => this.translateMissingField(field))
          .slice(0, 2)
          .join(' y ')}.`
      : '\n\nYa tengo los datos necesarios. Si esta correcto, confirmamelo y lo guardo.';

    return [
      'Te paso el precio de lo que llevamos anotado:',
      productLines,
      '',
      `Total: USD ${totalUsd.toFixed(2)} / Bs ${this.formatBs(totalBs)}.`,
      missing.trim(),
    ].join('\n');
  }

  private getMissingFields(draft: OrderDraft) {
    const missing: string[] = [];

    if (!draft.items.length) {
      missing.push('producto');
    }

    if (!draft.customerName) {
      missing.push('nombre');
    }

    if (!draft.customerAddress) {
      missing.push('direccion');
    }

    if (!draft.customerPhone) {
      missing.push('telefono');
    }

    if (!draft.paymentMethodId) {
      missing.push('metodo_pago');
    }

    return missing;
  }

  private async saveDraft(context: SkillContext, draft: OrderDraft) {
    await this.prisma.conversationState.upsert({
      where: {
        companyId_senderPhone: {
          companyId: context.companyId,
          senderPhone: context.senderPhone,
        },
      },
      create: {
        companyId: context.companyId,
        senderPhone: context.senderPhone,
        currentIntent: 'pedido',
        awaitingField: draft.status === 'pending_confirmation' ? 'confirmacion' : 'datos_pedido',
        metadata: { orderDraft: draft },
      },
      update: {
        currentIntent: 'pedido',
        awaitingField: draft.status === 'pending_confirmation' ? 'confirmacion' : 'datos_pedido',
        metadata: { orderDraft: draft },
      },
    });
  }

  private async clearDraft(context: SkillContext) {
    await this.prisma.conversationState.upsert({
      where: {
        companyId_senderPhone: {
          companyId: context.companyId,
          senderPhone: context.senderPhone,
        },
      },
      create: {
        companyId: context.companyId,
        senderPhone: context.senderPhone,
        currentIntent: null,
        awaitingField: null,
        metadata: {},
      },
      update: {
        currentIntent: null,
        awaitingField: null,
        metadata: {},
      },
    });
  }

  private getDraft(context: SkillContext): OrderDraft | undefined {
    const metadata = context.state?.metadata;

    if (!metadata || typeof metadata !== 'object' || !('orderDraft' in metadata)) {
      return undefined;
    }

    const draft = (metadata as { orderDraft?: OrderDraft }).orderDraft;

    return draft?.items ? draft : undefined;
  }

  private async notifyBusiness(
    context: SkillContext,
    draft: OrderDraft,
    orderId: string,
  ) {
    const payload = {
      event: 'fronti.order.confirmed',
      channel: draft.sourceChannel,
      companyId: context.companyId,
      orderId,
      customerName: draft.customerName,
      customerPhone: draft.customerPhone,
      customerAddress: draft.customerAddress,
      paymentMethod: draft.paymentMethodName,
      items: draft.items,
      createdAt: new Date().toISOString(),
    };
    const urls = [
      this.configService.get<string>('FRONTI_ORDER_WEBHOOK_URL'),
      this.configService.get<string>('MAKE_ORDER_WEBHOOK_URL'),
      this.configService.get<string>('TELEGRAM_ORDER_WEBHOOK_URL'),
    ].filter((url): url is string => Boolean(url));

    if (!urls.length) {
      console.log('Pedido confirmado para notificacion interna:', payload);
      return;
    }

    await Promise.allSettled(
      urls.map((url) =>
        axios.post(url, payload, {
          timeout: 8000,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ).then((results) => {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error('No se pudo notificar pedido:', {
            url: urls[index],
            error: result.reason?.message ?? result.reason,
          });
        }
      });
    });
  }

  private resolveSourceChannel(context: SkillContext): OrderDraft['sourceChannel'] {
    if (context.chatDto.type === 'whatsapp') {
      return 'whatsapp';
    }

    return context.chatDto.type ? 'api' : 'fronti_chat';
  }

  private extractCustomerName(message: string) {
    const patterns = [
      /\bpara\s+(.+?)(?=\s+(?:en|a|av|avenida|calle|carrera|direccion|dirección|pago|telefono|teléfono)\b|$)/i,
      /\ba nombre de\s+(.+?)(?=\s+(?:en|a|av|avenida|calle|carrera|direccion|dirección|pago|telefono|teléfono)\b|$)/i,
      /\bcliente\s+(.+?)(?=\s+(?:en|a|av|avenida|calle|carrera|direccion|dirección|pago|telefono|teléfono)\b|$)/i,
      /\bmi nombre es\s+(.+?)(?=\s+(?:en|a|av|avenida|calle|carrera|direccion|dirección|pago|telefono|teléfono)\b|$)/i,
      /\bsoy\s+(.+?)(?=\s+(?:en|a|av|avenida|calle|carrera|direccion|dirección|pago|telefono|teléfono)\b|$)/i,
    ];

    return this.firstMatch(message, patterns);
  }

  private extractAddress(message: string) {
    const patterns = [
      /\b(?:direccion|dirección|dir)\s*(?:es|:)?\s+(.+?)(?=\s+(?:pago|pagare|pagaré|telefono|teléfono|tel)\b|$)/i,
      /\b(?:enviar a|envialo a|envíalo a|llevar a|delivery a)\s+(.+?)(?=\s+(?:pago|pagare|pagaré|telefono|teléfono|tel)\b|$)/i,
      /\b(?:en|a)\s+((?:av|avenida|calle|carrera|barrio|urbanizacion|urbanización|sector|residencias|edificio|apto|casa|local)\s+.+?)(?=\s+(?:pago|pagare|pagaré|telefono|teléfono|tel)\b|$)/i,
    ];

    return this.firstMatch(message, patterns);
  }

  private extractPaymentText(message: string) {
    const methods = [
      'pago movil',
      'pago móvil',
      'transferencia',
      'zelle',
      'binance',
      'punto de venta',
      'tarjeta',
      'efectivo',
      'dolares',
      'dólares',
      'bolivares',
      'bolívares',
      'pesos',
    ];

    return methods.find((method) => message.includes(this.normalize(method)));
  }

  private extractPhone(message: string) {
    const match = message.match(/(?:\+?58)?\s?0?4(?:12|14|16|24|26)[\s.-]?\d{3}[\s.-]?\d{4}/);

    return match?.[0]?.replace(/[^\d+]/g, '');
  }

  private extractQuantity(message: string) {
    const numberMatch = message.match(/\b(\d{1,2})\b/);

    if (numberMatch) {
      return Math.max(1, Number(numberMatch[1]));
    }

    const words: Record<string, number> = {
      un: 1,
      una: 1,
      uno: 1,
      dos: 2,
      tres: 3,
      cuatro: 4,
      cinco: 5,
      seis: 6,
      siete: 7,
      ocho: 8,
      nueve: 9,
      diez: 10,
    };
    const found = Object.entries(words).find(([word]) =>
      new RegExp(`\\b${word}\\b`).test(message),
    );

    return found?.[1] ?? 1;
  }

  private firstMatch(message: string, patterns: RegExp[]) {
    for (const pattern of patterns) {
      const value = message.match(pattern)?.[1]?.trim();

      if (value) {
        return value.replace(/[.,;]+$/g, '').trim();
      }
    }

    return undefined;
  }

  private isPriceOnlyIntent(message: string) {
    return (
      includesAny(message, ['precio', 'cuanto cuesta', 'cuesta', 'valor']) &&
      !includesAny(message, ['comprar', 'pedir', 'pedido', 'me llevo', 'mandame'])
    );
  }

  private isStatusIntent(message: string) {
    return includesAny(message, [
      'estado del pedido',
      'como va mi pedido',
      'seguimiento',
    ]);
  }

  private isCancelIntent(message: string) {
    return includesAny(message, [
      'cancelar pedido',
      'cancela mi pedido',
      'cancelalo',
      'cancelarlo',
    ]);
  }

  private isModifyIntent(message: string) {
    return includesAny(message, ['modificar', 'cambiar', 'corrige', 'corregir']);
  }

  private isConfirmationMessage(message: string) {
    return this.isPositiveConfirmation(message) || this.isNegativeConfirmation(message);
  }

  private isPositiveConfirmation(message: string) {
    return /^(si|sí|confirmo|correcto|dale|ok|okay|de acuerdo|confirmar)$/i.test(
      message.trim(),
    );
  }

  private isNegativeConfirmation(message: string) {
    return /^(no|cancelar|cancela|mejor no|no gracias)$/i.test(message.trim());
  }

  private translateMissingField(field: string) {
    const labels: Record<string, string> = {
      producto: 'el producto',
      nombre: 'el nombre del cliente',
      direccion: 'la direccion de entrega',
      telefono: 'el telefono',
      metodo_pago: 'el metodo de pago',
    };

    return labels[field] ?? field;
  }

  private translateStatus(status: string) {
    const labels: Record<string, string> = {
      pending: 'pendiente',
      confirmed: 'confirmado',
      paid: 'pagado',
      preparing: 'en preparacion',
      out_for_delivery: 'en camino',
      delivered: 'entregado',
      cancelled: 'cancelado',
      pendiente_datos: 'pendiente de datos',
      pendiente_confirmacion_cliente: 'pendiente de confirmación del cliente',
      pendiente_confirmacion_operador: 'pendiente de confirmación del operador',
      pendiente_pago: 'pendiente de pago',
      pago_en_revision: 'pago en revisión',
      pago_confirmado: 'pago confirmado',
      pendiente_delivery: 'pendiente de delivery',
      delivery_asignado: 'delivery asignado',
      en_preparacion: 'en preparación',
      en_camino: 'en camino',
      entregado: 'entregado',
      cancelado: 'cancelado',
    };

    return labels[status] ?? status;
  }

  private formatBs(value: number) {
    return new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private normalize(message: string) {
    return message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
