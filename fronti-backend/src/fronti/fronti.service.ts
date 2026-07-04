import { Injectable } from '@nestjs/common';
import { Prisma, Product, SenderType } from '@prisma/client';
import { BcvService } from '../bcv/bcv.service';
import { CompaniesService } from '../companies/companies.service';
import { DeliveryZonesService } from '../delivery-zones/delivery-zones.service';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { MapsService } from '../maps/maps.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { PromotionsService } from '../promotions/promotions.service';
import { SalesService } from '../sales/sales.service';
import { AgentLogsService } from './agent-logs.service';
import { FrontiIntent, FrontiTool, ToolExecutionResult } from './agent.types';
import { CriticAgentService } from './critic-agent.service';
import { ChatDto } from './dto/chat.dto';
import { ConversationEngineService } from './fronti-ai-engine/conversation-engine.service';
import { IntentRouterService } from './intent-router.service';
import { ProductAgentService } from './product-agent.service';
import { SkillsRegistryService } from './skills/skills-registry.service';
import { ToolRouterService } from './tool-router.service';

@Injectable()
export class FrontiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
    private readonly productsService: ProductsService,
    private readonly promotionsService: PromotionsService,
    private readonly salesService: SalesService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly deliveryZonesService: DeliveryZonesService,
    private readonly ordersService: OrdersService,
    private readonly mapsService: MapsService,
    private readonly bcvService: BcvService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly intentRouter: IntentRouterService,
    private readonly toolRouter: ToolRouterService,
    private readonly productAgent: ProductAgentService,
    private readonly criticAgent: CriticAgentService,
    private readonly agentLogsService: AgentLogsService,
    private readonly skillsRegistry: SkillsRegistryService,
    private readonly conversationEngine: ConversationEngineService,
  ) {}

  async chat(chatDto: ChatDto) {
    chatDto = await this.normalizeChatDto(chatDto);

    const effectiveMessage =
      chatDto.message ??
      (chatDto.type === 'location'
        ? 'Ubicacion compartida'
        : this.isPaymentProofPayload(chatDto)
          ? 'Comprobante de pago recibido'
        : '');
    const normalizedMessage = this.normalize(effectiveMessage);

    if (this.isPaymentProofPayload(chatDto) || this.isPaymentProofIntent(normalizedMessage)) {
      const paymentReview = await this.ordersService.submitPaymentProof({
        companyId: chatDto.companyId,
        customerPhone: chatDto.senderPhone,
        fileUrl: chatDto.fileUrl ?? chatDto.imageUrl,
        reference: chatDto.paymentReference ?? chatDto.message,
      });
      const response = paymentReview.response;
      const savedMessage = await this.prisma.chatMessage.create({
        data: {
          companyId: chatDto.companyId,
          senderType: SenderType.CUSTOMER,
          senderPhone: chatDto.senderPhone,
          message: effectiveMessage,
          response,
        },
      });

      await this.agentLogsService.save({
        companyId: chatDto.companyId,
        senderPhone: chatDto.senderPhone,
        message: effectiveMessage,
        intent: 'consulta_general',
        tool: 'escalamiento_humano',
        skill: 'payment-review',
        toolResult: {
          paymentReviewRequired: true,
          proofId: paymentReview.proof.id,
        },
        generatedResponse: response,
        criticReview: {
          passed: true,
          checks: {
            intentCorrect: true,
            toolUsed: true,
            stockValidated: true,
            bcvFreshEnough: true,
            clearAndShort: true,
            naturalTone: true,
            shouldEscalate: true,
          },
          notes: ['Comprobante recibido y enviado a revisión humana.'],
          finalResponse: response,
        },
        finalResponse: response,
      });

      return {
        response,
        messageId: savedMessage.id,
      };
    }

    const state = await this.getConversationState(chatDto);
    const conversationalResponse = await this.conversationEngine.respond({
      chatDto,
      message: effectiveMessage,
      normalizedMessage,
      state,
    });

    if (conversationalResponse.handled && conversationalResponse.response) {
      const criticReview = this.criticAgent.review({
        intent: conversationalResponse.intent,
        tool: conversationalResponse.tool,
        toolResult: conversationalResponse.result ?? {},
        generatedResponse: conversationalResponse.response,
      });
      const response = criticReview.finalResponse;
      const savedMessage = await this.prisma.chatMessage.create({
        data: {
          companyId: chatDto.companyId,
          senderType: SenderType.CUSTOMER,
          senderPhone: chatDto.senderPhone,
          message: effectiveMessage,
          response,
        },
      });

      await this.agentLogsService.save({
        companyId: chatDto.companyId,
        senderPhone: chatDto.senderPhone,
        message: effectiveMessage,
        intent: conversationalResponse.intent,
        tool: conversationalResponse.tool,
        skill: 'conversation-engine',
        toolResult: conversationalResponse.result ?? {},
        generatedResponse: conversationalResponse.response,
        criticReview,
        finalResponse: response,
      });

      return {
        response,
        messageId: savedMessage.id,
      };
    }

    const intent = this.intentRouter.classify({
      chatDto,
      normalizedMessage,
      state,
    });
    const tool = this.toolRouter.select(intent, normalizedMessage);
    const skillExecution = await this.skillsRegistry.execute({
      chatDto,
      companyId: chatDto.companyId,
      senderPhone: chatDto.senderPhone,
      message: effectiveMessage,
      normalizedMessage,
      state,
    });
    const execution = skillExecution.handled
      ? {
          response: skillExecution.response,
          result: {
            ...(skillExecution.data ?? {}),
            skill: skillExecution.skillName,
          },
        }
      : await this.executeTool(
          intent,
          tool,
          chatDto,
          normalizedMessage,
          state,
        );
    const criticReview = this.criticAgent.review({
      intent,
      tool,
      toolResult: execution.result,
      generatedResponse: execution.response,
    });
    const response = criticReview.finalResponse;

    const savedMessage = await this.prisma.chatMessage.create({
      data: {
        companyId: chatDto.companyId,
        senderType: SenderType.CUSTOMER,
        senderPhone: chatDto.senderPhone,
        message: effectiveMessage,
        response,
      },
    });

    await this.agentLogsService.save({
      companyId: chatDto.companyId,
      senderPhone: chatDto.senderPhone,
      message: effectiveMessage,
      intent,
      tool,
      skill: skillExecution.skillName,
      toolResult: execution.result,
      generatedResponse: execution.response,
      criticReview,
      finalResponse: response,
    });

    return {
      response,
      messageId: savedMessage.id,
    };
  }

  listSkills() {
    return this.skillsRegistry.list();
  }

  private async normalizeChatDto(chatDto: ChatDto): Promise<ChatDto> {
    const company = await this.companiesService.findByAccessCode(chatDto.companyId);
    const senderPhone =
      chatDto.senderPhone?.trim() ||
      chatDto.customerPhone?.trim() ||
      'demo-cliente';

    return {
      ...chatDto,
      companyId: company.id,
      senderPhone,
      customerPhone: chatDto.customerPhone ?? senderPhone,
    };
  }

  private async executeTool(
    intent: FrontiIntent,
    tool: FrontiTool,
    chatDto: ChatDto,
    normalizedMessage: string,
    state?: { currentIntent?: string | null; awaitingField?: string | null } | null,
  ): Promise<ToolExecutionResult> {
    if (tool === 'escalamiento_humano') {
      return {
        response: this.humanEscalationResponse(intent),
        result: { escalated: true, reason: intent },
      };
    }

    if (tool === 'tasa_bcv') {
      const rate = await this.bcvService.getLatest().catch(() => null);
      if (!rate) {
        return {
          response: 'No tengo la tasa BCV disponible en este momento. Puedo seguir ayudandote con productos o pasarte con un asesor.',
          result: { status: 'unavailable' },
        };
      }

      return {
        response: `La tasa BCV vigente es Bs. ${rate.formattedRate} por USD.\nFuente: ${rate.source}.\nActualizada: ${new Date(rate.fetchedAt).toLocaleString('es-VE')}.`,
        result: {
          status: rate.status,
          usdRate: rate.usdRate,
          source: rate.source,
          fetchedAt: rate.fetchedAt,
        },
      };
    }

    if (tool === 'inventario/productos') {
      return this.productAgent.respond({
        companyId: chatDto.companyId,
        senderPhone: chatDto.senderPhone,
        message: chatDto.message ?? normalizedMessage,
        normalizedMessage,
        intent,
        state,
      });
    }

    if (tool === 'calculo_delivery') {
      if (
        chatDto.type === 'delivery_address' ||
        state?.awaitingField === 'address'
      ) {
        return {
          response: await this.deliveryAddressFollowUpResponse(chatDto),
          result: { deliveryFlow: 'address_follow_up' },
        };
      }

      if (chatDto.type === 'saved_address') {
        return {
          response: await this.savedAddressDeliveryResponse(chatDto),
          result: { deliveryFlow: 'saved_address' },
        };
      }

      await this.setConversationState(chatDto, 'delivery', 'address');
      return {
        response: await this.deliveryResponse(chatDto, normalizedMessage),
        result: { deliveryFlow: 'awaiting_address' },
      };
    }

    if (tool === 'google_maps') {
      if (chatDto.type === 'location') {
        const response = await this.locationDeliveryResponse(chatDto);
        await this.setConversationState(chatDto, null, null);
        return {
          response,
          result: {
            locationReceived: true,
            latitude: chatDto.latitude ?? chatDto.customerLatitude,
            longitude: chatDto.longitude ?? chatDto.customerLongitude,
          },
        };
      }

      return {
        response: 'Estamos ubicados en la direccion registrada de la empresa. Si quieres delivery, puedes enviarme tu ubicacion.',
        result: { locationQuestion: true },
      };
    }

    return {
      response: await this.buildResponse(chatDto, normalizedMessage),
      result: { fallbackFlow: true },
    };
  }

  private humanEscalationResponse(intent: FrontiIntent) {
    if (intent === 'reclamo') {
      return 'Lamento que hayas tenido ese inconveniente. Cuentame que ocurrio y te paso con un asesor para buscar la mejor solucion.';
    }

    if (intent === 'soporte') {
      return 'Te ayudo. Cuentame que paso y, si hace falta revisar algo interno, te paso con un asesor.';
    }

    return 'Perfecto, te paso con un asesor para que te atienda directamente.';
  }

  private async buildResponse(chatDto: ChatDto, normalizedMessage: string) {
    const state = await this.getConversationState(chatDto);

    if (chatDto.type === 'location') {
      const response = await this.locationDeliveryResponse(chatDto);
      await this.setConversationState(chatDto, null, null);
      return response;
    }

    if (chatDto.type === 'saved_address') {
      return this.savedAddressDeliveryResponse(chatDto);
    }

    if (
      chatDto.type === 'delivery_address' ||
      state?.awaitingField === 'address'
    ) {
      return this.deliveryAddressFollowUpResponse(chatDto);
    }

    if (this.isSavedAddressIntent(normalizedMessage)) {
      return this.savedAddressResponse(chatDto);
    }

    if (this.isDeliveryIntent(normalizedMessage)) {
      await this.setConversationState(chatDto, 'delivery', 'address');
      return this.deliveryResponse(chatDto, normalizedMessage);
    }

    if (this.isPaymentIntent(normalizedMessage)) {
      return this.paymentResponse(chatDto.companyId, normalizedMessage);
    }

    if (this.isOrderIntent(normalizedMessage)) {
      return this.orderDraftResponse(chatDto, normalizedMessage);
    }

    if (this.isLowStockIntent(normalizedMessage)) {
      return this.lowStockResponse(chatDto.companyId);
    }

    if (this.isPromotionIntent(normalizedMessage)) {
      return this.promotionsResponse(chatDto.companyId);
    }

    if (this.isSalesIntent(normalizedMessage)) {
      return this.salesResponse(chatDto.companyId);
    }

    const productQuery =
      state?.currentIntent === 'delivery'
        ? ''
        : this.extractProductQuery(normalizedMessage);
    if (productQuery) {
      return this.productResponse(chatDto.companyId, productQuery);
    }

    return [
      'Puedo ayudarte a encontrar productos, revisar precios, armar un pedido, calcular delivery o consultar promociones.',
      'Dime que estas buscando o que quieres resolver y lo reviso con el catalogo real.',
    ].join(' ');
  }

  private async isAwaitingDeliveryAddress(chatDto: ChatDto) {
    const lastMessage = await this.prisma.chatMessage.findFirst({
      where: {
        companyId: chatDto.companyId,
        senderPhone: chatDto.senderPhone,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastMessage?.response) {
      return false;
    }

    const lastResponse = this.normalize(lastMessage.response);

    return (
      lastResponse.includes('comparteme tu ubicacion o direccion') ||
      lastResponse.includes('necesito tu ubicacion o direccion') ||
      lastResponse.includes('enviame tu ubicacion o direccion') ||
      lastResponse.includes('ubicacion o direccion de entrega')
    );
  }

  private async deliveryAddressFollowUpResponse(
    chatDto: ChatDto,
  ) {
    try {
      const response = await this.deliveryResponse(
        {
          ...chatDto,
          customerAddress: chatDto.message,
        },
        this.normalize(`delivery a ${chatDto.message ?? ''}`),
      );
      await this.setConversationState(chatDto, null, null);
      return response;
    } catch {
      return [
        'Perfecto, estoy verificando tu direccion.',
        '',
        'No pude calcular la ruta automáticamente. Un operador puede confirmar el costo del delivery.',
      ].join(' ');
    }
  }

  private async buildExplicitResponse(chatDto: ChatDto, normalizedMessage: string) {
    if (this.isPaymentIntent(normalizedMessage)) {
      return this.paymentResponse(chatDto.companyId, normalizedMessage);
    }

    if (this.isOrderIntent(normalizedMessage)) {
      return this.orderDraftResponse(chatDto, normalizedMessage);
    }

    if (this.isLowStockIntent(normalizedMessage)) {
      return this.lowStockResponse(chatDto.companyId);
    }

    if (this.isPromotionIntent(normalizedMessage)) {
      return this.promotionsResponse(chatDto.companyId);
    }

    if (this.isSalesIntent(normalizedMessage)) {
      return this.salesResponse(chatDto.companyId);
    }

    return this.deliveryResponse(
      {
        ...chatDto,
        customerAddress: chatDto.message,
      },
      normalizedMessage,
    );
  }

  private async paymentResponse(companyId: string, message: string) {
    const methods = await this.paymentMethodsService.findByCompany(companyId);

    if (!methods.length) {
      return 'Aun no veo metodos de pago activos para esta empresa. Puedo dejar el pedido pendiente para que un asesor confirme la forma de pago.';
    }

    const requestedMethod = this.extractPaymentKeyword(message);
    if (requestedMethod) {
      const method = await this.paymentMethodsService.findMatching(
        companyId,
        requestedMethod,
      );

      if (!method) {
        return `Ese metodo no aparece disponible por ahora. Puedes pagar con: ${methods
          .map((item) => `${item.name} (${item.currency})`)
          .join(', ')}.`;
      }

      return `Si, aceptamos ${method.name} en ${method.currency}. ${method.description ?? ''}`.trim();
    }

    return `Puedes pagar con: ${methods
      .map((item) => `${item.name} (${item.currency})`)
      .join(', ')}.`;
  }

  private async deliveryResponse(chatDto: ChatDto, message: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: chatDto.companyId },
    });

    if (!company) {
      return 'No pude cargar la información de esta empresa en este momento.';
    }

    if (message.includes('tarda') || message.includes('tiempo')) {
      const latest = await this.ordersService.getLatestByCustomer(
        chatDto.companyId,
        chatDto.senderPhone,
      );

      if (!latest?.estimatedDeliveryMinutes) {
        return 'Para estimar el tiempo necesito tu ubicacion o direccion de entrega.';
      }

      return `El tiempo estimado de entrega es de ${latest.estimatedDeliveryMinutes} minutos.`;
    }

    if (
      message.includes('cuesta') ||
      message.includes('costo') ||
      message.includes('precio')
    ) {
      const latest = await this.ordersService.getLatestByCustomer(
        chatDto.companyId,
        chatDto.senderPhone,
      );

      if (latest?.deliveryZone) {
        return `El delivery a ${latest.deliveryZone.name} cuesta ${latest.deliveryFeeUsd.toString()} USD / Bs ${latest.deliveryFeeBs.toString()}.`;
      }
    }

    const address = chatDto.customerAddress ?? this.extractAddress(message);
    const hasCoordinates =
      chatDto.customerLatitude !== undefined &&
      chatDto.customerLongitude !== undefined;

    if (!address && !hasCoordinates) {
      const zones = await this.deliveryZonesService.findByCompany(
        chatDto.companyId,
      );
      const favoriteAddress = await this.ordersService.getFavoriteAddress(
        chatDto.companyId,
        chatDto.senderPhone,
      );

      if (favoriteAddress) {
        return [
          'Claro. Puedes compartir tu ubicación actual o escribir tu dirección.',
          '',
          `Tambien tienes una direccion guardada: ${favoriteAddress.address}.`,
          '¿Deseas usar tu dirección guardada?',
        ].join('\n');
      }

      if (!zones.length) {
        return [
          'Claro. Puedes compartir tu ubicación actual o escribir tu dirección.',
          '',
          'La empresa todavía no configuró zonas de delivery. Puedo registrar la dirección y dejar el pedido pendiente de confirmación.',
        ].join('\n');
      }

      return 'Claro. Puedes compartir tu ubicación actual o escribir tu dirección.';
    }

    let destination;
    try {
      destination = hasCoordinates
        ? ((await this.mapsService.reverseGeocodeCoordinates({
            latitude: chatDto.customerLatitude as number,
            longitude: chatDto.customerLongitude as number,
          })) ?? {
            latitude: chatDto.customerLatitude as number,
            longitude: chatDto.customerLongitude as number,
            formattedAddress: address ?? 'Ubicacion GPS compartida',
          })
        : await this.mapsService.validateAddress(address as string, company.address);
    } catch {
      return [
        'Perfecto, estoy verificando tu dirección.',
        '',
        'No pude calcular la ruta automáticamente. Un operador puede confirmar el costo del delivery.',
      ].join('\n');
    }

    if (!company.latitude || !company.longitude) {
      await this.saveCustomerAddress(chatDto, destination);
      return [
        `Perfecto, registré la dirección: ${destination.formattedAddress}.`,
        '',
        'No pude calcular la ruta automáticamente porque la empresa todavía no tiene coordenadas configuradas. Un operador puede confirmar el costo del delivery.',
      ].join('\n');
    }

    let distance;
    try {
      distance = await this.mapsService.calculateDistance(
        {
          latitude: Number(company.latitude.toString()),
          longitude: Number(company.longitude.toString()),
        },
        destination,
      );
    } catch {
      await this.saveCustomerAddress(chatDto, destination);
      return [
        'Perfecto, estoy verificando tu dirección.',
        '',
        'No pude calcular la ruta automáticamente. Un operador puede confirmar el costo del delivery.',
      ].join('\n');
    }

    const zone = await this.deliveryZonesService.findByDistance(
      chatDto.companyId,
      distance.distanceKm,
    );

    if (!zone) {
      const zones = await this.deliveryZonesService.findByCompany(
        chatDto.companyId,
      );

      await this.saveCustomerAddress(chatDto, destination);

      if (!zones.length) {
        return [
          `Perfecto, registré la dirección: ${destination.formattedAddress}.`,
          '',
          'La empresa todavía no configuró zonas de delivery. Puedo registrar la dirección y dejar el pedido pendiente de confirmación.',
        ].join('\n');
      }

      return [
        `Perfecto, registré la dirección: ${destination.formattedAddress}.`,
        '',
        'No pude confirmar una zona automatica para esa distancia. Un operador puede validar el costo del delivery.',
      ].join('\n');
    }

    await this.saveCustomerAddress(chatDto, destination);

    const mapsLink = this.mapsService.generateNavigationLink(destination);

    return [
      `Delivery disponible para ${address ?? destination.formattedAddress}.`,
      `Distancia estimada: ${distance.distanceKm} km.`,
      `Tiempo estimado: ${distance.durationMinutes} min.`,
      `Costo de envio: ${zone.priceUsd.toString()} USD.`,
      `Enlace para el repartidor: ${mapsLink}`,
      '¿Deseas continuar con el pedido?',
    ].join('\n');
  }

  private async savedAddressResponse(chatDto: ChatDto) {
    const address = await this.ordersService.getFavoriteAddress(
      chatDto.companyId,
      chatDto.senderPhone,
    );

    if (!address) {
      return 'Todavía no tengo una dirección guardada para este cliente. Envíame tu ubicación o dirección.';
    }

    return `Usaré la dirección guardada: ${address.address}.`;
  }

  private async savedAddressDeliveryResponse(chatDto: ChatDto) {
    const address = await this.ordersService.getFavoriteAddress(
      chatDto.companyId,
      chatDto.senderPhone,
    );

    if (!address) {
      await this.setConversationState(chatDto, 'delivery', 'address');
      return 'Todavía no tengo una dirección guardada. Puedes compartir tu ubicación actual o escribir tu dirección.';
    }

    const response = await this.deliveryResponse(
      {
        ...chatDto,
        customerAddress: address.address,
        customerLatitude: address.latitude
          ? Number(address.latitude.toString())
          : undefined,
        customerLongitude: address.longitude
          ? Number(address.longitude.toString())
          : undefined,
      },
      this.normalize(`delivery a ${address.address}`),
    );
    await this.setConversationState(chatDto, null, null);
    return response;
  }

  private async saveCustomerAddress(
    chatDto: ChatDto,
    destination: {
      formattedAddress: string;
      latitude: number;
      longitude: number;
    },
  ) {
    await this.prisma.customerAddress.updateMany({
      where: {
        companyId: chatDto.companyId,
        customerPhone: chatDto.senderPhone,
        isFavorite: true,
      },
      data: { isFavorite: false },
    });

    await this.prisma.customerAddress.create({
      data: {
        companyId: chatDto.companyId,
        customerPhone: chatDto.senderPhone,
      label: 'Dirección principal',
        address: destination.formattedAddress,
        latitude: destination.latitude,
        longitude: destination.longitude,
        isFavorite: true,
      },
    });
  }

  private getConversationState(chatDto: ChatDto) {
    return this.prisma.conversationState.findUnique({
      where: {
        companyId_senderPhone: {
          companyId: chatDto.companyId,
          senderPhone: chatDto.senderPhone,
        },
      },
    });
  }

  private setConversationState(
    chatDto: ChatDto,
    currentIntent: string | null,
    awaitingField: string | null,
    metadata: Prisma.InputJsonValue = {},
  ) {
    return this.prisma.conversationState.upsert({
      where: {
        companyId_senderPhone: {
          companyId: chatDto.companyId,
          senderPhone: chatDto.senderPhone,
        },
      },
      create: {
        companyId: chatDto.companyId,
        senderPhone: chatDto.senderPhone,
        currentIntent,
        awaitingField,
        metadata,
      },
      update: {
        currentIntent,
        awaitingField,
        metadata,
      },
    });
  }

  private async orderDraftResponse(chatDto: ChatDto, message: string) {
    const productQuery = this.extractOrderProducts(message);

    if (!productQuery.length) {
      return 'Dime que productos quieres pedir y la cantidad. Por ejemplo: "Hazme un pedido de 2 arroz y 1 leche".';
    }

    const foundProducts: Product[] = [];
    for (const query of productQuery) {
      const products = await this.productsService.search(chatDto.companyId, query);
      if (products[0]) {
        foundProducts.push(products[0]);
      }
    }

    if (!foundProducts.length) {
      return 'No veo esos productos exactos en el inventario. Si me das una marca, categoria o referencia, busco opciones parecidas reales.';
    }

    const usdRate = await this.getCurrentUsdRateOrNull();
    const lines = foundProducts.map((product) => {
      return `${product.name}: ${this.formatProductPrice(product.priceUsd, usdRate)}`;
    });

    return [
      `Puedo preparar el pedido con: ${lines.join('; ')}.`,
      'Para crearlo necesito confirmar cantidades, metodo de pago y direccion o zona de delivery.',
    ].join(' ');
  }

  private async productResponse(companyId: string, query: string) {
    const products = await this.productsService.search(companyId, query);

    if (!products.length) {
      return `No veo una coincidencia exacta para "${query}". Puedo buscar por marca, categoria, beneficio o presupuesto para mostrarte opciones reales.`;
    }

    const usdRate = await this.getCurrentUsdRateOrNull();
    const lines = products.slice(0, 5).map((product) => {
      const availability =
        product.stock > 0
          ? `disponible, stock: ${product.stock}`
          : 'sin stock disponible';
      return `${product.name}: ${this.formatProductPrice(product.priceUsd, usdRate)} (${availability}).`;
    });

    return `Esto es lo mas cercano que veo en inventario: ${lines.join(' ')}`;
  }

  private async lowStockResponse(companyId: string) {
    const products = await this.productsService.findLowStock(companyId);

    if (!products.length) {
      return 'Por ahora no hay productos por debajo del stock minimo.';
    }

    const lines = products
      .slice(0, 10)
      .map(
        (product) =>
          `${product.name}: ${product.stock} unidades, minimo recomendado ${product.minStock}.`,
      );

    return `Estos productos estan por agotarse: ${lines.join(' ')}`;
  }

  private async promotionsResponse(companyId: string) {
    const promotions = await this.promotionsService.findActive(companyId);

    if (!promotions.length) {
      return 'No hay promociones activas para hoy.';
    }

    const lines = promotions.slice(0, 5).map((promotion) => {
      const productName = promotion.product
        ? ` en ${promotion.product.name}`
        : '';

      return `${promotion.title}${productName}: ${promotion.discountPercent.toString()}% de descuento hasta ${promotion.endDate.toLocaleDateString('es-VE')}.`;
    });

    return `Promociones activas: ${lines.join(' ')}`;
  }

  private async salesResponse(companyId: string) {
    const summary = await this.salesService.getTodaySummary(companyId);

    if (summary.sales === 0) {
      return 'Hoy todavia no hay ventas registradas.';
    }

    return `Hoy van ${summary.sales} venta(s), por un total de USD ${summary.totalUsd.toString()} y Bs ${summary.totalBs.toString()}.`;
  }

  private isDeliveryIntent(message: string) {
    return (
      message.includes('delivery') ||
      message.includes('envio') ||
      message.includes('enviar') ||
      message.includes('direccion') ||
      message.includes('ubicacion') ||
      message.includes('estoy en') ||
      message.includes('tarda')
    );
  }

  private isExplicitNonAddressIntent(message: string) {
    return (
      this.isPaymentIntent(message) ||
      this.isOrderIntent(message) ||
      this.isLowStockIntent(message) ||
      this.isPromotionIntent(message) ||
      this.isSalesIntent(message)
    );
  }

  private async locationDeliveryResponse(chatDto: ChatDto) {
    const latitude = chatDto.latitude ?? chatDto.customerLatitude;
    const longitude = chatDto.longitude ?? chatDto.customerLongitude;

    if (latitude === undefined || longitude === undefined) {
      return 'No pude leer tu ubicación. Intenta compartirla nuevamente.';
    }

    const company = await this.prisma.company.findUnique({
      where: { id: chatDto.companyId },
    });

    const destination =
      (await this.mapsService
        .reverseGeocodeCoordinates({
          latitude: Number(latitude),
          longitude: Number(longitude),
        })
        .catch(() => null)) ?? {
        latitude: Number(latitude),
        longitude: Number(longitude),
        formattedAddress: 'Ubicacion GPS compartida',
      };

    if (!company?.latitude || !company.longitude) {
      await this.saveCustomerAddress(chatDto, destination);
      return [
        'Ubicación recibida correctamente.',
        '',
        'No pude calcular la ruta automáticamente porque la empresa todavía no tiene coordenadas configuradas. Un operador puede confirmar el costo del delivery.',
      ].join('\n');
    }

    let distanceKm = this.calculateStraightDistanceKm(
      {
        latitude: Number(company.latitude.toString()),
        longitude: Number(company.longitude.toString()),
      },
      destination,
    );
    let durationMinutes = this.mapsService.estimateDeliveryTime(distanceKm);

    try {
      const distance = await this.mapsService.calculateDistance(
        {
          latitude: Number(company.latitude.toString()),
          longitude: Number(company.longitude.toString()),
        },
        destination,
      );
      distanceKm = distance.distanceKm;
      durationMinutes = distance.durationMinutes;
    } catch {
      durationMinutes = this.mapsService.estimateDeliveryTime(distanceKm);
    }

    const zone = await this.deliveryZonesService.findByDistance(
      chatDto.companyId,
      distanceKm,
    );

    await this.saveCustomerAddress(chatDto, destination);

    if (!zone) {
      const zones = await this.deliveryZonesService.findByCompany(chatDto.companyId);

      if (!zones.length) {
        return [
          'Ubicación recibida correctamente.',
          '',
          `Distancia estimada: ${distanceKm} km.`,
          `Tiempo estimado: ${durationMinutes} min.`,
          'La empresa todavía no configuró zonas de delivery. Puedo registrar la dirección y dejar el pedido pendiente de confirmación.',
        ].join('\n');
      }

      return [
        'Ubicación recibida correctamente.',
        '',
        `Distancia estimada: ${distanceKm} km.`,
        `Tiempo estimado: ${durationMinutes} min.`,
        'Un operador puede confirmar el costo del delivery para esta dirección.',
      ].join('\n');
    }

    return [
      'Ubicación recibida correctamente.',
      '',
      `Distancia estimada: ${distanceKm} km.`,
      `Costo de delivery: ${zone.priceUsd.toString()} USD.`,
      `Tiempo estimado: ${durationMinutes} min.`,
      '',
      '¿Deseas confirmar tu pedido?',
    ].join('\n');
  }

  private async locationResponse(chatDto: ChatDto) {
    const latitude = chatDto.latitude ?? chatDto.customerLatitude;
    const longitude = chatDto.longitude ?? chatDto.customerLongitude;

    if (latitude === undefined || longitude === undefined) {
      return 'No pude leer tu ubicación. Intenta compartirla nuevamente.';
    }

    const company = await this.prisma.company.findUnique({
      where: { id: chatDto.companyId },
    });

    if (!company?.latitude || !company.longitude) {
      return 'Ubicación recibida correctamente. La empresa todavía no tiene coordenadas configuradas para calcular distancia y delivery.';
    }

    const destination = {
      latitude: Number(latitude),
      longitude: Number(longitude),
    };

    let distanceKm = this.calculateStraightDistanceKm(
      {
        latitude: Number(company.latitude.toString()),
        longitude: Number(company.longitude.toString()),
      },
      destination,
    );
    let durationMinutes = this.mapsService.estimateDeliveryTime(distanceKm);

    try {
      const distance = await this.mapsService.calculateDistance(
        {
          latitude: Number(company.latitude.toString()),
          longitude: Number(company.longitude.toString()),
        },
        destination,
      );
      distanceKm = distance.distanceKm;
      durationMinutes = distance.durationMinutes;
    } catch {
      durationMinutes = this.mapsService.estimateDeliveryTime(distanceKm);
    }

    const zone = await this.deliveryZonesService.findByDistance(
      chatDto.companyId,
      distanceKm,
    );
    const fallbackZone = zone
      ? null
      : (await this.deliveryZonesService.findByCompany(chatDto.companyId))[0];
    const deliveryZone = zone ?? fallbackZone;
    const deliveryCost = deliveryZone?.priceUsd?.toString() ?? '0';

    return [
      'Ubicación recibida correctamente.',
      '',
      `Distancia estimada: ${distanceKm} km.`,
      `Costo de delivery: ${deliveryCost} USD.`,
      `Tiempo estimado: ${durationMinutes} minutos.`,
      '',
      '¿Deseas confirmar tu pedido?',
    ].join('\n');
  }

  private isPaymentIntent(message: string) {
    return (
      message.includes('pago') ||
      message.includes('pagar') ||
      message.includes('aceptan') ||
      message.includes('dolares') ||
      message.includes('pesos') ||
      message.includes('zelle') ||
      message.includes('binance') ||
      message.includes('punto')
    );
  }

  private isPaymentProofPayload(chatDto: ChatDto) {
    return (
      chatDto.type === 'image' ||
      chatDto.type === 'payment_proof' ||
      chatDto.type === 'receipt' ||
      Boolean(chatDto.fileUrl) ||
      Boolean(chatDto.imageUrl) ||
      Boolean(chatDto.paymentReference)
    );
  }

  private isPaymentProofIntent(message: string) {
    return (
      message.includes('comprobante') ||
      message.includes('capture') ||
      message.includes('captura') ||
      message.includes('referencia') ||
      message.includes('transferencia') ||
      message.includes('pago movil') ||
      message.includes('pagomovil') ||
      message.includes('pague') ||
      message.includes('ya pague') ||
      message.includes('zelle') ||
      message.includes('binance')
    );
  }

  private isOrderIntent(message: string) {
    return (
      message.includes('pedido') ||
      message.includes('pedir') ||
      message.includes('hazme') ||
      message.includes('quiero comprar')
    );
  }

  private isSavedAddressIntent(message: string) {
    return (
      message.includes('direccion de siempre') ||
      message.includes('direccion guardada')
    );
  }

  private isLowStockIntent(message: string) {
    return (
      message.includes('agot') ||
      message.includes('stock bajo') ||
      message.includes('bajo stock') ||
      message.includes('productos con bajo stock') ||
      message.includes('inventario bajo') ||
      message.includes('poco inventario')
    );
  }

  private isPromotionIntent(message: string) {
    return (
      message.includes('promocion') ||
      message.includes('oferta') ||
      message.includes('descuento')
    );
  }

  private isSalesIntent(message: string) {
    return (
      message.includes('vendimos') ||
      message.includes('ventas') ||
      message.includes('venta de hoy') ||
      message.includes('factur')
    );
  }

  private extractPaymentKeyword(message: string) {
    const known = [
      'pago movil',
      'dolares',
      'dolar',
      'bolivares',
      'pesos colombianos',
      'pesos',
      'transferencia',
      'zelle',
      'binance',
      'punto de venta',
      'efectivo',
    ];

    return known.find((item) => message.includes(item));
  }

  private extractAddress(message: string) {
    const markers = [
      'delivery a',
      'envio a',
      'enviar a',
      'estoy en',
      'mi direccion es',
    ];

    for (const marker of markers) {
      const index = message.indexOf(marker);
      if (index >= 0) {
        return message.slice(index + marker.length).trim();
      }
    }

    return undefined;
  }

  private extractOrderProducts(message: string) {
    const cleaned = message
      .replace('hazme un pedido de', '')
      .replace('quiero pedir', '')
      .replace('quiero comprar', '')
      .replace('pedido de', '')
      .replace(/[?¿!¡.]/g, ' ');

    return cleaned
      .split(/,| y /)
      .map((item) =>
        item
          .replace(/\b\d+\b/g, '')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter(Boolean);
  }

  private extractProductQuery(message: string) {
    const compact = message
      .replace(/[?¿!¡.,]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter((word) => !this.productStopWords.has(word));

    return compact.join(' ').trim();
  }

  private normalize(message: string) {
    return message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private calculateStraightDistanceKm(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) {
    const earthRadiusKm = 6371;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const latDistance = toRadians(destination.latitude - origin.latitude);
    const lonDistance = toRadians(destination.longitude - origin.longitude);
    const lat1 = toRadians(origin.latitude);
    const lat2 = toRadians(destination.latitude);
    const a =
      Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
      Math.sin(lonDistance / 2) *
        Math.sin(lonDistance / 2) *
        Math.cos(lat1) *
        Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Number((earthRadiusKm * c).toFixed(2));
  }

  private async getCurrentUsdRateOrNull() {
    return this.exchangeRateService.getCurrentUsdRateDecimal().catch(() => null);
  }

  private formatProductPrice(priceUsd: Prisma.Decimal, usdRate: Prisma.Decimal | null) {
    if (!usdRate) {
      return `USD: ${this.exchangeRateService.formatUsd(priceUsd)}`;
    }

    const price = this.exchangeRateService.formatDualPrice(priceUsd, usdRate);
    return `USD: ${price.formattedUsd} / Bs: ${price.formattedBs}`;
  }

  private readonly productStopWords = new Set([
    'a',
    'al',
    'bs',
    'busco',
    'buscar',
    'cuanto',
    'cuesta',
    'cuestan',
    'de',
    'del',
    'disponible',
    'el',
    'en',
    'hay',
    'la',
    'las',
    'lo',
    'los',
    'me',
    'necesito',
    'por',
    'precio',
    'que',
    'quiero',
    'tienen',
    'tiene',
    'un',
    'una',
    'usd',
    'venden',
  ]);
}
