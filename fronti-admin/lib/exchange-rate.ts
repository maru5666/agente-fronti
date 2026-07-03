export function convertUsdToBs(priceUsd: number, usdRate: number | null | undefined) {
  if (!Number.isFinite(priceUsd) || !usdRate || !Number.isFinite(usdRate)) {
    return null;
  }

  return Number((priceUsd * usdRate).toFixed(2));
}

export function formatUsd(value: number) {
  if (!Number.isFinite(value)) {
    return 'Precio no disponible';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatBs(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'BCV no disponible';
  }

  return `Bs. ${new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export function formatDualPrice(priceUsd: number, usdRate: number | null | undefined) {
  const priceBs = convertUsdToBs(priceUsd, usdRate);

  return {
    priceUsd,
    priceBs,
    formattedUsd: formatUsd(priceUsd),
    formattedBs: formatBs(priceBs),
  };
}
