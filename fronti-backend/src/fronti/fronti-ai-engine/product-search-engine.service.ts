import { Injectable } from '@nestjs/common';
import { ProductsService } from '../../products/products.service';
import { ProductCandidate, ProductConversationMemory, ProductEntity, ProductSearchResult } from './engine.types';
import { DermocosmeticProfileService } from './dermocosmetic-profile.service';
import { EntityExtractorService } from './entity-extractor.service';
import { FuzzySearchService } from './fuzzy-search.service';
import { TextNormalizerService } from './text-normalizer.service';

@Injectable()
export class ProductSearchEngineService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly entityExtractor: EntityExtractorService,
    private readonly fuzzySearch: FuzzySearchService,
    private readonly normalizer: TextNormalizerService,
    private readonly dermo: DermocosmeticProfileService,
  ) {}

  async search(input: { companyId: string; message: string; memory?: ProductConversationMemory }): Promise<ProductSearchResult> {
    const entity = this.entityExtractor.extract(input.message, input.memory);
    const products = await this.productsService.findByCompany(input.companyId);
    const candidates = products
      .map((product) => this.scoreProduct(product, entity))
      .filter((candidate) =>
        entity.dermoProfile.facialNeeds.includes('manchas')
          ? this.hasStainRecommendationEvidence(candidate.product)
          : true,
      )
      .filter((candidate) => candidate.score >= 18)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    const available = candidates.filter((candidate) => candidate.product.isActive && Number(candidate.product.stock) > 0);
    const outOfStock = candidates.filter((candidate) => !candidate.product.isActive || Number(candidate.product.stock) <= 0);
    const related = this.relatedProducts(products, entity, candidates);
    const topScore = candidates[0]?.score ?? 0;
    return {
      query: entity.searchQuery,
      normalizedQuery: this.normalizer.normalize(entity.searchQuery),
      entity,
      candidates,
      available,
      outOfStock,
      related,
      uncertain: topScore > 0 && topScore < 34,
    };
  }

  private scoreProduct(product: any, entity: ProductEntity): ProductCandidate {
    const text = this.productText(product);
    const query = entity.expandedQuery || entity.searchQuery;
    let score = 0;
    const reasons: string[] = [];
    const fieldScores = [
      [product.name, 42, 'nombre'],
      [product.brand?.name, 40, 'marca'],
      [product.category, 26, 'categoria'],
      [product.description, 22, 'descripcion'],
      [(product.tags ?? []).join(' '), 26, 'etiquetas'],
    ] as const;

    for (const [value, weight, reason] of fieldScores) {
      const normalizedValue = this.normalizer.normalize(value);
      const match = Math.max(
        this.fuzzySearch.tokenOverlap(query, normalizedValue),
        this.fuzzySearch.similarity(entity.searchQuery, normalizedValue),
      );
      if (match >= 0.18) {
        score += match * weight;
        reasons.push(reason);
      }
    }

    const dermoScore = this.dermo.productRelevance(product, entity.dermoProfile);
    score += dermoScore.score;
    reasons.push(...dermoScore.reasons);

    if (entity.brandHint && this.fuzzySearch.similarity(entity.brandHint, this.normalizer.normalize(product.brand?.name)) >= 0.65) {
      score += 35;
      reasons.push('marca solicitada');
    }

    if (entity.categoryHint && text.includes(entity.categoryHint)) {
      score += 18;
      reasons.push('categoria solicitada');
    }

    if (entity.budgetHint && Number(product.priceUsd) <= entity.budgetHint) {
      score += 8;
      reasons.push('presupuesto');
    }

    const exact = text.includes(entity.searchQuery) && Boolean(entity.searchQuery);
    return { product, score: Number(score.toFixed(2)), reasons: [...new Set(reasons)], exact };
  }

  private relatedProducts(products: any[], entity: ProductEntity, selected: ProductCandidate[]) {
    const selectedIds = new Set(selected.map((candidate) => candidate.product.id));
    return products
      .filter((product) => product.isActive && Number(product.stock) > 0 && !selectedIds.has(product.id))
      .map((product) => this.scoreProduct(product, entity))
      .filter((candidate) => candidate.score >= 28)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  private productText(product: any) {
    return this.normalizer.normalize([product.name, product.brand?.name, product.category, product.description, ...(product.tags ?? [])].filter(Boolean).join(' '));
  }

  private hasStainRecommendationEvidence(product: any) {
    const text = this.productText(product);
    return [
      'protector',
      'solar',
      'spf',
      'sunscreen',
      'niacinamida',
      'vitamina c',
      'txa',
      'tranexamico',
      'alpha arbutin',
      'arbutina',
      'azelaico',
      'despigmentante',
    ].some((word) => text.includes(this.normalizer.normalize(word)));
  }
}
