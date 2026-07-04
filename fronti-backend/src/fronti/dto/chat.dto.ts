import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @IsString()
  @IsOptional()
  senderPhone: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  paymentReference?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  customerAddress?: string;

  @IsLatitude()
  @Type(() => Number)
  @IsOptional()
  customerLatitude?: number;

  @IsLongitude()
  @Type(() => Number)
  @IsOptional()
  customerLongitude?: number;

  @IsLatitude()
  @Type(() => Number)
  @IsOptional()
  latitude?: number;

  @IsLongitude()
  @Type(() => Number)
  @IsOptional()
  longitude?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  accuracy?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  timestamp?: number;
}
