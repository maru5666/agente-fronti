import {
  IsBoolean,
  IsInt,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsIn,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  @IsOptional()
  brandId?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  mainImage?: string;

  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  galleryImages?: string[];

  @IsNumber()
  @Min(0)
  priceUsd: number;

  @IsString()
  @IsIn(['USD'])
  @IsOptional()
  currencyBase?: 'USD';

  @IsInt()
  @Min(0)
  stock: number;

  @IsInt()
  @Min(0)
  minStock: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
