import { Injectable } from '@nestjs/common';
import { DermocosmeticProfile, ProductConversationMemory } from './engine.types';
import { TextNormalizerService } from './text-normalizer.service';

@Injectable()
export class DermocosmeticProfileService {
  constructor(private readonly normalizer: TextNormalizerService) {}

  analyze(message: string, memory?: ProductConversationMemory): DermocosmeticProfile {
    const currentText = this.normalizer.normalize(message);
    const memoryText = this.normalizer.normalize([memory?.lastQuery, ...(memory?.preferences ?? [])].filter(Boolean).join(' '));
    const currentNeeds = this.detect(currentText, this.needSynonyms);
    const currentSkins = this.detect(currentText, this.skinSynonyms);
    const text = currentNeeds.length || currentSkins.length ? currentText : `${currentText} ${memoryText}`.trim();
    const facialNeeds = this.detect(text, this.needSynonyms);
    const skinTypes = this.detect(text, this.skinSynonyms);
    const broadRequest = this.hasAny(text, ['skincare', 'cara', 'rutina', 'recomienda', 'recomiendas']);
    const medicalCaution = this.hasAny(text, ['dolor', 'sangra', 'pus', 'infeccion', 'severo', 'ardor fuerte']);
    const exploratoryProblem = this.hasAny(text, ['tengo', 'mi piel', 'mi cara', 'necesito algo', 'quiero algo']);
    const shouldAskBeforeRecommend =
      medicalCaution ||
      (broadRequest && !facialNeeds.length) ||
      (facialNeeds.length > 0 && !skinTypes.length);
    return {
      facialNeeds,
      skinTypes,
      objectives: [],
      productRoles: this.rolesFor(facialNeeds),
      ingredientHints: this.ingredientsFor(facialNeeds, skinTypes),
      broadRequest,
      exploratoryProblem,
      medicalCaution,
      shouldAskBeforeRecommend,
      nextQuestion: this.nextQuestion(facialNeeds, skinTypes, broadRequest, medicalCaution),
    };
  }

  productRelevance(product: any, profile?: DermocosmeticProfile) {
    if (!profile) return { score: 0, reasons: [] as string[] };
    const text = this.productText(product);
    let score = 0;
    const reasons: string[] = [];

    for (const need of profile.facialNeeds) {
      const words = [...(this.needSynonyms[need] ?? []), ...this.ingredientsFor([need], [])];
      if (words.some((word) => text.includes(this.normalizer.normalize(word)))) {
        score += need === 'manchas' ? 42 : 34;
        reasons.push(
          need === 'manchas' ? 'relacion directa con manchas' : 'relacion directa con ' + need,
        );
      }
    }

    for (const skin of profile.skinTypes) {
      const words = this.skinSynonyms[skin] ?? [];
      if (words.some((word) => text.includes(this.normalizer.normalize(word)))) {
        score += 18;
        reasons.push('compatible con piel ' + skin);
      }
    }

    if (profile.facialNeeds.includes('manchas')) {
      if (this.isSunscreen(text)) {
        score += 28;
        reasons.push('proteccion clave para manchas');
      }
      if (this.hasCoreStainActive(text)) {
        score += 34;
        reasons.push('activo antimanchas');
      }
      if (!this.isSunscreen(text) && !this.hasCoreStainActive(text) && !this.hasStainTreatmentLanguage(text)) {
        score -= 40;
        reasons.push('sin evidencia antimanchas suficiente');
      }
      if (this.isEyeOrAntiAge(text) && !this.hasCoreStainActive(text) && !this.isSunscreen(text)) {
        score -= 50;
        reasons.push('no es primera opcion para manchas');
      }
      if (this.hasDirectAcneLanguage(text) && !this.hasCoreStainActive(text) && !this.isSunscreen(text)) {
        score -= 22;
        reasons.push('no trata manchas directamente');
      }
    }

    if ((profile.skinTypes.includes('sensible') || profile.facialNeeds.includes('sensibilidad')) && this.hasStrongActive(text)) {
      score -= 35;
      reasons.push('puede ser fuerte para piel sensible');
    }

    if (product.isActive && Number(product.stock) > 0) score += 10;
    else score -= 30;

    return { score, reasons: [...new Set(reasons)] };
  }

  hasDermocosmeticRelation(product: any, profile?: DermocosmeticProfile) {
    return this.productRelevance(product, profile).score >= 20;
  }

  private nextQuestion(needs: string[], skins: string[], broad: boolean, medical: boolean) {
    if (medical) return 'Puedo orientarte con productos de apoyo, pero si es fuerte o persistente conviene consultar dermatología. ¿Tu piel es grasa, seca, mixta o sensible?';
    if (broad && !needs.length) return 'Claro. ¿Quieres mejorar acné, manchas, resequedad, piel grasa, sensibilidad, ojeras o una rutina básica?';
    if (needs.length && !skins.length) return '¿Tu piel es grasa, seca, mixta o sensible? Así te recomiendo mejor.';
    if (!skins.length) return '¿Tu piel es grasa, seca, mixta o sensible? Así te recomiendo mejor.';
    return null;
  }
  private detect(text: string, catalog: Record<string, string[]>) {
    return Object.entries(catalog).filter(([, words]) => words.some((word) => text.includes(this.normalizer.normalize(word)))).map(([key]) => key);
  }

  private rolesFor(needs: string[]) {
    const roles = new Set<string>();
    if (needs.includes('manchas')) ['protector solar', 'serum', 'tratamiento despigmentante'].forEach((role) => roles.add(role));
    if (needs.includes('acne') || needs.includes('piel grasa')) ['limpiador', 'serum', 'protector solar oil control'].forEach((role) => roles.add(role));
    if (needs.includes('resequedad') || needs.includes('barrera')) ['hidratante', 'reparador de barrera'].forEach((role) => roles.add(role));
    return [...roles];
  }

  private ingredientsFor(needs: string[], skins: string[]) {
    const ingredients = new Set<string>();
    if (needs.includes('manchas')) ['niacinamida', 'vitamina c', 'txa', 'tranexamico', 'alpha arbutin', 'arbutina', 'azelaico', 'protector solar'].forEach((item) => ingredients.add(item));
    if (needs.includes('acne') || needs.includes('piel grasa')) ['salicilico', 'niacinamida', 'zinc', 'tea tree'].forEach((item) => ingredients.add(item));
    if (needs.includes('sensibilidad') || skins.includes('sensible')) ['centella', 'cica', 'pantenol', 'ceramida'].forEach((item) => ingredients.add(item));
    return [...ingredients];
  }

  private productText(product: any) {
    return this.normalizer.normalize([product.name, product.brand?.name, product.category, product.description, ...(product.tags ?? [])].filter(Boolean).join(' '));
  }

  private hasAny(text: string, words: string[]) {
    return words.some((word) => text.includes(this.normalizer.normalize(word)));
  }

  private isSunscreen(text: string) { return this.hasAny(text, ['protector', 'solar', 'spf', 'sunscreen', 'bloqueador']); }
  private hasStrongActive(text: string) { return this.hasAny(text, ['retinol', 'retinal', 'aha', 'bha', 'peeling', 'glicolico']); }
  private hasDirectAcneLanguage(text: string) { return this.hasAny(text, ['acne', 'brote', 'granito', 'espinilla', 'imperfeccion']); }
  private isEyeOrAntiAge(text: string) { return this.hasAny(text, ['contorno de ojos', 'ojos', 'ojera', 'anti edad', 'arruga', 'lineas finas', 'retinol', 'retinal']); }
  private hasStainTreatmentLanguage(text: string) { return this.hasAny(text, ['mancha', 'melasma', 'hiperpigmentacion', 'tono desigual', 'luminosidad', 'bright', 'despigmentante']); }
  private hasCoreStainActive(text: string) { return this.hasAny(text, ['vitamina c', 'niacinamida', 'txa', 'tranexamico', 'alpha arbutin', 'arbutina', 'azelaico', 'despigmentante']); }

  private readonly needSynonyms: Record<string, string[]> = {
    acne: ['acne', 'brotes', 'brotada', 'granitos', 'barros', 'espinillas', 'imperfecciones'],
    manchas: ['manchas', 'melasma', 'post acne', 'post-acne', 'tono desigual', 'pigmentacion', 'hiperpigmentacion'],
    'piel grasa': ['piel grasa', 'grasa', 'brillo', 'sebo', 'oil control'],
    poros: ['poros', 'puntos negros', 'comedones'],
    resequedad: ['resequedad', 'reseca', 'seca', 'tirante'],
    barrera: ['barrera', 'barrera danada', 'irritada'],
    sensibilidad: ['sensible', 'sensibilidad', 'rosacea', 'rojez', 'irritada'],
    ojeras: ['ojeras', 'bolsas', 'contorno de ojos'],
    hidratacion: ['hidratacion', 'hidratar', 'hidratante'],
    limpieza: ['limpieza', 'limpiador', 'cleanser'],
    'protector solar': ['protector solar', 'spf', 'bloqueador'],
  };

  private readonly skinSynonyms: Record<string, string[]> = {
    grasa: ['piel grasa', 'grasa', 'brillo', 'sebo', 'oil control'],
    seca: ['piel seca', 'seca', 'reseca', 'tirante'],
    mixta: ['piel mixta', 'mixta', 'zona t'],
    sensible: ['piel sensible', 'sensible', 'rosacea', 'rojez', 'irritada'],
  };
}
