import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get('company/:companyId')
  findByCompany(
    @Param('companyId') companyId: string,
    @Query('limit') limit?: string,
  ) {
    return this.productsService.findByCompany(companyId, parseLimit(limit));
  }

  @Get('company/:companyId/metrics')
  metrics(@Param('companyId') companyId: string) {
    return this.productsService.getMetrics(companyId);
  }

  @Get('company/:companyId/search')
  search(
    @Param('companyId') companyId: string,
    @Query('query') query: string,
  ) {
    return this.productsService.search(companyId, query);
  }

  @Get('company/:companyId/low-stock')
  lowStock(
    @Param('companyId') companyId: string,
    @Query('limit') limit?: string,
  ) {
    return this.productsService.findLowStock(companyId, parseLimit(limit));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}

function parseLimit(value?: string) {
  if (!value) return undefined;

  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : undefined;
}
