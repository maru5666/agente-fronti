export function renderSafeValue(value: unknown, fallback = 'No disponible'): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback;
  }

  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No';
  }

  if (Array.isArray(value)) {
    const rendered = value
      .map((item) => renderSafeValue(item, ''))
      .filter(Boolean)
      .join(', ');
    return rendered || fallback;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const preferredKeys = [
      'formattedAddress',
      'formatted_address',
      'address',
      'name',
      'label',
      'title',
      'message',
      'text',
      'description',
      'zoneName',
      'distanceText',
      'durationText',
      'value',
    ];

    for (const key of preferredKeys) {
      if (key in record) {
        const rendered = renderSafeValue(record[key], '');
        if (rendered) return rendered;
      }
    }

    return fallback;
  }

  return fallback;
}

export function renderSafeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}
