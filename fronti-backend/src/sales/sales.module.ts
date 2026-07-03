import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { ExchangeRateModule } from '../exchange-rate/exchange-rate.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [CompaniesModule, ExchangeRateModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
