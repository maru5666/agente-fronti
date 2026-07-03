import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  customerPhone: string;

  @IsString()
  @IsOptional()
  customerAddress?: string;

  @IsLatitude()
  @IsOptional()
  customerLatitude?: number;

  @IsLongitude()
  @IsOptional()
  customerLongitude?: number;

  @IsUUID()
  @IsOptional()
  deliveryZoneId?: string;

  @IsUUID()
  @IsOptional()
  paymentMethodId?: string;

  @IsIn([
    'pending',
    'pendiente_confirmacion_operador',
    'pendiente_pago',
    'pago_en_revision',
  ])
  @IsOptional()
  status?: 'pending' | 'pendiente_confirmacion_operador' | 'pendiente_pago' | 'pago_en_revision';

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
