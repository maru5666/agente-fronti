import { Injectable } from '@nestjs/common';
import { DermocosmeticProfileService } from './dermocosmetic-profile.service';
import { ProductConversationMemory, ProductEntity } from './engine.types';
import { TextNormalizerService } from './text-normalizer.service';

@Injectable()
export class EntityExtractorService {
  constructor(
    private readonly normalizer: TextNormalizerService,
    private readonly dermo: DermocosmeticProfileService,
  ) {}

  extract(message: string, memory?: ProductConversationMemory): ProductEntity {
    const normalized = this.normalizer.normalize(message);
    const profile = this.dermo.analyze(message, memory);
    const benefitHints = [...new Set([...profile.facialNeeds, ...profile.skinTypes, ...profile.objectives])];
    const brandHint = this.extractBrand(normalized);
    const budget = normalized.match(/(?:hasta|menos de|maximo|presupuesto)\s*\$?\s*(\d+)/);
    return {
      rawQuery: message,
      searchQuery: normalized || this.normalizer.normalize(memory?.lastQuery),
      expandedQuery: this.normalizer.expandAliases(normalized || memory?.lastQuery || ''),
      brandHint,
      brandAliases: brandHint ? [brandHint] : [],
      categoryHint: this.extractCategory(normalized),
      benefitHints,
      budgetHint: budget ? Number(budget[1]) : memory?.budgetHint ?? null,
      preferenceHints: memory?.preferences ?? [],
      asksPrice: /precio|cuesta|cuanto|cuánto/.test(normalized),
      asksStock: /hay|tienes|disponible|stock/.test(normalized),
      asksPhoto: /foto|imagen|ver/.test(normalized),
      dermoProfile: profile,
    };
  }

  private extractBrand(text: string) {
    if (/dr\s*(althea|althe|altea|altha)|doctor\s*althea/.test(text)) return 'dr althea';
    if (/beauty\s*(of\s*)?joseon|joseon/.test(text)) return 'beauty of joseon';
    if (/celimax/.test(text)) return 'celimax';
    if (/arencia|arensia/.test(text)) return 'arencia';
    return null;
  }

  private extractCategory(text: string) {
    if (/protector|solar|spf|bloqueador/.test(text)) return 'protector solar';
    if (/limpiador|cleanser|jabon|gel/.test(text)) return 'limpieza';
    if (/crema|hidratante|cream/.test(text)) return 'hidratante';
    if (/serum|suero|ampoule/.test(text)) return 'serum';
    return null;
  }
}
