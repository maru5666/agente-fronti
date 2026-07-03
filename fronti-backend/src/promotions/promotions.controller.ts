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
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  create(@Body() createPromotionDto: CreatePromotionDto) {
    return this.promotionsService.create(createPromotionDto);
  }

  @Get('company/:companyId/active')
  findActive(
    @Param('companyId') companyId: string,
    @Query('limit') limit?: string,
  ) {
    return this.promotionsService.findActive(companyId, parseLimit(limit));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePromotionDto: UpdatePromotionDto,
  ) {
    return this.promotionsService.update(id, updatePromotionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.promotionsService.remove(id);
  }
}

function parseLimit(value?: string) {
  if (!value) return undefined;

  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : undefined;
}
