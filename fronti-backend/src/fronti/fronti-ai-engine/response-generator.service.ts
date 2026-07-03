import { Injectable } from '@nestjs/common';
import { ProductCandidate, ProductSearchResult } from './engine.types';

@Injectable()
export class ResponseGeneratorService {
  productResponse(input: { search: ProductSearchResult; alternatives: ProductCandidate[]; intent: string; bcvAvailable: boolean; usdRate?: number | null }) {
    const { search, intent, usdRate } = input;
    if (this.shouldInvestigateBeforeSelling(search, intent)) return this.investigationResponse(search);
    if (search.available.length) return this.recommendationResponse(search.available.slice(0, 3), search, usdRate);
    if (search.outOfStock.length) return this.outOfStockResponse(search.outOfStock[0], input.alternatives, usdRate);
    if (search.candidates.length) return this.uncertainResponse(search);
    return this.noMatchResponse(search);
  }

  private shouldInvestigateBeforeSelling(search: ProductSearchResult, intent: string) {
    const profile = search.entity.dermoProfile;
    if (!profile.shouldAskBeforeRecommend) return false;
    return intent === 'recomendacion' || profile.broadRequest || profile.medicalCaution;
  }

  private investigationResponse(search: ProductSearchResult) {
    const profile = search.entity.dermoProfile;
    if (profile.medicalCaution) {
      return ['Puedo orientarte con productos de apoyo, pero si hay dolor, inflamación fuerte o persiste, lo ideal es consultar dermatología.', profile.nextQuestion ?? '¿Tu piel es grasa, seca, mixta o sensible?'].join('\n');
    }
    if (profile.facialNeeds.includes('acne')) {
      return ['Claro. Para acné puedo ayudarte con opciones disponibles sin recomendarte algo al azar.', profile.nextQuestion ?? '¿Tu piel es grasa, seca, mixta o sensible? Así te recomiendo mejor.'].join('\n');
    }
    if (profile.facialNeeds.includes('manchas')) {
      return ['Claro. Para manchas revisaría productos que ayuden con luminosidad, tono uniforme y prevención de nuevas marcas.', profile.nextQuestion ?? '¿Tu piel es grasa, seca, mixta o sensible? Así te recomiendo mejor.'].join('\n');
    }
    return profile.nextQuestion ?? 'Claro. Cuéntame qué quieres mejorar: acné, manchas, resequedad, piel grasa, sensibilidad, ojeras o una rutina básica.';
  }
  private recommendationResponse(products: ProductCandidate[], search: ProductSearchResult, usdRate?: number | null) {
    const lines = ['Estas opciones tienen más sentido para lo que buscas:', ''];
    lines.push(...products.slice(0, 3).map((candidate, index) => this.productSummary(candidate, index, usdRate, search)));
    lines.push('', '¿Cuál de estas opciones prefieres?');
    return lines.join('\n');
  }

  private outOfStockResponse(candidate: ProductCandidate, alternatives: ProductCandidate[], usdRate?: number | null) {
    const lines = [`${this.productName(candidate.product)} está agotado por ahora.`];
    if (alternatives.length) {
      lines.push('Para no dejarte sin opción, revisaría estas alternativas disponibles:');
      lines.push(...alternatives.slice(0, 3).map((item, index) => this.productSummary(item, index, usdRate)));
      lines.push('¿Quieres que te ayude a escoger la más parecida?');
    } else {
      lines.push('Si me dices para qué lo necesitas, busco una alternativa por beneficio, marca o presupuesto.');
    }
    return lines.join('\n');
  }

  private uncertainResponse(search: ProductSearchResult) {
    return ['No quiero adivinarte mal, pero encontré opciones parecidas:', ...search.candidates.slice(0, 3).map((candidate, index) => `${index + 1}. ${this.productName(candidate.product)} (${candidate.product.stock > 0 ? 'disponible' : 'agotado'})`), '¿Cuál querías revisar?'].join('\n');
  }

  private noMatchResponse(search: ProductSearchResult) {
    const profile = search.entity.dermoProfile;
    if (profile.shouldAskBeforeRecommend) return this.investigationResponse(search);
    return 'No veo una coincidencia clara en el catálogo. Dame una pista más: marca, tipo de producto, necesidad de la piel o presupuesto, y busco opciones reales.';
  }

  private productSummary(candidate: ProductCandidate, index: number, usdRate?: number | null, search?: ProductSearchResult) {
    const product = candidate.product;
    return `${index + 1}. ${this.productName(product)} — ${this.productRole(product)}. ${this.evidenceLine(candidate, search)} ${this.dualPrice(product.priceUsd, usdRate)}. ${this.stockLine(product.stock)}`;
  }

  private evidenceLine(candidate: ProductCandidate, search?: ProductSearchResult) {
    const product = candidate.product;
    const profile = search?.entity.dermoProfile;
    const text = this.productText(product);
    if (profile?.facialNeeds.includes('manchas')) {
      if (/protector|solar|spf|sunscreen/.test(text)) return 'Ayuda a prevenir que se oscurezcan.';
      if (/niacinamida|vitamina c|txa|tranexamico|arbutina|azelaico|bright|despigmentante/.test(text)) return 'Apoya tono uniforme y luminosidad.';
      return 'Puede complementar una rutina antimanchas.';
    }
    if (profile?.facialNeeds.includes('acne') || profile?.facialNeeds.includes('piel grasa')) return 'Útil para grasa, brotes o poros.';
    if (product.description) return this.truncate(product.description, 120);
    return candidate.reasons.length ? `Coincide por ${candidate.reasons.slice(0, 2).join(' y ')}.` : 'Coincide con lo que buscas.';
  }

  private productRole(product: any) {
    const text = this.productText(product);
    if (/limpiador|cleanser|jabon|gel/.test(text)) return 'limpiador';
    if (/protector|solar|spf|sunscreen/.test(text)) return 'protector solar';
    if (/serum|suero|ampoule|vitamina|niacinamida|retinol|retinal|bright/.test(text)) return 'tratamiento';
    if (/cream|crema|hidrat|moistur/.test(text)) return 'hidratante';
    return 'complemento de rutina';
  }

  private productName(product: any) {
    const name = String(product.name ?? '').trim();
    const brand = product.brand?.name;
    if (!brand || name.toLowerCase().includes(String(brand).toLowerCase())) return name;
    return `${name} de ${brand}`;
  }

  private dualPrice(priceUsd: unknown, usdRate?: number | null) {
    const usd = Number(priceUsd);
    if (!Number.isFinite(usd)) return 'Precio por confirmar';
    if (!usdRate) return `Precio: $${usd.toFixed(2)} USD`;
    return `Precio: $${usd.toFixed(2)} USD / Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(usd * usdRate)}`;
  }

  private stockLine(stock: unknown) {
    const value = Number(stock);
    if (!Number.isFinite(value)) return 'Disponibilidad por confirmar.';
    if (value <= 0) return 'Agotado por ahora.';
    return value === 1 ? 'Stock: 1 unidad.' : `Stock: ${value} unidades.`;
  }

  private productText(product: any) {
    return `${product.name ?? ''} ${product.brand?.name ?? ''} ${product.category ?? ''} ${product.description ?? ''} ${(product.tags ?? []).join(' ')}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
  }
}
