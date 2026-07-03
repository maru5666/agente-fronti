'use client';

declare global {
  interface Window {
    google?: any;
    initFrontiGoogleMaps?: () => void;
  }
}

export type GoogleMapsValidationCheck = {
  id: 'maps' | 'places' | 'geocoding' | 'distance' | 'directions';
  label: string;
  status: 'pending' | 'checking' | 'ok' | 'error';
};

let googleMapsLoader: Promise<any> | null = null;
let googleMapsKey = '';

export function getConfiguredGoogleMapsKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';
}

export function clearGoogleMapsKey() {
  googleMapsLoader = null;
  googleMapsKey = '';
}

export function loadGoogleMaps(apiKey: string, options?: { forceReload?: boolean }) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('browser_unavailable'));
  }

  const cleanKey = apiKey.trim();

  if (!cleanKey) {
    return Promise.reject(new Error('missing_key'));
  }

  if (options?.forceReload || (googleMapsKey && googleMapsKey !== cleanKey)) {
    googleMapsLoader = null;
    const script = document.querySelector<HTMLScriptElement>('script[data-fronti-google-maps="true"]');
    script?.remove();
  }

  if (window.google?.maps?.Map && googleMapsKey === cleanKey) {
    return Promise.resolve(window.google);
  }

  if (googleMapsLoader) return googleMapsLoader;

  googleMapsKey = cleanKey;
  googleMapsLoader = new Promise((resolve, reject) => {
    window.initFrontiGoogleMaps = () => resolve(window.google);

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      cleanKey,
    )}&libraries=places,geometry,drawing&callback=initFrontiGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.dataset.frontiGoogleMaps = 'true';
    script.onerror = () => reject(new Error('maps_load_failed'));
    document.head.appendChild(script);
  });

  return googleMapsLoader;
}

export async function loadGoogleMapsWithRetry(apiKey: string, retries = 2) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await loadGoogleMaps(apiKey, { forceReload: attempt > 0 });
    } catch (error) {
      lastError = error;
      await wait(700 + attempt * 500);
    }
  }

  throw lastError;
}

export async function validateGoogleMapsKey(
  apiKey: string,
  onCheck?: (check: GoogleMapsValidationCheck) => void,
) {
  const google = await loadGoogleMaps(apiKey, { forceReload: true });

  await runCheck('maps', 'Mapa interactivo', onCheck, async () => {
    if (!google.maps?.Map) throw new Error('maps_unavailable');
  });

  await runCheck('places', 'Búsqueda y autocompletado', onCheck, async () => {
    if (!google.maps?.places?.AutocompleteService) throw new Error('places_unavailable');
    const service = new google.maps.places.AutocompleteService();
    await new Promise<void>((resolve, reject) => {
      service.getPlacePredictions(
        { input: 'La Concordia San Cristóbal', componentRestrictions: { country: 've' } },
        (_predictions: unknown, status: string) => {
          if (['OK', 'ZERO_RESULTS'].includes(status)) resolve();
          else reject(new Error(status));
        },
      );
    });
  });

  await runCheck('geocoding', 'Validación de direcciones', onCheck, async () => {
    const geocoder = new google.maps.Geocoder();
    await new Promise<void>((resolve, reject) => {
      geocoder.geocode(
        { address: 'San Cristóbal, Táchira, Venezuela' },
        (results: unknown[], status: string) => {
          if (status === 'OK' && results?.length) resolve();
          else reject(new Error(status));
        },
      );
    });
  });

  await runCheck('distance', 'Distancia y tiempo de entrega', onCheck, async () => {
    const service = new google.maps.DistanceMatrixService();
    await new Promise<void>((resolve, reject) => {
      service.getDistanceMatrix(
        {
          origins: [{ lat: 7.76694, lng: -72.225 }],
          destinations: [{ lat: 7.7791, lng: -72.2228 }],
          travelMode: google.maps.TravelMode.DRIVING,
          unitSystem: google.maps.UnitSystem.METRIC,
        },
        (response: any, status: string) => {
          const element = response?.rows?.[0]?.elements?.[0];
          if (status === 'OK' && element?.status === 'OK') resolve();
          else reject(new Error(status));
        },
      );
    });
  });

  await runCheck('directions', 'Rutas para repartidores', onCheck, async () => {
    const service = new google.maps.DirectionsService();
    await new Promise<void>((resolve, reject) => {
      service.route(
        {
          origin: { lat: 7.76694, lng: -72.225 },
          destination: { lat: 7.7791, lng: -72.2228 },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (_result: unknown, status: string) => {
          if (status === 'OK') resolve();
          else reject(new Error(status));
        },
      );
    });
  });

  return true;
}

async function runCheck(
  id: GoogleMapsValidationCheck['id'],
  label: string,
  onCheck: ((check: GoogleMapsValidationCheck) => void) | undefined,
  action: () => Promise<void>,
) {
  onCheck?.({ id, label, status: 'checking' });
  try {
    await action();
    onCheck?.({ id, label, status: 'ok' });
  } catch (error) {
    onCheck?.({ id, label, status: 'error' });
    throw error;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#f8f5f0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#c9a227' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d6d6d6' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#16321f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#8ec3a7' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#182a4b' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#d8d8d8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#c9a227' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#8f721b' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#25324d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b1628' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
];
