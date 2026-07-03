import { Injectable } from '@nestjs/common';
import { BcvService } from '../../bcv/bcv.service';
import { ExchangeRateService } from '../../exchange-rate/exchange-rate.service';
import { FrontiIntent, ToolExecutionResult } from '../agent.types';
import { ConversationMemoryService } from './conversation-memory.service';
import { ProductSearchResult } from './engine.types';
import { RecommendationEngineService } from './recommendation-engine.service';
import { ResponseGeneratorService } from './response-generator.service';

@Injectable()
export class ProductRecommendationEngineService {
  constructor(
    private readonly bcvService: BcvService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly memory: ConversationMemoryService,
    private readonly recommendationEngine: RecommendationEngineService,
    private readonly responseGenerator: ResponseGeneratorService,
  ) {}

  async recommend(input: { companyId: string; senderPhone: string; message: string; intent: FrontiIntent; state?: { currentIntent?: string | null; awaitingField?: string | null; metadata?: unknown } | null; search: ProductSearchResult }): Promise<ToolExecutionResult> {
    const alternatives = this.recommendationEngine.alternatives(input.search);
    const best = this.recommendationEngine.bestAvailable(input.search) ?? this.recommendationEngine.bestOutOfStock(input.search);
    const usdRate = await this.exchangeRateService.getCurrentUsdRate().catch(() => null);
    const bcv = await this.bcvService.getLatestStoredRate().catch(() => null);
    const response = this.responseGenerator.productResponse({ search: input.search, alternatives, intent: input.intent, bcvAvailable: Boolean(bcv || usdRate), usdRate });
    const awaitingField = this.nextAwaitingField(input.search, response);
    const pendingNeed = input.search.entity.dermoProfile.facialNeeds[0] ?? null;

    await this.memory.rememberProduct({
      companyId: input.companyId,
      senderPhone: input.senderPhone,
      product: best?.product,
      query: input.search.query || input.message,
      intent: input.intent,
      outOfStock: best ? best.product.stock <= 0 : undefined,
      previousMetadata: input.state?.metadata,
      currentIntent: 'product',
      awaitingField,
      recommendedProducts: input.search.available.slice(0, 3).map((candidate) => candidate.product),
      extraMetadata: awaitingField ? { pendingNeed, pendingQuestion: awaitingField } : { pendingNeed, pendingQuestion: null },
    });

    return { response, result: { query: input.search.query, productsFound: input.search.candidates.length, availableProducts: input.search.available.length, offeredProductId: best?.product.id, stockValidated: true } };
  }

  private nextAwaitingField(search: ProductSearchResult, response: string) {
    const normalized = response
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (search.entity.dermoProfile.shouldAskBeforeRecommend && normalized.includes('piel es grasa')) {
      return 'skin_type';
    }
    return null;
  }
}
