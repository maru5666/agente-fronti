import { ChatDto } from './dto/chat.dto';

export type FrontiIntent =
  | 'consulta_producto'
  | 'precio'
  | 'disponibilidad'
  | 'buscar_marca'
  | 'recomendacion'
  | 'promociones'
  | 'comparar_productos'
  | 'alternativa'
  | 'detalles'
  | 'delivery'
  | 'ubicacion'
  | 'reclamo'
  | 'soporte'
  | 'hablar_humano'
  | 'consulta_general';

export type FrontiTool =
  | 'inventario/productos'
  | 'tasa_bcv'
  | 'google_maps'
  | 'calculo_delivery'
  | 'historial_cliente'
  | 'whatsapp'
  | 'pedidos'
  | 'pagos'
  | 'escalamiento_humano'
  | 'respuesta_general';

export type ConversationContext = {
  currentIntent?: string | null;
  awaitingField?: string | null;
};

export type AgentExecutionContext = {
  chatDto: ChatDto;
  normalizedMessage: string;
  state?: ConversationContext | null;
};

export type ToolExecutionResult = {
  response: string;
  result: Record<string, unknown>;
};

export type CriticReview = {
  passed: boolean;
  checks: {
    intentCorrect: boolean;
    toolUsed: boolean;
    stockValidated: boolean;
    bcvFreshEnough: boolean;
    clearAndShort: boolean;
    naturalTone: boolean;
    shouldEscalate: boolean;
  };
  notes: string[];
  finalResponse: string;
};
