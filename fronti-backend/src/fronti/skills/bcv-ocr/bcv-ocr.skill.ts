import { Injectable } from '@nestjs/common';
import { BcvService } from '../../../bcv/bcv.service';
import { FrontiSkill, SkillContext, SkillResult } from '../skill.types';
import { includesAny } from '../shared';

@Injectable()
export class BcvOcrSkill implements FrontiSkill {
  readonly name = 'ocr_bcv';
  readonly description =
    'Lee la publicacion oficial del BCV y extrae la tasa USD mediante OCR o lectura oficial.';
  readonly priority = 88;

  constructor(private readonly bcvService: BcvService) {}

  canHandle(context: SkillContext) {
    return includesAny(context.normalizedMessage, [
      'bcv',
      'tasa',
      'dolar oficial',
      'dólar oficial',
    ]);
  }

  async execute(): Promise<SkillResult> {
    const rate = await this.bcvService.getLatest();

    return {
      handled: true,
      response: [
        `La tasa BCV oficial es Bs. ${rate.formattedRate} por USD.`,
        `Fuente: ${rate.source}.`,
        `Metodo: ${this.formatMethod(rate.extractionMethod)}.`,
      ].join('\n'),
      data: {
        usdRate: rate.usdRate,
        source: rate.source,
        imageUrl: rate.imageUrl,
        extractionMethod: rate.extractionMethod,
        officialUrl: rate.officialUrl,
      },
    };
  }

  private formatMethod(method?: string | null) {
    if (method === 'ocr_official_image') return 'OCR sobre imagen oficial';
    if (method === 'html_official_page') return 'lectura de publicacion oficial';
    return 'fuente oficial BCV';
  }
}
