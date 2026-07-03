import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EstimateDeliveryDto {
  @IsUUID()
  companyId: string;

  @ValidateIf((value) => value.latitude === undefined || value.longitude === undefined)
  @IsString()
  @IsOptional()
  address?: string;

  @ValidateIf((value) => !value.address)
  @IsLatitude()
  @Type(() => Number)
  @IsOptional()
  latitude?: number;

  @ValidateIf((value) => !value.address)
  @IsLongitude()
  @Type(() => Number)
  @IsOptional()
  longitude?: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  orderSubtotalUsd?: number;
}
