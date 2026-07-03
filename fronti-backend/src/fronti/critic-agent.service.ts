import { Injectable } from '@nestjs/common';
import {
  CriticReview,
  FrontiIntent,
  FrontiTool,
} from './agent.types';

@Injectable()
export class CriticAgentService {
  review(input: {
    intent: FrontiIntent;
    tool: FrontiTool;
    toolResult: Record<string, unknown>;
    generatedResponse: string;
  }): CriticReview {
    const notes: string[] = [];
    let finalResponse = this.clean(input.generatedResponse);
    const shouldEscalate =
      input.intent === 'hablar_humano' ||
      input.intent === 'reclamo' ||
      input.intent === 'soporte';

    const stockValidated =
      input.tool !== 'inventario/productos' ||
      typeof input.toolResult.skill === 'string' ||
      input.toolResult.stockValidated === true ||
      input.toolResult.productsFound === 0;

    if (!stockValidated) {
      notes.push('La respuesta de producto no confirmaba stock real.');
      finalResponse = `${finalResponse}\n\nConfirmo disponibilidad antes de ofrecerte una opcion.`;
    }

    if (this.hasTechnicalLanguage(finalResponse)) {
      notes.push('La respuesta tenia lenguaje tecnico.');
      finalResponse = this.removeTechnicalLanguage(finalResponse);
    }

    if (finalResponse.length > 650) {
      notes.push('La respuesta era larga para WhatsApp.');
      finalResponse = this.truncateSafely(finalResponse, 620);
    }

    if (shouldEscalate && !finalResponse.toLowerCase().includes('asesor')) {
      notes.push('Debe escalar a humano.');
      finalResponse = `${finalResponse}\n\nTe paso con un asesor para ayudarte mejor.`;
    }

    const checks = {
      intentCorrect: true,
      toolUsed: input.tool !== 'respuesta_general' || input.intent === 'consulta_general',
      stockValidated,
      bcvFreshEnough: input.tool !== 'tasa_bcv' || input.toolResult.status !== 'unavailable',
      clearAndShort: finalResponse.length <= 650,
      naturalTone: !this.hasTechnicalLanguage(finalResponse),
      shouldEscalate,
    };

    return {
      passed: Object.values(checks).every((value) => value === true || value === false) && notes.length === 0,
      checks,
      notes,
      finalResponse,
    };
  }

  private clean(response: string) {
    return response
      .replace(/\bbackend\b/gi, 'sistema')
      .replace(/\bNo entend[ií]\b\.?/gi, 'Necesito una pista más para ayudarte bien.')
      .replace(/\bNo encontr[eé] resultados\b\.?/gi, 'No veo una coincidencia exacta.')
      .replace(/\bProducto no disponible\b\.?/gi, 'Ese producto no aparece disponible por ahora.')
      .replace(/\bSeleccione una opcion\b\.?/gi, 'Dime cuál opción prefieres revisar.')
      .replace(/\bError tecnico\b/gi, 'No pude completar la acción')
      .trim();
  }

  private hasTechnicalLanguage(response: string) {
    return /stack|exception|undefined|null|backend fallo|error tecnico|validacion de mapas/i.test(
      response,
    );
  }

  private removeTechnicalLanguage(response: string) {
    return response
      .replace(/La validacion de mapas no respondio correctamente\.?/gi, 'No pude calcular la ruta automáticamente.')
      .replace(/Backend fallo\.?/gi, 'No pude completar la acción.')
      .replace(/Error tecnico\.?/gi, 'No pude completar la acción.')
      .replace(/undefined|null/gi, '')
      .trim();
  }

  private truncateSafely(response: string, maxLength: number) {
    const clipped = response.slice(0, maxLength).trim();
    const lastBreak = Math.max(
      clipped.lastIndexOf('\n'),
      clipped.lastIndexOf('. '),
      clipped.lastIndexOf('? '),
      clipped.lastIndexOf('! '),
    );
    const safe = lastBreak > maxLength * 0.65 ? clipped.slice(0, lastBreak).trim() : clipped;

    return `${safe.replace(/[¿¡?.,:;—-]+$/g, '').trim()}...`;
  }
}
