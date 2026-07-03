import { Module } from '@nestjs/common';
import { BcvModule } from '../bcv/bcv.module';
import { ExchangeRateService } from './exchange-rate.service';

@Module({
  imports: [BcvModule],
  providers: [ExchangeRateService],
  exports: [ExchangeRateService],
})
export class ExchangeRateModule {}
