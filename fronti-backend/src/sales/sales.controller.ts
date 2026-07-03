import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(@Body() createSaleDto: CreateSaleDto) {
    return this.salesService.create(createSaleDto);
  }

  @Get('company/:companyId')
  findByCompany(@Param('companyId') companyId: string) {
    return this.salesService.findByCompany(companyId);
  }
}
