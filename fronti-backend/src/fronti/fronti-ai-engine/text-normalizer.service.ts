import { Injectable } from '@nestjs/common';

@Injectable()
export class TextNormalizerService {
  normalize(value: unknown) {
    return String(value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9ñ\s.$]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  tokens(value: unknown) {
    return this.normalize(value).split(' ').filter((token) => token.length > 1);
  }

  expandAliases(value: string) {
    const text = this.normalize(value);
    const expansions: string[] = [text];
    const aliases: Record<string, string> = {
      'dr althe': 'dr althea doctor althea piel sensible barrera crema 345',
      'dr altea': 'dr althea doctor althea piel sensible barrera crema 345',
      'beauty': 'beauty of joseon protector solar skincare coreano',
      'manchas': 'manchas hiperpigmentacion post acne melasma niacinamida vitamina c txa arbutina azelaico protector solar',
      'piel grasa': 'piel grasa sebo brillo poros oil control niacinamida salicilico limpiador protector',
      'acne': 'acne brotes granitos imperfecciones sebo salicilico niacinamida',
      'rosacea': 'piel sensible rojez centella cica pantenol barrera suave',
    };

    for (const [key, expansion] of Object.entries(aliases)) {
      if (text.includes(key)) expansions.push(expansion);
    }

    return [...new Set(expansions)].join(' ');
  }
}
