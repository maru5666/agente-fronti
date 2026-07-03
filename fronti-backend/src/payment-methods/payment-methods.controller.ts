import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { PaymentMethodsService } from './payment-methods.service';

@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Post()
  create(@Body() createPaymentMethodDto: CreatePaymentMethodDto) {
    return this.paymentMethodsService.create(createPaymentMethodDto);
  }

  @Get('company/:companyId')
  findByCompany(@Param('companyId') companyId: string) {
    return this.paymentMethodsService.findByCompany(companyId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePaymentMethodDto: UpdatePaymentMethodDto,
  ) {
    return this.paymentMethodsService.update(id, updatePaymentMethodDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentMethodsService.remove(id);
  }
}
