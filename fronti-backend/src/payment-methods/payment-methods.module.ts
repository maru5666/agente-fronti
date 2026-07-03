import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';

@Module({
  imports: [CompaniesModule],
  controllers: [PaymentMethodsController],
  providers: [PaymentMethodsService],
  exports: [PaymentMethodsService],
})
export class PaymentMethodsModule {}
