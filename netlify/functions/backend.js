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

    if (method === 'POST' && route === '/delivery/location') {
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return response(400, { message: 'No se recibieron coordenadas válidas.' });
      }

      return response(201, composeDeliveryLocation(latitude, longitude));
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

  if (!message || /^(hola|buenas|buenos dias|buen dia|hey)$/i.test(message)) {
    return '¡Hola! 😊 ¿Qué estás buscando hoy para tu piel?';
  }

  if (/catalogo|productos|opciones|que tienen|qué tienen/.test(message)) {
    return 'Claro, te muestro el catálogo real de Beauty Hub. Puedes elegir un producto y lo aparto para tu pedido.';
  }

  const matched = findProduct(message);
  if (matched) {
    return [
      `Sí, tenemos ${matched.name}${matched.brand?.name ? ` de ${matched.brand.name}` : ''}.`,
      `Precio: $${formatMoney(matched.priceUsd)} USD / Bs. ${formatBs(Number(matched.priceUsd) * Number(BCV_RATE.usdRate))}.`,
      `Stock: ${matched.stock} unidades.`,
      '¿Confirmas que quieres agregar este producto al pedido?',
    ].join('\n');
  }

  if (/mancha|melasma|tono|luminosidad|post acne|postacne/.test(message)) {
    return recommendByNeed('manchas', ['mancha', 'luminos', 'protector', 'niacinamida', 'vitamina', 'tono']);
  }

  if (/acne|acné|brote|granito|piel grasa|grasa/.test(message)) {
    return recommendByNeed('piel con tendencia acneica o grasa', ['acne', 'acné', 'grasa', 'poro', 'imperfeccion', 'centella']);
  }

  if (/resequedad|seca|hidrat|barrera|sensible|irrit/.test(message)) {
    return recommendByNeed('hidratación y barrera cutánea', ['hidrat', 'sequedad', 'barrera', 'sensible', 'calmar']);
  }

  return 'Te puedo ayudar con catálogo, precios, disponibilidad, recomendaciones de skincare, pagos y delivery. ¿Qué producto o necesidad quieres revisar?';
}

function recommendByNeed(need, tokens) {
  const candidates = PRODUCTS
    .filter((product) => product.isActive && product.stock > 0)
    .map((product) => ({ product, score: scoreProduct(product, tokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ product }, index) => {
      return `${index + 1}. ${product.name}${product.brand?.name ? ` de ${product.brand.name}` : ''} — $${formatMoney(product.priceUsd)} USD / Bs. ${formatBs(Number(product.priceUsd) * Number(BCV_RATE.usdRate))}. Stock: ${product.stock}.`;
    });

  if (!candidates.length) {
    return `Puedo orientarte con ${need}, pero necesito revisar una opción más específica del catálogo. ¿Tu piel es grasa, seca, mixta o sensible?`;
  }

  return [`Para ${need}, estas opciones disponibles tienen más sentido:`, '', ...candidates, '', '¿Cuál de estas opciones prefieres?'].join('\n');
}

function scoreProduct(product, tokens) {
  const haystack = normalizeText([
    product.name,
    product.brand?.name,
    product.category,
    product.description,
    ...(product.tags || []),
  ].filter(Boolean).join(' '));

  return tokens.reduce((score, token) => score + (haystack.includes(normalizeText(token)) ? 1 : 0), 0);
}

function findProduct(message) {
  const normalized = normalizeText(message);
  const direct = PRODUCTS.find((product) => {
    const fields = normalizeText(`${product.name} ${product.brand?.name || ''} ${product.category || ''} ${product.description || ''}`);
    return product.isActive && product.stock > 0 && fields.split(/\s+/).some((word) => word.length > 3 && normalized.includes(word));
  });

  if (direct) return direct;

  return PRODUCTS.find((product) => product.isActive && product.stock > 0 && normalizeText(product.name).includes(normalized));
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

