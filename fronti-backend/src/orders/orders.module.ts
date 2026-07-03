import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { DeliveryZonesModule } from '../delivery-zones/delivery-zones.module';
import { ExchangeRateModule } from '../exchange-rate/exchange-rate.module';
import { InternalNotificationsModule } from '../internal-notifications/internal-notifications.module';
import { MapsModule } from '../maps/maps.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    CompaniesModule,
    DeliveryZonesModule,
    ExchangeRateModule,
    InternalNotificationsModule,
    PaymentMethodsModule,
    MapsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
