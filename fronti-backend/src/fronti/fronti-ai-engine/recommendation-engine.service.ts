import { Injectable } from '@nestjs/common';
import { ProductCandidate, ProductSearchResult } from './engine.types';

@Injectable()
export class RecommendationEngineService {
  alternatives(search: ProductSearchResult) {
    return this.unique([...search.related, ...search.available.slice(1)]).slice(0, 3);
  }

  bestAvailable(search: ProductSearchResult) {
    return search.available[0] ?? null;
  }

  bestOutOfStock(search: ProductSearchResult) {
    return search.outOfStock[0] ?? null;
  }

  private unique(candidates: ProductCandidate[]) {
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
      if (seen.has(candidate.product.id)) return false;
      seen.add(candidate.product.id);
      return true;
    });
  }
}
