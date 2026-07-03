import { Module } from '@nestjs/common';
import { BcvModule } from '../bcv/bcv.module';
import { CompaniesModule } from '../companies/companies.module';
import { DeliveryZonesModule } from '../delivery-zones/delivery-zones.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { ExchangeRateModule } from '../exchange-rate/exchange-rate.module';
import { InternalNotificationsModule } from '../internal-notifications/internal-notifications.module';
import { MapsModule } from '../maps/maps.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { ProductsModule } from '../products/products.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { SalesModule } from '../sales/sales.module';
import { FrontiController } from './fronti.controller';
import { FrontiService } from './fronti.service';
import { AgentLogsService } from './agent-logs.service';
import { CriticAgentService } from './critic-agent.service';
import { IntentRouterService } from './intent-router.service';
import { ProductAgentService } from './product-agent.service';
import { ToolRouterService } from './tool-router.service';
import { AddressSkill } from './skills/address/address.skill';
import { BcvOcrSkill } from './skills/bcv-ocr/bcv-ocr.skill';
import { BillingSkill } from './skills/billing/billing.skill';
import { CustomerMemorySkill } from './skills/customer-memory/customer-memory.skill';
import { DeliverySkill } from './skills/delivery/delivery.skill';
import { GoogleMapsSkill } from './skills/google-maps/google-maps.skill';
import { InventorySkill } from './skills/inventory/inventory.skill';
import { OrdersSkill } from './skills/orders/orders.skill';
import { PromotionsSkill } from './skills/promotions/promotions.skill';
import { RecommendationsSkill } from './skills/recommendations/recommendations.skill';
import { DeliveryEstimatorService } from './skills/delivery-estimator.service';
import { SkillMemoryService } from './skills/skill-memory.service';
import { SkillsRegistryService } from './skills/skills-registry.service';
import { AiIntentDetectorService } from './fronti-ai-engine/intent-detector.service';
import { ConversationMemoryService } from './fronti-ai-engine/conversation-memory.service';
import { ConversationEngineService } from './fronti-ai-engine/conversation-engine.service';
import { DermocosmeticProfileService } from './fronti-ai-engine/dermocosmetic-profile.service';
import { DeliveryConnectorService } from './fronti-ai-engine/delivery-connector.service';
import { EntityExtractorService } from './fronti-ai-engine/entity-extractor.service';
import { EmotionDetectorService } from './fronti-ai-engine/emotion-detector.service';
import { FuzzySearchService } from './fronti-ai-engine/fuzzy-search.service';
import { HumanHandoffService } from './fronti-ai-engine/human-handoff.service';
import { IntentClassifierService } from './fronti-ai-engine/intent-classifier.service';
import { OrderManagerService } from './fronti-ai-engine/order-manager.service';
import { PaymentFlowService } from './fronti-ai-engine/payment-flow.service';
import { ProductMatcherService } from './fronti-ai-engine/product-matcher.service';
import { ProductRecommendationEngineService } from './fronti-ai-engine/product-recommendation-engine.service';
import { ProductResearchEngineService } from './fronti-ai-engine/product-research-engine.service';
import { ProductSearchEngineService } from './fronti-ai-engine/product-search-engine.service';
import { RecommendationEngineService } from './fronti-ai-engine/recommendation-engine.service';
import { ResponseComposerService } from './fronti-ai-engine/response-composer.service';
import { ResponseGeneratorService } from './fronti-ai-engine/response-generator.service';
import { TextNormalizerService } from './fronti-ai-engine/text-normalizer.service';

@Module({
  imports: [
    BcvModule,
    CompaniesModule,
    ProductsModule,
    PromotionsModule,
    SalesModule,
    PaymentMethodsModule,
    DeliveryZonesModule,
    DeliveryModule,
    ExchangeRateModule,
    InternalNotificationsModule,
    OrdersModule,
    MapsModule,
  ],
  controllers: [FrontiController],
  providers: [
    FrontiService,
    AgentLogsService,
    CriticAgentService,
    IntentRouterService,
    ProductAgentService,
    AiIntentDetectorService,
    ConversationEngineService,
    ConversationMemoryService,
    DermocosmeticProfileService,
    DeliveryConnectorService,
    EntityExtractorService,
    EmotionDetectorService,
    FuzzySearchService,
    HumanHandoffService,
    IntentClassifierService,
    OrderManagerService,
    PaymentFlowService,
    ProductMatcherService,
    ProductRecommendationEngineService,
    ProductResearchEngineService,
    ProductSearchEngineService,
    RecommendationEngineService,
    ResponseComposerService,
    ResponseGeneratorService,
    TextNormalizerService,
    ToolRouterService,
    DeliveryEstimatorService,
    SkillMemoryService,
    SkillsRegistryService,
    AddressSkill,
    GoogleMapsSkill,
    BcvOcrSkill,
    InventorySkill,
    OrdersSkill,
    BillingSkill,
    DeliverySkill,
    CustomerMemorySkill,
    RecommendationsSkill,
    PromotionsSkill,
  ],
})
export class FrontiModule {}
