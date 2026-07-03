import { IntentClassifierService } from './intent-classifier.service';
import { ResponseComposerService } from './response-composer.service';
import { ResponseGeneratorService } from './response-generator.service';
import { TextNormalizerService } from './text-normalizer.service';
import { ProductSearchResult } from './engine.types';

describe('Fronti conversational behavior', () => {
  const normalizer = new TextNormalizerService();
  const intentClassifier = new IntentClassifierService(normalizer);
  const composer = new ResponseComposerService();
  const generator = new ResponseGeneratorService();

  it('responde un saludo sin buscar ni ofrecer productos', () => {
    const intent = intentClassifier.classify({ message: 'Hola' });
    const response = composer.greeting('neutral');

    expect(intent).toBe('saludo');
    expect(response).toContain('\u00a1Hola!');
    expect(response).toContain('piel');
    expect(response).not.toMatch(/producto disponible|cat\u00e1logo|inventario/i);
  });

  it('pregunta la necesidad cuando el cliente pide algo general para la cara', () => {
    const response = generator.productResponse({
      search: buildSearch({
        query: 'necesito algo para la cara',
        broadRequest: true,
        exploratoryProblem: true,
        facialNeeds: [],
        skinTypes: [],
        shouldAskBeforeRecommend: true,
        nextQuestion: 'Claro. \u00bfQuieres mejorar acn\u00e9, manchas, resequedad, piel grasa, sensibilidad, ojeras o una rutina b\u00e1sica?',
        withAvailableProduct: false,
      }),
      alternatives: [],
      intent: 'recomendacion',
      bcvAvailable: false,
    });

    expect(response).toContain('\u00bfQuieres mejorar acn\u00e9');
    expect(response).not.toMatch(/1\.|Precio:|Stock:/i);
  });

  it('para acn\u00e9 ya detecta la necesidad y solo pregunta tipo de piel', () => {
    const response = generator.productResponse({
      search: buildSearch({
        query: 'acn\u00e9',
        broadRequest: false,
        exploratoryProblem: false,
        facialNeeds: ['acne'],
        skinTypes: [],
        shouldAskBeforeRecommend: true,
        nextQuestion: '\u00bfTu piel es grasa, seca, mixta o sensible? As\u00ed te recomiendo mejor.',
        withAvailableProduct: true,
      }),
      alternatives: [],
      intent: 'recomendacion',
      bcvAvailable: true,
      usdRate: 620,
    });

    expect(response).toContain('Para acn\u00e9');
    expect(response).toContain('\u00bfTu piel es grasa, seca, mixta o sensible?');
    expect(response).not.toContain('\u00bfEs un brote inflamado');
    expect(response).not.toContain('Cu\u00e9ntame qu\u00e9 quieres mejorar');
  });

  it('cuando ya conoce acn\u00e9 y piel grasa recomienda productos reales', () => {
    const response = generator.productResponse({
      search: buildSearch({
        query: 'acn\u00e9 grasa',
        broadRequest: false,
        exploratoryProblem: false,
        facialNeeds: ['acne', 'piel grasa'],
        skinTypes: ['grasa'],
        shouldAskBeforeRecommend: false,
        nextQuestion: null,
        withAvailableProduct: true,
      }),
      alternatives: [],
      intent: 'recomendacion',
      bcvAvailable: true,
      usdRate: 620,
    });

    expect(response).toContain('1. Gel calmante');
    expect(response).toContain('Precio: $20.00 USD / Bs.');
    expect(response).toContain('Stock: 4 unidades');
    expect(response).toContain('\u00bfCu\u00e1l de estas opciones prefieres?');
  });

  it('usa memoria para interpretar "productos" como seguimiento de producto', () => {
    const intent = intentClassifier.classify({
      message: 'productos',
      state: { currentIntent: 'product', awaitingField: 'skin_type' },
    });

    expect(intent).toBe('recomendacion');
  });
});

function buildSearch(input: {
  query: string;
  broadRequest: boolean;
  facialNeeds: string[];
  skinTypes: string[];
  nextQuestion: string | null;
  exploratoryProblem: boolean;
  shouldAskBeforeRecommend: boolean;
  withAvailableProduct: boolean;
}): ProductSearchResult {
  const product = {
    id: 'product-1',
    name: 'Gel calmante',
    description: 'Tratamiento para brotes, acn\u00e9 y piel grasa',
    category: 'Skincare',
    tags: ['acne', 'piel grasa'],
    mainImage: null,
    priceUsd: 20,
    currencyBase: 'USD',
    stock: 4,
    minStock: 1,
    isActive: true,
    brand: { name: 'Fronti Skin' },
    promotions: [],
  };

  const candidate = {
    product,
    score: 80,
    reasons: ['necesidad: acne'],
    exact: false,
  };

  return {
    query: input.query,
    normalizedQuery: input.query,
    entity: {
      rawQuery: input.query,
      searchQuery: input.query,
      expandedQuery: input.query,
      brandHint: null,
      categoryHint: null,
      brandAliases: [],
      benefitHints: input.facialNeeds,
      budgetHint: null,
      preferenceHints: [],
      asksPrice: false,
      asksStock: false,
      asksPhoto: false,
      dermoProfile: {
        facialNeeds: input.facialNeeds,
        skinTypes: input.skinTypes,
        objectives: [],
        productRoles: [],
        ingredientHints: [],
        broadRequest: input.broadRequest,
        exploratoryProblem: input.exploratoryProblem,
        medicalCaution: false,
        shouldAskBeforeRecommend: input.shouldAskBeforeRecommend,
        nextQuestion: input.nextQuestion,
      },
    },
    candidates: input.withAvailableProduct ? [candidate] : [],
    available: input.withAvailableProduct ? [candidate] : [],
    outOfStock: [],
    related: [],
    uncertain: false,
  };
}
