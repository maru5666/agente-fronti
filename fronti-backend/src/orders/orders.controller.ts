import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { SubmitPaymentProofDto } from './dto/submit-payment-proof.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get('company/:companyId')
  findByCompany(
    @Param('companyId') companyId: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.findByCompany(companyId, parseLimit(limit));
  }

  @Get('company/:companyId/summary')
  summary(@Param('companyId') companyId: string) {
    return this.ordersService.getSummary(companyId);
  }

  @Get('company/:companyId/status/:status')
  findByStatus(
    @Param('companyId') companyId: string,
    @Param('status') status: string,
  ) {
    return this.ordersService.findByStatus(companyId, status);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, updateOrderStatusDto.status);
  }

  @Post('payment-proof')
  submitPaymentProof(@Body() dto: SubmitPaymentProofDto) {
    return this.ordersService.submitPaymentProof(dto);
  }

  @Post(':id/payment-proof')
  submitPaymentProofForOrder(
    @Param('id') id: string,
    @Body() dto: SubmitPaymentProofDto,
  ) {
    return this.ordersService.submitPaymentProof({ ...dto, orderId: id });
  }
}

function parseLimit(value?: string) {
  if (!value) return undefined;

  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : undefined;
}
