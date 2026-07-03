import { Injectable } from '@nestjs/common';
import { FrontiIntent, FrontiTool } from './agent.types';

@Injectable()
export class ToolRouterService {
  select(intent: FrontiIntent, message: string): FrontiTool {
    if (intent === 'hablar_humano' || intent === 'reclamo' || intent === 'soporte') {
      return 'escalamiento_humano';
    }

    if (intent === 'ubicacion') {
      return 'google_maps';
    }

    if (intent === 'delivery') {
      return 'calculo_delivery';
    }

    if (message.includes('bcv') || message.includes('tasa')) {
      return 'tasa_bcv';
    }

    if (
      intent === 'consulta_producto' ||
      intent === 'precio' ||
      intent === 'disponibilidad' ||
      intent === 'buscar_marca' ||
      intent === 'recomendacion' ||
      intent === 'comparar_productos' ||
      intent === 'alternativa' ||
      intent === 'detalles'
    ) {
      return 'inventario/productos';
    }

    return 'respuesta_general';
  }
}
