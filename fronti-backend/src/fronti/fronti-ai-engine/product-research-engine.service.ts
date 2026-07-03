import { Injectable } from '@nestjs/common';
import { ProductSearchEngineService } from './product-search-engine.service';
import { ProductConversationMemory } from './engine.types';

@Injectable()
export class ProductResearchEngineService {
  constructor(private readonly searchEngine: ProductSearchEngineService) {}

  research(input: { companyId: string; message: string; memory?: ProductConversationMemory }) {
    return this.searchEngine.search(input);
  }
}
