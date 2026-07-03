import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class SubmitPaymentProofDto {
  @IsUUID()
  companyId: string;

  @IsString()
  customerPhone: string;

  @IsUUID()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsNumber()
  @IsOptional()
  amountUsd?: number;

  @IsNumber()
  @IsOptional()
  amountBs?: number;
}
