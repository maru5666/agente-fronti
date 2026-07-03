import { Module } from '@nestjs/common';
import { BcvModule } from '../bcv/bcv.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [BcvModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
