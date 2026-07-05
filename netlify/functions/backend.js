const demoData = require('./beautyhub-demo-data.json');

const COMPANY = demoData.company;
const PRODUCTS = demoData.products;
const BRANDS = demoData.brands;
const DELIVERY_ZONES = demoData.zones;
const PAYMENT_METHODS = demoData.payments;
const BCV_RATE = demoData.bcv;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return response(204, null);
  }

  const proxied = await tryProxyToBackend(event);
  if (proxied) {
    return proxied;
  }

  try {
    const method = event.httpMethod;
    const route = normalizeRoute(event.path);
    const body = parseBody(event.body);

    if (method === 'GET' && route === '/health') {
      return response(200, {
        status: 'ok',
        database: 'demo',
        bcv: 'connected',
        maps: 'demo',
        timestamp: new Date().toISOString(),
      });
    }

    if (method === 'GET' && route === '/companies/workspace/beautyhub') {
      return response(200, COMPANY);
    }

    if (method === 'GET' && (route === '/api/businesses' || route === '/businesses')) {
      return response(200, [COMPANY]);
    }

    if (method === 'GET' && (route === '/api/businesses/beautyhub' || route === '/businesses/beautyhub')) {
      return response(200, COMPANY);
    }

    if (method === 'GET' && route === '/companies/access/beautyhub') {
      return response(200, COMPANY);
    }

    if (method === 'GET' && route === `/companies/${COMPANY.id}`) {
      return response(200, COMPANY);
    }

    if (method === 'GET' && route === '/bcv/latest') {
      return response(200, BCV_RATE);
    }

    if (method === 'POST' && route === '/bcv/sync') {
      return response(201, { ...BCV_RATE, fetchedAt: new Date().toISOString(), status: 'updated' });
    }

    if (method === 'GET' && route === `/products/company/${COMPANY.id}`) {
      return response(200, PRODUCTS);
    }

    if (method === 'GET' && (route === '/api/products' || route === '/products')) {
      return response(200, PRODUCTS.filter((product) => product.companyId === COMPANY.id));
    }

    if (method === 'GET' && (route === '/api/inventory' || route === '/inventory')) {
      return response(200, PRODUCTS.filter((product) => product.companyId === COMPANY.id).map((product) => ({
        id: product.id,
        companyId: product.companyId,
        productId: product.id,
        productName: product.name,
        brand: product.brand?.name || null,
        category: product.category,
        stock: product.stock,
        minStock: product.minStock,
        isActive: product.isActive,
      })));
    }

    if (method === 'GET' && route === `/products/company/${COMPANY.id}/low-stock`) {
      return response(200, PRODUCTS.filter((product) => product.isActive && product.stock <= Math.max(product.minStock, 1)));
    }

    if (method === 'GET' && route === `/products/company/${COMPANY.id}/metrics`) {
      const active = PRODUCTS.filter((product) => product.isActive);
      return response(200, {
        total: PRODUCTS.length,
        active: active.length,
        lowStock: active.filter((product) => product.stock > 0 && product.stock <= Math.max(product.minStock, 1)).length,
        outOfStock: active.filter((product) => product.stock <= 0).length,
      });
    }

    if (method === 'GET' && route === `/brands/company/${COMPANY.id}`) {
      return response(200, BRANDS);
    }

    if (method === 'GET' && route === `/promotions/company/${COMPANY.id}/active`) {
      return response(200, []);
    }

    if (method === 'GET' && route === `/delivery-zones/company/${COMPANY.id}`) {
      return response(200, DELIVERY_ZONES);
    }

    if (method === 'GET' && route === '/delivery-zones/local-references/san-cristobal') {
      return response(200, getLocalReferences());
    }

    if (method === 'GET' && route === `/payment-methods/company/${COMPANY.id}`) {
      return response(200, PAYMENT_METHODS);
    }

    if (method === 'GET' && route === `/orders/company/${COMPANY.id}/summary`) {
      return response(200, {
        pendingOrders: 0,
        activeDeliveries: 0,
        todayOrders: 0,
        todayRevenueUsd: '0',
        todayRevenueBs: '0',
        recentOrders: [],
      });
    }

    if (method === 'GET' && route === `/orders/company/${COMPANY.id}`) {
      return response(200, []);
    }

    if (method === 'POST' && route === '/fronti/chat') {
      return response(201, {
        response: composeFrontiReply(body),
        messageId: cryptoId('msg'),
      });
    }

    if (method === 'POST' && (route === '/api/chat' || route === '/chat')) {
      return response(201, {
        response: composeFrontiReply(body),
        messageId: cryptoId('msg'),
      });
    }

    if (method === 'POST' && route === '/delivery/location') {
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return response(400, { message: 'No se recibieron coordenadas válidas.' });
      }

      return response(201, composeDeliveryLocation(latitude, longitude));
    }

    if (method === 'POST' && (route === '/api/delivery' || route === '/delivery')) {
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return response(201, composeDeliveryLocation(latitude, longitude));
      }

      return response(201, composeDeliveryEstimate(body));
    }

    if (method === 'POST' && route === '/delivery-zones/estimate') {
      return response(201, composeDeliveryEstimate(body));
    }

    if (method === 'POST' && route === '/orders') {
      const order = composeOrder(body);
      return response(201, order);
    }

    if (method === 'POST' && route === '/orders/payment-proof') {
      return response(201, {
        proof: {
          id: cryptoId('proof'),
          companyId: body.companyId || COMPANY.id,
          customerPhone: body.customerPhone,
          reference: body.reference || null,
          status: 'pago_en_revision',
          createdAt: new Date().toISOString(),
        },
        response: 'Recibí el comprobante. Lo enviaré a verificación y te avisaremos apenas sea confirmado.',
      });
    }

    return response(404, { message: 'Ruta demo no encontrada.' });
  } catch (error) {
    console.error('[Frontti Netlify backend]', error);
    return response(500, { message: 'Ocurrió un error interno. Intenta nuevamente en unos segundos.' });
  }
};

async function tryProxyToBackend(event) {
  const target = process.env.FRONTI_BACKEND_URL?.trim().replace(/\/$/, '');
  if (!target || isLocalUrl(target)) {
    return null;
  }

  try {
    const route = normalizeRoute(event.path);
    const proxyResponse = await fetch(`${target}${route}${event.rawQuery ? `?${event.rawQuery}` : ''}`, {
      method: event.httpMethod,
      headers: {
        'content-type': event.headers['content-type'] || 'application/json',
      },
      body: ['GET', 'HEAD'].includes(event.httpMethod) ? undefined : event.body,
      signal: AbortSignal.timeout(9000),
    });

    const text = await proxyResponse.text();
    return {
      statusCode: proxyResponse.status,
      headers: corsHeaders(proxyResponse.headers.get('content-type') || 'application/json; charset=utf-8'),
      body: text,
    };
  } catch (error) {
    console.warn('[Frontti Netlify backend] Backend real no disponible, usando demo local:', error.message);
    return null;
  }
}

function normalizeRoute(pathname) {
  return pathname
    .replace(/^\/api\/backend/, '')
    .replace(/^\/\.netlify\/functions\/backend/, '')
    .replace(/\/$/, '') || '/';
}

function parseBody(rawBody) {
  if (!rawBody) return {};
  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
}

function response(statusCode, payload) {
  return {
    statusCode,
    headers: corsHeaders('application/json; charset=utf-8'),
    body: payload === null ? '' : JSON.stringify(payload),
  };
}

function corsHeaders(contentType) {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'content-type': contentType,
  };
}

function isLocalUrl(url) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url);
}

function composeFrontiReply(body) {
  const message = normalizeText(body.message || '');
  const context = body.conversationContext || {};
  const contextualNeed = detectNeed(message) || normalizeText(context.lastNeed || '');
  const skinType = detectSkinType(message) || normalizeText(context.lastSkinType || '');

  if (!message || /^(hola|buenas|buenos dias|buen dia|hey|epa|holi)$/i.test(message)) {
    return '\u00a1Hola! \ud83d\ude0a \u00bfQu\u00e9 est\u00e1s buscando mejorar hoy en tu piel?';
  }

  if (/presupuesto|dolares|barato|economico|premium/.test(message)) {
    return recommendByBudget(message);
  }

  if (contextualNeed) {
    const need = getNeedConfig(contextualNeed);
    return recommendByNeed(need.label, need.tokens, skinType, need.key);
  }

  const brandMatches = findBrandProducts(message);
  if (brandMatches.length) {
    return composeBrandReply(brandMatches);
  }

  const matched = findProduct(message);
  if (matched) {
    return composeProductReply(matched);
  }

  if (/catalogo|productos|opciones|que tienen|muestrame/.test(message) && !contextualNeed) {
    return 'Claro. Tenemos el cat\u00e1logo de Beauty Hub conectado. Puedes preguntarme por una marca, un producto o una necesidad de tu piel y te muestro opciones reales con precio y stock.';
  }

  return 'S\u00ed, te ayudo. Para recomendarte bien, dime qu\u00e9 quieres mejorar: manchas, acn\u00e9, piel grasa, resequedad, sensibilidad, ros\u00e1cea, protector solar o una rutina b\u00e1sica.';
}

function composeProductReply(product) {
  const description = shortDescription(product);
  return [
    'S\u00ed, tenemos ' + product.name + (product.brand?.name ? ' de ' + product.brand.name : '') + '.',
    description ? 'Por lo que indica el cat\u00e1logo, ' + description : null,
    'Precio: $' + formatMoney(product.priceUsd) + ' USD / Bs. ' + formatBs(Number(product.priceUsd) * Number(BCV_RATE.usdRate)) + '.',
    'Stock: ' + product.stock + ' unidades.',
    '\u00bfConfirmas que quieres agregar este producto al pedido?',
  ].filter(Boolean).join('\n');
}

function composeBrandReply(products) {
  const brand = products[0]?.brand?.name || 'esa marca';
  const productLines = products.slice(0, 3).map((product, index) => {
    return (index + 1) + '. ' + product.name + ' - $' + formatMoney(product.priceUsd) + ' USD / Bs. ' + formatBs(Number(product.priceUsd) * Number(BCV_RATE.usdRate)) + '. Stock: ' + product.stock + '.';
  });
  return ['S\u00ed, trabajamos ' + brand + '. Encontr\u00e9 estas opciones disponibles:', '', ...productLines, '', '\u00bfQuieres que te aparte alguna o prefieres que compare cu\u00e1l va mejor para tu piel?'].join('\n');
}

function recommendByNeed(need, tokens, skinType, needKey) {
  const candidates = PRODUCTS
    .filter((product) => product.isActive && product.stock > 0)
    .map((product) => ({ product, score: scoreProduct(product, tokens, skinType, needKey) }))
    .filter((item) => item.score >= 5)
    .sort((a, b) => b.score - a.score || Number(a.product.priceUsd) - Number(b.product.priceUsd))
    .slice(0, 3)
    .map(({ product, score }, index) => {
      return (index + 1) + '. ' + product.name + (product.brand?.name ? ' de ' + product.brand.name : '') + '\n   ' + buildReason(product, needKey, score) + '\n   $' + formatMoney(product.priceUsd) + ' USD / Bs. ' + formatBs(Number(product.priceUsd) * Number(BCV_RATE.usdRate)) + '. Stock: ' + product.stock + '.';
    });

  if (!candidates.length) {
    return 'Puedo orientarte con ' + need + ', pero no veo una opci\u00f3n claramente relacionada y disponible en este momento. Si quieres, reviso alternativas por presupuesto o por tipo de piel.';
  }

  const intro = skinType ? 'Para ' + need + ' en piel ' + skinType + ', revis\u00e9 el inventario y priorizar\u00eda estas opciones:' : 'Para ' + need + ', revis\u00e9 el inventario y estas opciones tienen m\u00e1s sentido:';
  return [intro, '', ...candidates, '', '\u00bfCu\u00e1l de estas opciones prefieres que agregue al pedido?'].join('\n');
}

function recommendByBudget(message) {
  const match = message.match(/(\d+(?:[.,]\d+)?)/);
  const budget = match ? Number(match[1].replace(',', '.')) : 0;
  const available = PRODUCTS
    .filter((product) => product.isActive && product.stock > 0 && (!budget || Number(product.priceUsd) <= budget))
    .sort((a, b) => Number(a.priceUsd) - Number(b.priceUsd))
    .slice(0, 3);
  if (!available.length) return 'Con ese presupuesto no veo una opci\u00f3n clara disponible ahora mismo. Si puedes subir un poco el rango, reviso alternativas mejores.';
  return ['S\u00ed. Dentro de ese presupuesto revisar\u00eda estas opciones disponibles:', '', ...available.map((product, index) => (index + 1) + '. ' + product.name + ' - $' + formatMoney(product.priceUsd) + ' USD. Stock: ' + product.stock + '.'), '', '\u00bfQuieres que compare alguna por beneficio?'].join('\n');
}

function getNeedConfig(need) {
  const normalized = normalizeText(need);
  const configs = [
    { key: 'manchas', label: 'manchas y tono desigual', tokens: ['mancha', 'melasma', 'tono', 'luminos', 'vitamina c', 'niacinamida', 'protector', 'despigment', 'post acne', 'postacne', 'arbutin', 'txa'] },
    { key: 'acne', label: 'acn\u00e9, brotes o piel grasa', tokens: ['acne', 'brote', 'granito', 'grasa', 'poro', 'punto negro', 'imperfeccion', 'sebo', 'niacinamida', 'centella', 'limpiador'] },
    { key: 'rosacea', label: 'ros\u00e1cea, rojez o sensibilidad', tokens: ['rosacea', 'rojez', 'sensible', 'irrit', 'calmar', 'centella', 'pantenol', 'barrera', 'suave'] },
    { key: 'hidratacion', label: 'resequedad e hidrataci\u00f3n', tokens: ['hidrat', 'seca', 'resequedad', 'barrera', 'ceramida', 'hialuronico', 'calmar', 'repar'] },
    { key: 'protector', label: 'protecci\u00f3n solar', tokens: ['protector', 'solar', 'spf', 'uv', 'oil control', 'bloqueador'] },
    { key: 'rutina', label: 'rutina facial b\u00e1sica', tokens: ['limpiador', 'hidrat', 'protector', 'serum', 'toner', 'crema'] },
  ];
  return configs.find((config) => normalized.includes(config.key) || config.tokens.some((token) => normalized.includes(normalizeText(token)))) || configs[5];
}

function detectNeed(message) {
  if (/mancha|melasma|tono|luminosidad|post acne|postacne/.test(message)) return 'manchas';
  if (/acne|brote|granito|espinilla|piel grasa|grasa|poro|punto negro/.test(message)) return 'acne';
  if (/rosacea|rojez|rojeces|sensible|irrit/.test(message)) return 'rosacea';
  if (/resequedad|seca|hidrat|barrera/.test(message)) return 'hidratacion';
  if (/protector|solar|spf|bloqueador/.test(message)) return 'protector';
  if (/rutina|skincare|cara|rostro/.test(message)) return 'rutina';
  return null;
}

function detectSkinType(message) {
  if (/piel grasa|grasa/.test(message)) return 'grasa';
  if (/piel seca|seca/.test(message)) return 'seca';
  if (/mixta/.test(message)) return 'mixta';
  if (/sensible|rosacea|rojez/.test(message)) return 'sensible';
  return null;
}

function scoreProduct(product, tokens, skinType, needKey) {
  const haystack = productHaystack(product);
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(normalizeText(token))) score += 6;
  }
  if (skinType && haystack.includes(normalizeText(skinType))) score += 8;
  if (needKey === 'rosacea' && /retinol|retinal|acido|peeling/.test(haystack)) score -= 24;
  if (needKey === 'manchas' && /protector|solar|spf/.test(haystack)) score += 5;
  if (needKey === 'acne' && /limpiador|cleanser|niacinamida|centella/.test(haystack)) score += 5;
  if (Number(product.stock) > 2) score += 2;
  return score;
}

function buildReason(product, needKey, score) {
  const text = productHaystack(product);
  if (needKey === 'manchas' && /protector|solar|spf/.test(text)) return 'Ayuda como apoyo clave para prevenir que las manchas se marquen m\u00e1s.';
  if (needKey === 'manchas' && /vitamina|niacinamida|tono|luminos/.test(text)) return 'Tiene relaci\u00f3n con luminosidad, tono uniforme o apoyo para marcas post-acn\u00e9.';
  if (needKey === 'acne' && /limpiador|cleanser/.test(text)) return 'Funciona como primer paso para controlar grasa, limpieza y textura.';
  if (needKey === 'acne' && /centella|niacinamida|poro|grasa/.test(text)) return 'Tiene se\u00f1ales \u00fatiles para brotes, grasa o poros visibles.';
  if (needKey === 'rosacea') return 'La priorizo porque el cat\u00e1logo la relaciona con calma, barrera o piel sensible.';
  if (needKey === 'hidratacion') return 'Tiene relaci\u00f3n con hidrataci\u00f3n, reparaci\u00f3n o barrera cut\u00e1nea.';
  if (needKey === 'protector') return 'Es una opci\u00f3n orientada a protecci\u00f3n solar dentro del cat\u00e1logo.';
  return score > 12 ? 'Es de las opciones m\u00e1s relacionadas en el inventario.' : 'Con la informaci\u00f3n disponible, parece una opci\u00f3n cercana a lo que buscas.';
}

function productHaystack(product) {
  return normalizeText([
    product.name,
    product.brand?.name,
    product.category,
    product.description,
    ...(product.tags || []),
    product.ingredients,
    product.benefits,
    product.skinType,
  ].filter(Boolean).join(' '));
}

function shortDescription(product) {
  const text = String(product.description || '').trim();
  if (!text) return '';
  return text.length > 150 ? text.slice(0, 147) + '...' : text;
}

function scoreSimilarity(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (right.includes(left) || left.includes(right)) return 1;
  const distance = levenshtein(left, right);
  return 1 - distance / Math.max(left.length, right.length, 1);
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return matrix[a.length][b.length];
}

function findBrandProducts(message) {
  const normalized = normalizeSearchText(message);
  const brands = [...new Set(PRODUCTS.map((product) => product.brand?.name).filter(Boolean))];
  const brand = brands.find((name) => {
    const normalizedBrand = normalizeSearchText(name);
    return normalized.includes(normalizedBrand) || normalizedBrand.split(/\s+/).some((part) => part.length > 2 && normalized.includes(part)) || scoreSimilarity(normalized, normalizedBrand) > 0.72;
  });
  if (!brand) return [];
  return PRODUCTS.filter((product) => product.isActive && product.stock > 0 && normalizeSearchText(product.brand?.name || '') === normalizeSearchText(brand));
}

function findProduct(message) {
  const normalized = normalizeSearchText(message)
    .replace(/jabon/g, 'jabon limpiador cleanser')
    .replace(/arencia/g, 'arencia rice mochi cleanser');
  const queryTokens = normalized.split(/\s+/).filter((word) => word.length > 2 && !['quiero', 'comprar', 'tienes', 'precio', 'cuesta', 'producto', 'productos'].includes(word));
  let best = null;
  for (const product of PRODUCTS) {
    if (!product.isActive || product.stock <= 0) continue;
    const haystack = productHaystack(product);
    let score = 0;
    for (const token of queryTokens) {
      if (haystack.includes(token)) score += 10;
      score += Math.max(...haystack.split(/\s+/).map((word) => scoreSimilarity(token, word))) * 4;
    }
    if (!best || score > best.score) best = { product, score };
  }
  return best && best.score >= 12 ? best.product : null;
}

function normalizeSearchText(value) {
  return normalizeText(value).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function composeDeliveryLocation(latitude, longitude) {
  const estimate = calculateDelivery(latitude, longitude, 'Ubicación compartida');
  const address = {
    formattedAddress: estimate.destinationAddress,
    neighborhood: estimate.zoneName,
    city: 'San Cristóbal',
    state: 'Táchira',
    country: 'Venezuela',
    latitude,
    longitude,
  };

  return {
    response: [
      `Perfecto, detecté tu ubicación cerca de ${estimate.destinationAddress}.`,
      `Distancia estimada: ${estimate.distanceKm} km.`,
      `Tiempo estimado: ${estimate.durationMinutes} min.`,
      `Costo delivery: USD ${formatMoney(estimate.deliveryFeeUsd)} / Bs. ${estimate.deliveryFeeBs}.`,
      '¿Aceptas este delivery?',
    ].join('\n'),
    address,
    delivery: {
      originName: 'Beauty Hub',
      destinationAddress: estimate.destinationAddress,
      status: 'calculated',
      source: estimate.source,
      zoneName: estimate.zoneName,
      distanceKm: estimate.distanceKm,
      durationMin: estimate.durationMinutes,
      durationMinutes: estimate.durationMinutes,
      costUsd: estimate.deliveryFeeUsd,
      costBs: Number(estimate.deliveryFeeUsd) * Number(BCV_RATE.usdRate),
      deliveryFeeUsd: estimate.deliveryFeeUsd,
      googleMapsLink: estimate.googleMapsLink,
      usedLocalFallback: estimate.usedLocalFallback,
    },
  };
}

function composeDeliveryEstimate(body) {
  const address = body.address || 'San Cristóbal';
  const coordinates = coordinatesForAddress(address);
  return calculateDelivery(coordinates.latitude, coordinates.longitude, address);
}

function calculateDelivery(latitude, longitude, address) {
  const zone = zoneForAddress(address) || nearestZone(latitude, longitude);
  const distanceKm = round(zone?.estimatedDistanceKm || haversineKm(7.7791, -72.2228, latitude, longitude) || 3.2);
  const durationMinutes = Math.max(8, Math.round(distanceKm * 3));
  const deliveryFeeUsd = round(Math.max(2, distanceKm * 1));

  return {
    available: true,
    source: 'local',
    usedLocalFallback: true,
    originAddress: COMPANY.establishmentAddress || COMPANY.address,
    destinationAddress: zone?.name || cleanAddress(address),
    destinationLatitude: latitude,
    destinationLongitude: longitude,
    zoneId: zone?.id || null,
    zoneName: zone?.name || null,
    distanceKm,
    durationMinutes,
    deliveryFeeUsd,
    deliveryFeeBs: formatBs(deliveryFeeUsd * Number(BCV_RATE.usdRate)),
    googleMapsLink: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    message: `Delivery disponible para ${zone?.name || cleanAddress(address)}. Distancia estimada: ${distanceKm} km. Tiempo estimado: ${durationMinutes} min. Costo: USD ${formatMoney(deliveryFeeUsd)}.`,
  };
}

function composeOrder(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  const subtotalUsd = items.reduce((total, item) => {
    const product = PRODUCTS.find((candidate) => candidate.id === item.productId);
    return total + Number(product?.priceUsd || 0) * Number(item.quantity || 1);
  }, 0);
  const deliveryUsd = Number(body.deliveryFeeUsd || 0);
  const totalUsd = subtotalUsd + deliveryUsd;

  return {
    id: cryptoId('order'),
    companyId: body.companyId || COMPANY.id,
    customerName: body.customerName || 'Cliente demo',
    customerPhone: body.customerPhone,
    customerAddress: body.customerAddress || null,
    subtotalUsd: String(round(subtotalUsd)),
    subtotalBs: String(round(subtotalUsd * Number(BCV_RATE.usdRate))),
    deliveryFeeUsd: String(round(deliveryUsd)),
    deliveryFeeBs: String(round(deliveryUsd * Number(BCV_RATE.usdRate))),
    totalUsd: String(round(totalUsd)),
    totalBs: String(round(totalUsd * Number(BCV_RATE.usdRate))),
    status: body.status || 'pendiente_confirmacion_operador',
    createdAt: new Date().toISOString(),
    items: items.map((item) => ({
      id: cryptoId('item'),
      productId: item.productId,
      quantity: item.quantity || 1,
      product: PRODUCTS.find((product) => product.id === item.productId),
    })),
  };
}

function getLocalReferences() {
  return [
    { name: 'Barrio Obrero', aliases: ['barrio obrero'], latitude: 7.7791, longitude: -72.2228, radiusKm: 2, estimatedDistanceKm: 2.4, suggestedFeeUsd: 2.4, color: '#8B5CF6' },
    { name: 'La Concordia', aliases: ['concordia'], latitude: 7.763, longitude: -72.227, radiusKm: 2, estimatedDistanceKm: 4.1, suggestedFeeUsd: 4.1, color: '#22C55E' },
    { name: 'Pueblo Nuevo', aliases: ['pueblo nuevo'], latitude: 7.7907, longitude: -72.2034, radiusKm: 2, estimatedDistanceKm: 3.8, suggestedFeeUsd: 3.8, color: '#3B82F6' },
  ];
}

function zoneForAddress(address) {
  const normalized = normalizeText(address);
  return DELIVERY_ZONES.find((zone) => normalized.includes(normalizeText(zone.name))) ||
    getLocalReferences().find((zone) => zone.aliases.some((alias) => normalized.includes(alias)));
}

function nearestZone(latitude, longitude) {
  return getLocalReferences()
    .map((zone) => ({ ...zone, distance: haversineKm(zone.latitude, zone.longitude, latitude, longitude) }))
    .sort((a, b) => a.distance - b.distance)[0];
}

function coordinatesForAddress(address) {
  const zone = zoneForAddress(address);
  if (zone) {
    return { latitude: Number(zone.localLatitude || zone.latitude), longitude: Number(zone.localLongitude || zone.longitude) };
  }
  return { latitude: 7.7791, longitude: -72.2228 };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;
  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degToRad(value) {
  return value * (Math.PI / 180);
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function cleanAddress(value) {
  return String(value || 'San Cristóbal').trim();
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function formatBs(value) {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function cryptoId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
