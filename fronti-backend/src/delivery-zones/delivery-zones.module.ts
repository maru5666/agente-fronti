import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { MapsModule } from '../maps/maps.module';
import { DeliveryZonesController } from './delivery-zones.controller';
import { DeliveryZonesService } from './delivery-zones.service';

@Module({
  imports: [CompaniesModule, MapsModule],
  controllers: [DeliveryZonesController],
  providers: [DeliveryZonesService],
  exports: [DeliveryZonesService],
})
export class DeliveryZonesModule {}
