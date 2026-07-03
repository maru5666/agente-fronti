import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateInternalNotificationDto } from './dto/create-internal-notification.dto';
import { UpdateInternalNotificationDto } from './dto/update-internal-notification.dto';
import { InternalNotificationsService } from './internal-notifications.service';

@Controller('internal-notifications')
export class InternalNotificationsController {
  constructor(
    private readonly internalNotificationsService: InternalNotificationsService,
  ) {}

  @Post()
  create(@Body() dto: CreateInternalNotificationDto) {
    return this.internalNotificationsService.create(dto);
  }

  @Get('company/:companyId')
  findByCompany(
    @Param('companyId') companyId: string,
    @Query('status') status?: string,
  ) {
    return this.internalNotificationsService.findByCompany(companyId, status);
  }

  @Get('company/:companyId/pending-count')
  countPending(@Param('companyId') companyId: string) {
    return this.internalNotificationsService.countPending(companyId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInternalNotificationDto,
  ) {
    return this.internalNotificationsService.update(id, dto);
  }
}
