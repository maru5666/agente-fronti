import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  InternalNotificationPriority,
  InternalNotificationType,
} from '@prisma/client';

export class CreateInternalNotificationDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  @IsOptional()
  orderId?: string;

  @IsEnum(InternalNotificationType)
  type: InternalNotificationType;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(InternalNotificationPriority)
  @IsOptional()
  priority?: InternalNotificationPriority;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  customerAddress?: string;

  @IsNumber()
  @IsOptional()
  gpsLatitude?: number;

  @IsNumber()
  @IsOptional()
  gpsLongitude?: number;

  @IsNumber()
  @IsOptional()
  estimatedAmountUsd?: number;

  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;
}
