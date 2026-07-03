import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBrandDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  logo?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
