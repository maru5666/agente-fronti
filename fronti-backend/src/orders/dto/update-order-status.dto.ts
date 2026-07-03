import { IsIn } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsIn([
    'pending',
    'confirmed',
    'paid',
    'preparing',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'pendiente_datos',
    'pendiente_confirmacion_cliente',
    'pendiente_confirmacion_operador',
    'pendiente_pago',
    'pago_en_revision',
    'pago_confirmado',
    'pendiente_delivery',
    'delivery_asignado',
    'en_preparacion',
    'en_camino',
    'entregado',
    'cancelado',
  ])
  status: string;
}
