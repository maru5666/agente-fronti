import { Injectable } from '@nestjs/common';

@Injectable()
export class EmotionDetectorService {
  detect(message: string) {
    const text = message.toLowerCase();
    if (/urgente|me urge|rapido|rápido/.test(text)) return 'apurado';
    if (/molesto|no sirve|malo|reclamo/.test(text)) return 'molesto';
    if (/no se|no sé|ayuda|confund/.test(text)) return 'confundido';
    if (/gracias|excelente|perfecto/.test(text)) return 'positivo';
    return 'neutral';
  }
}
