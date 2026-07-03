import { Injectable } from '@nestjs/common';
import { AgentExecutionContext, FrontiIntent } from './agent.types';

@Injectable()
export class IntentRouterService {
  classify(context: AgentExecutionContext): FrontiIntent {
    const { chatDto, normalizedMessage, state } = context;

    if (chatDto.type === 'location') {
      return 'ubicacion';
    }

    if (chatDto.type === 'delivery_address' || state?.awaitingField === 'address') {
      return 'delivery';
    }

    if (chatDto.type === 'saved_address') {
      return 'delivery';
    }

    if (this.includesAny(normalizedMessage, ['humano', 'asesor', 'operador', 'persona', 'atiendame alguien'])) {
      return 'hablar_humano';
    }

    if (
      this.includesAny(normalizedMessage, [
        'reclamo',
        'queja',
        'malo',
        'molesto',
        'no sirve',
        'no funciono',
        'me llego mal',
        'llego mal',
        'problema con mi pedido',
      ])
    ) {
      return 'reclamo';
    }

    if (this.includesAny(normalizedMessage, ['soporte', 'ayuda', 'no puedo', 'fallo', 'error'])) {
      return 'soporte';
    }

    if (this.includesAny(normalizedMessage, ['bcv', 'tasa', 'cambio oficial'])) {
      return 'consulta_general';
    }

    if (this.includesAny(normalizedMessage, ['promocion', 'promociones', 'oferta', 'descuento', 'combo', '2x1'])) {
      return 'promociones';
    }

    if (
      this.includesAny(normalizedMessage, [
        'delivery',
        'envio',
        'enviar',
        'direccion',
        'estoy en',
        'barrio',
        'calle',
        'carrera',
        'urbanizacion',
        'tarda',
        'cuesta el envio',
      ])
    ) {
      return 'delivery';
    }

    if (this.includesAny(normalizedMessage, ['ubicacion', 'donde estan', 'direccion de la tienda', 'como llego'])) {
      return 'ubicacion';
    }

    if (this.includesAny(normalizedMessage, ['precio', 'cuanto cuesta', 'cuesta', 'valor', 'bs', 'dolares'])) {
      return 'precio';
    }

    if (this.includesAny(normalizedMessage, ['recomienda', 'recomiendas', 'que me sirve', 'rutina', 'para piel', 'hidratar'])) {
      return 'recomendacion';
    }

    if (this.includesAny(normalizedMessage, ['caro', 'costoso', 'muy alto', 'mas economico', 'barato', 'economico'])) {
      return 'alternativa';
    }

    if (this.includesAny(normalizedMessage, ['parecido', 'similar', 'alternativa', 'reemplazo'])) {
      return 'alternativa';
    }

    if (this.includesAny(normalizedMessage, ['compara', 'comparar', 'cual es mejor', 'versus', ' vs '])) {
      return 'comparar_productos';
    }

    if (this.includesAny(normalizedMessage, ['detalle', 'detalles', 'beneficio', 'sirve', 'foto', 'imagen'])) {
      return 'detalles';
    }

    if (this.includesAny(normalizedMessage, ['hay', 'tienen', 'disponible', 'stock', 'queda', 'quedan'])) {
      return 'disponibilidad';
    }

    if (this.looksLikeProductSearch(normalizedMessage)) {
      return 'consulta_producto';
    }

    return 'consulta_general';
  }

  private includesAny(message: string, values: string[]) {
    return values.some((value) => message.includes(value));
  }

  private looksLikeProductSearch(message: string) {
    const words = message.split(/\s+/).filter(Boolean);
    return words.length > 0 && words.length <= 8;
  }
}
