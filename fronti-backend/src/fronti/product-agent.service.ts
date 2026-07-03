import { Injectable } from '@nestjs/common';
import { BcvService } from '../bcv/bcv.service';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { FrontiIntent, ToolExecutionResult } from './agent.types';
import { ConversationMemoryService } from './fronti-ai-engine/conversation-memory.service';
import { RecommendationEngineService } from './fronti-ai-engine/recommendation-engine.service';
import { ProductSearchEngineService } from './fronti-ai-engine/product-search-engine.service';
import { ResponseGeneratorService } from './fronti-ai-engine/response-generator.service';

@Injectable()
export class ProductAgentService {
  constructor(
    private readonly bcvService: BcvService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly productSearchEngine: ProductSearchEngineService,
    private readonly recommendationEngine: RecommendationEngineService,
    private readonly responseGenerator: ResponseGeneratorService,
    private readonly conversationMemory: ConversationMemoryService,
  ) {}

  async respond(input: {
    companyId: string;
    senderPhone: string;
    message: string;
    normalizedMessage: string;
    intent: FrontiIntent;
    state?: {
      currentIntent?: string | null;
      awaitingField?: string | null;
      metadata?: unknown;
    } | null;
  }): Promise<ToolExecutionResult> {
    const productMemory = this.conversationMemory.getProductMemory(input.state);
    const search = await this.productSearchEngine.search({
      companyId: input.companyId,
      message: input.message || input.normalizedMessage,
      memory: productMemory,
    });
    const alternatives = this.recommendationEngine.alternatives(search);
    const best =
      this.recommendationEngine.bestAvailable(search) ??
      this.recommendationEngine.bestOutOfStock(search);
    const holdProductMemory = this.shouldHoldProductMemory(search, input.intent);
    const bcv = await this.bcvService.getLatestStoredRate().catch(() => null);
    const usdRate = await this.exchangeRateService
      .getCurrentUsdRate()
      .catch(() => null);
    const response = this.responseGenerator.productResponse({
      search,
      alternatives,
      intent: input.intent,
      bcvAvailable: Boolean(bcv || usdRate),
      usdRate,
    });

    await this.conversationMemory.rememberProduct({
      companyId: input.companyId,
      senderPhone: input.senderPhone,
      product: holdProductMemory ? undefined : best?.product,
      query: search.query || input.message,
      intent: input.intent,
      outOfStock: !holdProductMemory && best ? best.product.stock <= 0 : undefined,
      previousMetadata: input.state?.metadata,
    });

    return {
      response,
      result: {
        query: search.query,
        normalizedQuery: search.normalizedQuery,
        intent: input.intent,
        productsFound: search.candidates.length,
        availableProducts: search.available.length,
        outOfStockProducts: search.outOfStock.length,
        uncertain: search.uncertain,
        offeredProductId: best?.product.id,
        offeredProductName: best?.product.name,
        offeredBrand: best?.product.brand?.name,
        stock: best?.product.stock,
        stockValidated: true,
        recommendations: alternatives.map((candidate) => candidate.product.id),
        bcvStatus: bcv ? 'stored' : 'unavailable',
      },
    };
  }

  private shouldHoldProductMemory(
    search: Awaited<ReturnType<ProductSearchEngineService['search']>>,
    intent: FrontiIntent,
  ) {
    const profile = search.entity.dermoProfile;

    if (!profile?.shouldAskBeforeRecommend || intent !== 'recomendacion') {
      return false;
    }

    const hasSpecificCatalogClue =
      Boolean(search.entity.brandHint) ||
      Boolean(search.entity.categoryHint) ||
      search.entity.asksStock ||
      search.entity.asksPrice;

    return profile.broadRequest || profile.exploratoryProblem || !hasSpecificCatalogClue;
  }
}
