import { IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class UpdateCompanyDto {
  @IsString()
  @IsOptional()
  commercialName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  establishmentName?: string;

  @IsString()
  @IsOptional()
  establishmentAddress?: string;

  @IsNumber()
  @IsOptional()
  establishmentLatitude?: number;

  @IsNumber()
  @IsOptional()
  establishmentLongitude?: number;

  @IsString()
  @IsOptional()
  googleMapsReference?: string;

  @IsString()
  @IsOptional()
  baseDeliveryZone?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  deliveryBaseFeeUsd?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  deliveryPricePerKmUsd?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  deliveryMinimumFeeUsd?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  deliveryFarZoneSurchargeUsd?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  deliveryFreeFromUsd?: number;

  @IsString()
  @IsOptional()
  logo?: string;

  @IsString()
  @IsOptional()
  catalogBanner?: string;

  @IsString()
  @IsOptional()
  @Matches(/^#([0-9A-Fa-f]{6})$/, {
    message: 'El color principal debe estar en formato hexadecimal. Ejemplo: #C9A227.',
  })
  primaryColor?: string;
}
