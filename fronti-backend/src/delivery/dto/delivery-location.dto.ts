import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DeliveryLocationDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @IsLatitude()
  @Type(() => Number)
  latitude: number;

  @IsLongitude()
  @Type(() => Number)
  longitude: number;

  @IsString()
  @IsOptional()
  type?: 'location';

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  accuracy?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  timestamp?: number;
}
