import { Injectable } from '@nestjs/common';
import { FrontiIntent } from '../agent.types';
import { TextNormalizerService } from './text-normalizer.service';

type ConversationalIntent = 'saludo' | 'consulta_producto' | 'buscar_marca' | 'recomendacion' | 'delivery' | 'pago' | 'pedido' | 'reclamo' | 'despedida' | 'consulta_general';

@Injectable()
export class IntentClassifierService {
  constructor(private readonly normalizer: TextNormalizerService) {}

  classify(input: { message: string; type?: string; state?: { currentIntent?: string | null; awaitingField?: string | null } | null }): ConversationalIntent {
    if (input.type === 'location' || input.type === 'delivery_address') return 'delivery';
    const text = this.normalizer.normalize(input.message);
    if (/^(hola|buenas|buenos dias|buen dia|hey|holi)$/.test(text)) return 'saludo';
    if (/gracias|chao|adios|hasta luego/.test(text)) return 'despedida';
    if (/reclamo|molesto|no sirve|malo|problema|queja/.test(text)) return 'reclamo';
    if (/delivery|envio|enviar|direccion|ubicacion|estoy en|mandar/.test(text)) return 'delivery';
    if (/pago|pagar|dolares|bolivares|pago movil|zelle|binance|transferencia|comprobante|referencia/.test(text)) return 'pago';
    if (/pedido|comprar|quiero llevar|apartame|agrega|confirmo/.test(text)) return 'pedido';
    if (
      input.state?.currentIntent === 'product' &&
      /^(producto|productos|opciones|opcion|ver|mostrar|muestrame|muéstrame|cuales|cuáles|si|sí|ok|dale)$/.test(text)
    ) {
      return 'recomendacion';
    }
    if (/dr\s|beauty|joseon|celimax|arencia|marca/.test(text)) return 'buscar_marca';
    if (/precio|cuesta|disponible|tienes|hay/.test(text)) return 'consulta_producto';
    if (/piel|acne|mancha|brotes|grasa|seca|sensible|rosacea|ojeras|rutina|recomienda|cara/.test(text)) return 'recomendacion';
    if (input.state?.currentIntent === 'delivery' && input.state?.awaitingField === 'address') return 'delivery';
    return 'consulta_general';
  }

  toFrontiIntent(intent: ConversationalIntent): FrontiIntent {
    const map: Record<ConversationalIntent, FrontiIntent> = {
      saludo: 'consulta_general',
      consulta_producto: 'consulta_producto',
      buscar_marca: 'buscar_marca',
      recomendacion: 'recomendacion',
      delivery: 'delivery',
      pago: 'consulta_general',
      pedido: 'consulta_general',
      reclamo: 'reclamo',
      despedida: 'consulta_general',
      consulta_general: 'consulta_general',
    };
    return map[intent];
  }
}
