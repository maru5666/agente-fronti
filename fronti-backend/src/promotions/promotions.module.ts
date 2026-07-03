import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { ProductsModule } from '../products/products.module';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [CompaniesModule, ProductsModule],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
