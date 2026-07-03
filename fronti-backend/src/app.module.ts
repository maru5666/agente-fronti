import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CompaniesModule } from './companies/companies.module';
import { BranchesModule } from './branches/branches.module';
import { BrandsModule } from './brands/brands.module';
import { BcvModule } from './bcv/bcv.module';
import { DeliveryZonesModule } from './delivery-zones/delivery-zones.module';
import { DeliveryModule } from './delivery/delivery.module';
import { ExchangeRateModule } from './exchange-rate/exchange-rate.module';
import { FrontiModule } from './fronti/fronti.module';
import { HealthModule } from './health/health.module';
import { InternalNotificationsModule } from './internal-notifications/internal-notifications.module';
import { MapsModule } from './maps/maps.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { PromotionsModule } from './promotions/promotions.module';
import { SalesModule } from './sales/sales.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    BcvModule,
    CompaniesModule,
    BranchesModule,
    BrandsModule,
    ProductsModule,
    PromotionsModule,
    SalesModule,
    PaymentMethodsModule,
    DeliveryZonesModule,
    DeliveryModule,
    ExchangeRateModule,
    MapsModule,
    OrdersModule,
    FrontiModule,
    HealthModule,
    InternalNotificationsModule,
  ],
})
export class AppModule {}
