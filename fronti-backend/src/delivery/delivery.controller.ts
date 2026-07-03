import { Body, Controller, Post } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { DeliveryLocationDto } from './dto/delivery-location.dto';

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post('location')
  processLocation(@Body() dto: DeliveryLocationDto) {
    return this.deliveryService.processLocation(dto);
  }
}
