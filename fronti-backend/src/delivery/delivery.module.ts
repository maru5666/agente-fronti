import { Module } from '@nestjs/common';
import { DeliveryZonesModule } from '../delivery-zones/delivery-zones.module';
import { ExchangeRateModule } from '../exchange-rate/exchange-rate.module';
import { InternalNotificationsModule } from '../internal-notifications/internal-notifications.module';
import { MapsModule } from '../maps/maps.module';
import { DeliveryCalculationService } from './delivery-calculation.service';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [DeliveryZonesModule, ExchangeRateModule, InternalNotificationsModule, MapsModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, DeliveryCalculationService],
  exports: [DeliveryService, DeliveryCalculationService],
})
export class DeliveryModule {}
