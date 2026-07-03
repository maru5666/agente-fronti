import { FrontiIntent } from '../agent.types';

export type ProductSearchIntent =
  | FrontiIntent
  | 'buscar_marca'
  | 'recomendacion'
  | 'promociones'
  | 'comparar_productos'
  | 'alternativa'
  | 'detalles';

export type DermocosmeticProfile = {
  facialNeeds: string[];
  skinTypes: string[];
  objectives: string[];
  productRoles: string[];
  ingredientHints: string[];
  broadRequest: boolean;
  exploratoryProblem: boolean;
  medicalCaution: boolean;
  shouldAskBeforeRecommend: boolean;
  nextQuestion: string | null;
};

export type ProductEntity = {
  rawQuery: string;
  searchQuery: string;
  expandedQuery: string;
  brandHint: string | null;
  brandAliases: string[];
  categoryHint: string | null;
  benefitHints: string[];
  budgetHint: number | null;
  preferenceHints: string[];
  asksPrice: boolean;
  asksStock: boolean;
  asksPhoto: boolean;
  dermoProfile: DermocosmeticProfile;
};

export type ProductForAi = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  mainImage: string | null;
  priceUsd: unknown;
  currencyBase: string | null;
  stock: number;
  minStock: number;
  isActive: boolean;
  brand: { name: string; logo?: string | null } | null;
  promotions: Array<{
    title: string;
    description: string | null;
    discountPercent: unknown;
    isActive: boolean;
  }>;
};

export type ProductCandidate = {
  product: ProductForAi;
  score: number;
  reasons: string[];
  exact: boolean;
};

export type ProductSearchResult = {
  query: string;
  normalizedQuery: string;
  entity: ProductEntity;
  candidates: ProductCandidate[];
  available: ProductCandidate[];
  outOfStock: ProductCandidate[];
  related: ProductCandidate[];
  uncertain: boolean;
};

export type ProductConversationMemory = {
  customerName?: string | null;
  lastProductId?: string | null;
  lastProductName?: string | null;
  lastBrand?: string | null;
  lastCategory?: string | null;
  lastQuery?: string | null;
  lastIntent?: string | null;
  lastProductWasOutOfStock?: boolean;
  viewedProducts?: Array<{ id: string; name: string; brand?: string | null; category?: string | null }>;
  recommendedProducts?: Array<{ id: string; name: string; brand?: string | null; category?: string | null }>;
  preferences?: string[];
  budgetHint?: number | null;
  language?: string;
};
