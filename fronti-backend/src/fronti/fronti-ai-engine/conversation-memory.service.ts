import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductConversationMemory, ProductForAi } from './engine.types';

@Injectable()
export class ConversationMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  getMetadata(state?: { metadata?: unknown } | null): Record<string, any> {
    return this.asRecord(state?.metadata);
  }

  getProductMemory(state?: { metadata?: unknown } | null): ProductConversationMemory {
    return this.asRecord(this.getMetadata(state).productContext) as ProductConversationMemory;
  }

  async updateMetadata(input: { companyId: string; senderPhone: string; metadata: Record<string, any>; currentIntent: string | null; awaitingField: string | null }) {
    return this.prisma.conversationState.upsert({
      where: { companyId_senderPhone: { companyId: input.companyId, senderPhone: input.senderPhone } },
      create: { companyId: input.companyId, senderPhone: input.senderPhone, currentIntent: input.currentIntent, awaitingField: input.awaitingField, metadata: input.metadata as Prisma.InputJsonValue },
      update: { currentIntent: input.currentIntent, awaitingField: input.awaitingField, metadata: input.metadata as Prisma.InputJsonValue },
    });
  }

  async rememberProduct(input: { companyId: string; senderPhone: string; product?: ProductForAi | null; query: string; intent: string; outOfStock?: boolean; currentIntent?: string | null; awaitingField?: string | null; previousMetadata: unknown; recommendedProducts?: ProductForAi[]; extraMetadata?: Record<string, any> }) {
    const previous = this.asRecord(input.previousMetadata);
    const previousContext = this.asRecord(previous.productContext) as ProductConversationMemory;
    const product = input.product;
    const nextContext: ProductConversationMemory = {
      ...previousContext,
      lastProductId: product?.id ?? previousContext.lastProductId,
      lastProductName: product?.name ?? previousContext.lastProductName,
      lastBrand: product?.brand?.name ?? previousContext.lastBrand,
      lastCategory: product?.category ?? previousContext.lastCategory,
      lastQuery: input.query,
      lastIntent: input.intent,
      lastProductWasOutOfStock: product ? Boolean(input.outOfStock) : previousContext.lastProductWasOutOfStock,
      viewedProducts: this.mergeViewedProducts(previousContext.viewedProducts, product),
      recommendedProducts: (input.recommendedProducts ?? []).slice(0, 3).map((item) => ({ id: item.id, name: item.name, brand: item.brand?.name, category: item.category })),
      preferences: this.mergePreferences(previousContext.preferences, this.inferPreferences(input.query, product)),
      budgetHint: this.extractBudget(input.query) ?? previousContext.budgetHint,
      language: 'es',
    };

    return this.prisma.conversationState.upsert({
      where: { companyId_senderPhone: { companyId: input.companyId, senderPhone: input.senderPhone } },
      create: { companyId: input.companyId, senderPhone: input.senderPhone, currentIntent: input.currentIntent ?? input.intent, awaitingField: input.awaitingField, metadata: { ...previous, ...(input.extraMetadata ?? {}), productContext: nextContext } as Prisma.InputJsonValue },
      update: { currentIntent: input.currentIntent ?? input.intent, awaitingField: input.awaitingField, metadata: { ...previous, ...(input.extraMetadata ?? {}), productContext: nextContext } as Prisma.InputJsonValue },
    });
  }

  private asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
  }

  private mergeViewedProducts(current: unknown, product?: ProductForAi | null) {
    const list = Array.isArray(current) ? current.filter((item) => item && typeof item === 'object') as any[] : [];
    if (!product) return list.slice(-5);
    return [...list.filter((item) => item.id !== product.id), { id: product.id, name: product.name, brand: product.brand?.name, category: product.category }].slice(-5);
  }

  private mergePreferences(current: unknown, next: string[]) {
    const previous = Array.isArray(current) ? current.filter((item) => typeof item === 'string') : [];
    return [...new Set([...previous, ...next])].slice(-8);
  }

  private inferPreferences(query: string, product?: ProductForAi | null) {
    const text = `${query} ${product?.name ?? ''} ${product?.category ?? ''} ${product?.description ?? ''}`.toLowerCase();
    const preferences: string[] = [];
    if (/mancha|melasma|post acne|pigmentacion|tono desigual|vitamina c/.test(text)) preferences.push('manchas');
    if (/acne|granito|poro|sebo|grasa/.test(text)) preferences.push('acne o piel grasa');
    if (/sensible|rojez|cica|centella|barrera/.test(text)) preferences.push('piel sensible');
    if (/hidrat|seca|reseca|ceramida/.test(text)) preferences.push('hidratacion');
    return preferences;
  }

  private extractBudget(query: string) {
    const match = query.toLowerCase().match(/(?:hasta|maximo|presupuesto|menos de)\s*(?:usd|\$)?\s*(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : undefined;
  }
}
