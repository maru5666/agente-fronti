import { Injectable } from '@nestjs/common';
import { FrontiIntent, FrontiTool, ToolExecutionResult } from '../agent.types';
import { ChatDto } from '../dto/chat.dto';
import { ConversationMemoryService } from './conversation-memory.service';
import { DeliveryConnectorService } from './delivery-connector.service';
import { EmotionDetectorService } from './emotion-detector.service';
import { HumanHandoffService } from './human-handoff.service';
import { IntentClassifierService } from './intent-classifier.service';
import { OrderManagerService } from './order-manager.service';
import { PaymentFlowService } from './payment-flow.service';
import { ProductRecommendationEngineService } from './product-recommendation-engine.service';
import { ProductResearchEngineService } from './product-research-engine.service';
import { ResponseComposerService } from './response-composer.service';

export type ConversationEngineResult = {
  handled: boolean;
  intent: FrontiIntent;
  tool: FrontiTool;
  response: string;
  result: Record<string, unknown>;
};

type ConversationStateLike = {
  currentIntent?: string | null;
  awaitingField?: string | null;
  metadata?: unknown;
} | null;

@Injectable()
export class ConversationEngineService {
  constructor(
    private readonly intentClassifier: IntentClassifierService,
    private readonly emotionDetector: EmotionDetectorService,
    private readonly productResearch: ProductResearchEngineService,
    private readonly productRecommendation: ProductRecommendationEngineService,
    private readonly deliveryConnector: DeliveryConnectorService,
    private readonly orderManager: OrderManagerService,
    private readonly paymentFlow: PaymentFlowService,
    private readonly humanHandoff: HumanHandoffService,
    private readonly responseComposer: ResponseComposerService,
    private readonly memory: ConversationMemoryService,
  ) {}

  async respond(input: { chatDto: ChatDto; message: string; normalizedMessage: string; state: ConversationStateLike }): Promise<ConversationEngineResult> {
    const conversationalIntent = this.intentClassifier.classify({ message: input.message, type: input.chatDto.type, state: input.state });
    const intent = this.intentClassifier.toFrontiIntent(conversationalIntent);
    const emotion = this.emotionDetector.detect(input.message);
    const productMemory = this.memory.getProductMemory(input.state);

    if (input.state?.awaitingField === 'skin_type' && productMemory.lastQuery) {
      const isShortFollowUp = this.isShortProductFollowUp(input.normalizedMessage);
      const refined = isShortFollowUp
        ? `${productMemory.lastQuery} ${(productMemory.preferences ?? []).join(' ')}`.trim()
        : `${productMemory.lastQuery} ${input.message}`.trim();
      const search = await this.productResearch.research({ companyId: input.chatDto.companyId, message: refined, memory: productMemory });
      const recommendation = await this.productRecommendation.recommend({ companyId: input.chatDto.companyId, senderPhone: input.chatDto.senderPhone, message: refined, intent: 'recomendacion', state: input.state, search });
      const needLabel = this.formatNeedLabel(productMemory.lastQuery);
      const intro = isShortFollowUp
        ? `Perfecto. Voy a revisar productos disponibles para ${needLabel}.`
        : `Perfecto. Voy a revisar productos disponibles para ${needLabel} en piel ${input.message}.`;
      return this.handled('recomendacion', 'inventario/productos', { response: `${intro}\n\n${recommendation.response}`, result: recommendation.result }, { conversationalIntent, emotion, memoryUsed: true });
    }

    if (conversationalIntent === 'saludo') {
      return { handled: true, intent, tool: 'respuesta_general', response: this.responseComposer.greeting(emotion), result: { conversationalIntent, emotion } };
    }

    if (conversationalIntent === 'despedida') {
      return { handled: true, intent, tool: 'respuesta_general', response: this.responseComposer.farewell(), result: { conversationalIntent, emotion } };
    }

    if (conversationalIntent === 'reclamo') {
      const result = await this.humanHandoff.escalate({ companyId: input.chatDto.companyId, senderPhone: input.chatDto.senderPhone, message: input.message, reason: 'Cliente reporta molestia o reclamo.' });
      return this.handled(intent, 'escalamiento_humano', result, { conversationalIntent, emotion });
    }

    if (conversationalIntent === 'delivery') {
      const result = await this.deliveryConnector.handle({ chatDto: input.chatDto, message: input.message, state: input.state });
      return this.handled(intent, 'calculo_delivery', result, { conversationalIntent, emotion });
    }

    if (conversationalIntent === 'pago') {
      const result = await this.paymentFlow.handle({ companyId: input.chatDto.companyId, senderPhone: input.chatDto.senderPhone, message: input.message, state: input.state });
      return this.handled('consulta_general', 'pagos', result, { conversationalIntent, emotion });
    }

    if (conversationalIntent === 'pedido') {
      const result = await this.orderManager.draft();
      return this.handled('consulta_general', 'pedidos', result, { conversationalIntent, emotion });
    }

    if (['consulta_producto', 'buscar_marca', 'recomendacion'].includes(conversationalIntent)) {
      const messageForSearch = this.resolveProductSearchMessage(input.message, input.normalizedMessage, productMemory);
      const search = await this.productResearch.research({ companyId: input.chatDto.companyId, message: messageForSearch, memory: productMemory });
      const recommendation = await this.productRecommendation.recommend({ companyId: input.chatDto.companyId, senderPhone: input.chatDto.senderPhone, message: messageForSearch, intent, state: input.state, search });
      return this.handled(intent, 'inventario/productos', recommendation, { conversationalIntent, emotion, memoryUsed: messageForSearch !== input.message });
    }

    if (productMemory.lastQuery && /cuanto|cuánto|precio|disponible|hay|stock/.test(input.normalizedMessage)) {
      const search = await this.productResearch.research({ companyId: input.chatDto.companyId, message: productMemory.lastQuery, memory: productMemory });
      const recommendation = await this.productRecommendation.recommend({ companyId: input.chatDto.companyId, senderPhone: input.chatDto.senderPhone, message: productMemory.lastQuery, intent: 'precio', state: input.state, search });
      return this.handled('precio', 'inventario/productos', recommendation, { conversationalIntent, emotion, memoryUsed: true });
    }

    return { handled: true, intent: 'consulta_general', tool: 'respuesta_general', response: this.responseComposer.clarifyGeneral(), result: { conversationalIntent, emotion } };
  }

  private resolveProductSearchMessage(message: string, normalizedMessage: string, memory: ReturnType<ConversationMemoryService['getProductMemory']>) {
    if (this.isShortProductFollowUp(normalizedMessage) && memory.lastQuery) {
      return `${memory.lastQuery} ${message}`.trim();
    }

    return message;
  }

  private isShortProductFollowUp(normalizedMessage: string) {
    return /^(producto|productos|opciones|opcion|ver|mostrar|muestrame|cuales|si|ok|dale)$/.test(normalizedMessage);
  }

  private formatNeedLabel(value: string) {
    const normalized = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (normalized === 'acne') return 'acné';
    return value;
  }

  private handled(intent: FrontiIntent, tool: FrontiTool, execution: ToolExecutionResult, extra: Record<string, unknown>): ConversationEngineResult {
    return { handled: true, intent, tool, response: execution.response, result: { ...extra, ...execution.result } };
  }
}
