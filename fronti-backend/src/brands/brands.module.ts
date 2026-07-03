import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

@Module({
  imports: [CompaniesModule],
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
