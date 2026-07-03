import { Injectable } from '@nestjs/common';

@Injectable()
export class ResponseComposerService {
  greeting(emotion?: string) {
    if (emotion === 'apurado') return '¡Hola! Te ayudo rápido. ¿Qué necesitas resolver hoy?';
    return '¡Hola! 😊 ¿Qué estás buscando hoy para tu piel?';
  }

  farewell() {
    return 'Perfecto, quedo pendiente por si necesitas algo más.';
  }

  clarifyGeneral() {
    return 'Claro. Cuéntame qué quieres mejorar: acné, manchas, resequedad, piel grasa, sensibilidad, ojeras o una rutina básica.';
  }
}
