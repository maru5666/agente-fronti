const WORD_REPAIRS: Array<[RegExp, string]> = [
  [new RegExp('Categor(?:\\uFFFD|\\?)as', 'gi'), 'Categorías'],
  [new RegExp('Categor(?:\\uFFFD|\\?)a', 'gi'), 'Categoría'],
  [new RegExp('Descripci(?:\\uFFFD|\\?)n', 'gi'), 'Descripción'],
  [new RegExp('Configuraci(?:\\uFFFD|\\?)n', 'gi'), 'Configuración'],
  [new RegExp('Promoci(?:\\uFFFD|\\?)n', 'gi'), 'Promoción'],
  [new RegExp('Informaci(?:\\uFFFD|\\?)n', 'gi'), 'Información'],
  [new RegExp('Direcci(?:\\uFFFD|\\?)n', 'gi'), 'Dirección'],
  [new RegExp('Ubicaci(?:\\uFFFD|\\?)n', 'gi'), 'Ubicación'],
  [new RegExp('Env(?:\\uFFFD|\\?)o', 'gi'), 'Envío'],
  [new RegExp('Contrase(?:\\uFFFD|\\?)a', 'gi'), 'Contraseña'],
  [new RegExp('Atenci(?:\\uFFFD|\\?)n', 'gi'), 'Atención'],
  [new RegExp('sesi(?:\\uFFFD|\\?)n', 'gi'), 'sesión'],
  [new RegExp('autom(?:\\uFFFD|\\?)tica', 'gi'), 'automática'],
  [new RegExp('m(?:\\uFFFD|\\?)nimo', 'gi'), 'mínimo'],
  [new RegExp('reposici(?:\\uFFFD|\\?)n', 'gi'), 'reposición'],
  [new RegExp('selecci(?:\\uFFFD|\\?)nala', 'gi'), 'selecciónala'],
  [new RegExp('cat(?:\\uFFFD|\\?)logo', 'gi'), 'catálogo'],
  [new RegExp('d(?:\\uFFFD|\\?)a', 'gi'), 'día'],
  [new RegExp('m(?:\\uFFFD|\\?)s', 'gi'), 'más'],
  [new RegExp('San Crist(?:\\uFFFD|\\?)bal', 'g'), 'San Cristóbal'],
  [new RegExp('T(?:\\uFFFD|\\?)chira', 'g'), 'Táchira'],
  [new RegExp('c(?:\\uFFFD|\\?)rculo', 'gi'), 'círculo'],
  [new RegExp('pol(?:\\uFFFD|\\?)gono', 'gi'), 'polígono'],
  [new RegExp('Tambi(?:\\uFFFD|\\?)n', 'gi'), 'También'],
];

const MOJIBAKE_REPAIRS: Array<[RegExp, string]> = [
  [new RegExp('\\u00c3\\u00a1', 'g'), 'á'],
  [new RegExp('\\u00c3\\u00a9', 'g'), 'é'],
  [new RegExp('\\u00c3\\u00ad', 'g'), 'í'],
  [new RegExp('\\u00c3\\u00b3', 'g'), 'ó'],
  [new RegExp('\\u00c3\\u00ba', 'g'), 'ú'],
  [new RegExp('\\u00c3\\u00b1', 'g'), 'ñ'],
  [new RegExp('\\u00c3\\u0081', 'g'), 'Á'],
  [new RegExp('\\u00c3\\u0089', 'g'), 'É'],
  [new RegExp('\\u00c3\\u008d', 'g'), 'Í'],
  [new RegExp('\\u00c3\\u0093', 'g'), 'Ó'],
  [new RegExp('\\u00c3\\u009a', 'g'), 'Ú'],
  [new RegExp('\\u00c3\\u0091', 'g'), 'Ñ'],
  [new RegExp('\\u00c2\\u00bf', 'g'), '¿'],
  [new RegExp('\\u00c2\\u00a1', 'g'), '¡'],
  [new RegExp('\\u00c2', 'g'), ''],
  [new RegExp('\\u00e2\\u20ac\\u2122', 'g'), '’'],
  [new RegExp('\\u00e2\\u20ac\\u0153', 'g'), '“'],
  [new RegExp('\\u00e2\\u20ac\\u009d', 'g'), '”'],
  [new RegExp('\\u00e2\\u20ac\\u201d', 'g'), '—'],
  [new RegExp('\\u00e2\\u20ac\\u201c', 'g'), '–'],
  [new RegExp('\\u00e2\\u20ac\\u00a6', 'g'), '…'],
];

export function normalizeText(value: string) {
  let normalized = value.normalize('NFC');

  if (/[\u00c3\u00c2\u00e2]/.test(normalized)) {
    for (const [pattern, replacement] of MOJIBAKE_REPAIRS) {
      normalized = normalized.replace(pattern, replacement);
    }
  }

  for (const [pattern, replacement] of WORD_REPAIRS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\uFFFD/g, '').normalize('NFC');
}

export function normalizeValue<T>(value: T): T {
  if (typeof value === 'string') {
    return normalizeText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        normalizeValue(item),
      ]),
    ) as T;
  }

  return value;
}
