import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  InternalNotificationPriority,
  InternalNotificationStatus,
} from '@prisma/client';

export class UpdateInternalNotificationDto {
  @IsEnum(InternalNotificationStatus)
  @IsOptional()
  status?: InternalNotificationStatus;

  @IsEnum(InternalNotificationPriority)
  @IsOptional()
  priority?: InternalNotificationPriority;

  @IsString()
  @IsOptional()
  message?: string;
}
