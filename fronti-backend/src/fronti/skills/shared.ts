export function includesAny(message: string, values: string[]) {
  return values.some((value) => message.includes(value));
}

export function extractProductQuery(message: string) {
  return message
    .replace(/[?¿!¡.,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !productStopWords.has(word))
    .join(' ')
    .trim();
}

const productStopWords = new Set([
  'a',
  'al',
  'bs',
  'busco',
  'buscar',
  'cuanto',
  'cuesta',
  'cuestan',
  'de',
  'del',
  'disponible',
  'el',
  'en',
  'hay',
  'la',
  'las',
  'lo',
  'los',
  'me',
  'necesito',
  'por',
  'precio',
  'que',
  'quiero',
  'recomienda',
  'recomiendas',
  'tienen',
  'tiene',
  'un',
  'una',
  'usd',
  'venden',
]);
