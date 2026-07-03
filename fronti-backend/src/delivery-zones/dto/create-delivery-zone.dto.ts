import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateDeliveryZoneDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  priceUsd: number;

  @IsNumber()
  @Min(0)
  priceBs: number;

  @IsString()
  @IsNotEmpty()
  estimatedTime: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  fixedFeeUsd?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  pricePerKmUsd?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minDistanceKm?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxDistanceKm?: number;

  @IsString()
  @IsOptional()
  color?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  priority?: number;

  @IsNumber()
  @IsOptional()
  localLatitude?: number;

  @IsNumber()
  @IsOptional()
  localLongitude?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  localRadiusKm?: number;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  distanceFromCompanyKm?: number;

  @IsOptional()
  polygonCoordinates?: Array<{ latitude: number; longitude: number }>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
