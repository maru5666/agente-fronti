import { Module } from '@nestjs/common';
import { InternalNotificationsController } from './internal-notifications.controller';
import { InternalNotificationsService } from './internal-notifications.service';

@Module({
  controllers: [InternalNotificationsController],
  providers: [InternalNotificationsService],
  exports: [InternalNotificationsService],
})
export class InternalNotificationsModule {}
