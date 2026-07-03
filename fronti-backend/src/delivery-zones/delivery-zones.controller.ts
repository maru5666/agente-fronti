import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { DeliveryZonesService } from './delivery-zones.service';
import { CreateDeliveryZoneDto } from './dto/create-delivery-zone.dto';
import { EstimateDeliveryDto } from './dto/estimate-delivery.dto';
import { UpdateDeliveryZoneDto } from './dto/update-delivery-zone.dto';

@Controller('delivery-zones')
export class DeliveryZonesController {
  constructor(private readonly deliveryZonesService: DeliveryZonesService) {}

  @Post()
  create(@Body() createDeliveryZoneDto: CreateDeliveryZoneDto) {
    return this.deliveryZonesService.create(createDeliveryZoneDto);
  }

  @Get('company/:companyId')
  findByCompany(@Param('companyId') companyId: string) {
    return this.deliveryZonesService.findByCompany(companyId);
  }

  @Get('local-references/san-cristobal')
  getLocalReferences() {
    return this.deliveryZonesService.getLocalReferences();
  }

  @Post('estimate')
  estimate(@Body() estimateDeliveryDto: EstimateDeliveryDto) {
    return this.deliveryZonesService.estimateDelivery(estimateDeliveryDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDeliveryZoneDto: UpdateDeliveryZoneDto,
  ) {
    return this.deliveryZonesService.update(id, updateDeliveryZoneDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deliveryZonesService.remove(id);
  }
}
