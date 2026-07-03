import { convertUsdToBs, formatBs, formatUsd } from './exchange-rate';
import type { Product } from '@/types';

export type ProductPriceView = {
  usdValue: number | null;
  bsValue: number | null;
  formattedUsd: string;
  formattedBs: string;
  hasUsdPrice: boolean;
  hasBcvRate: boolean;
};

export function formatProductPrice(
  product: Pick<Product, 'priceUsd'> | null | undefined,
  exchangeRate: number | string | null | undefined,
): ProductPriceView {
  const usdValue = toFiniteNumber(product?.priceUsd);
  const bcvRate = toFiniteNumber(exchangeRate);
  const bsValue = usdValue !== null && bcvRate !== null ? convertUsdToBs(usdValue, bcvRate) : null;

  return {
    usdValue,
    bsValue,
    formattedUsd: usdValue !== null ? formatUsd(usdValue) : 'Precio no disponible',
    formattedBs: bsValue !== null ? formatBs(bsValue) : 'BCV no disponible',
    hasUsdPrice: usdValue !== null,
    hasBcvRate: bcvRate !== null,
  };
}

export function toFiniteNumber(value: number | string | SerializedDecimal | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (isSerializedDecimal(value)) {
    return serializedDecimalToNumber(value);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const raw = value.trim();
  if (!raw) return null;

  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

type SerializedDecimal = {
  s?: number;
  e?: number;
  d?: number[];
};

function isSerializedDecimal(value: unknown): value is SerializedDecimal {
  return (
    typeof value === 'object' &&
    value !== null &&
    'd' in value &&
    Array.isArray((value as SerializedDecimal).d)
  );
}

function serializedDecimalToNumber(value: SerializedDecimal) {
  const sign = value.s === -1 ? -1 : 1;
  const exponent = typeof value.e === 'number' ? value.e : 0;
  const digits = value.d
    ?.map((chunk, index) => (index === 0 ? String(chunk) : String(chunk).padStart(7, '0')))
    .join('');

  if (!digits || !/^\d+$/.test(digits)) {
    return null;
  }

  const integerLength = exponent + 1;
  let normalized: string;

  if (integerLength <= 0) {
    normalized = `0.${'0'.repeat(Math.abs(integerLength))}${digits}`;
  } else if (integerLength >= digits.length) {
    normalized = `${digits}${'0'.repeat(integerLength - digits.length)}`;
  } else {
    normalized = `${digits.slice(0, integerLength)}.${digits.slice(integerLength)}`;
  }

  const parsed = Number(normalized) * sign;
  return Number.isFinite(parsed) ? parsed : null;
}
