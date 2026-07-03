import { Injectable } from '@nestjs/common';
import { ProductSearchEngineService } from './product-search-engine.service';

@Injectable()
export class ProductMatcherService {
  constructor(private readonly searchEngine: ProductSearchEngineService) {}

  match(input: { companyId: string; message: string }) {
    return this.searchEngine.search(input);
  }
}
