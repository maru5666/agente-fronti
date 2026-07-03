'use client';

import { AlertTriangle, CheckCircle2, Loader2, MapPin, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getConfiguredGoogleMapsKey,
  loadGoogleMapsWithRetry,
} from '@/lib/google-maps-client';

type PlaceSelection = {
  placeId: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  country: string;
  baseZone: string;
  googleMapsReference: string;
};

type Props = {
  label?: string;
  value?: string | null;
  address?: string | null;
  baseZone?: string | null;
  companyLatitude?: number | null;
  companyLongitude?: number | null;
  onSelect: (place: PlaceSelection) => void;
};

type Prediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

const SAN_CRISTOBAL = { lat: 7.76694, lng: -72.225 };

export function EstablishmentPlacePicker({
  label = 'Referencia de Google Maps',
  value,
  address,
  baseZone,
  companyLatitude,
  companyLongitude,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [google, setGoogle] = useState<any>(null);
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [notice, setNotice] = useState('');
  const detailsContainerRef = useRef<HTMLDivElement | null>(null);

  const center = useMemo(
    () => ({
      lat: isFiniteNumber(companyLatitude) ? companyLatitude : SAN_CRISTOBAL.lat,
      lng: isFiniteNumber(companyLongitude) ? companyLongitude : SAN_CRISTOBAL.lng,
    }),
    [companyLatitude, companyLongitude],
  );

  useEffect(() => {
    setApiKey(getConfiguredGoogleMapsKey());
  }, []);

  useEffect(() => {
    if (!open || !apiKey) return;

    let active = true;
    setLoadingPlaces(true);
    setNotice('');

    loadGoogleMapsWithRetry(apiKey)
      .then((loadedGoogle) => {
        if (!active) return;
        setGoogle(loadedGoogle);
      })
      .catch((error) => {
        console.error('[Establishment place picker] No se pudo cargar Google Maps:', error);
        if (!active) return;
        setNotice('No pudimos abrir la búsqueda de Google Maps. Revisa la conexión e inténtalo nuevamente.');
      })
      .finally(() => {
        if (active) setLoadingPlaces(false);
      });

    return () => {
      active = false;
    };
  }, [apiKey, open]);

  useEffect(() => {
    if (!open || !google || query.trim().length < 2) {
      setPredictions([]);
      return;
    }

    let active = true;
    const timeout = window.setTimeout(() => {
      const service = new google.maps.places.AutocompleteService();
      setLoading(true);
      service.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 've' },
          locationBias: {
            center,
            radius: 22000,
          },
        },
        (results: Prediction[] | null, status: string) => {
          if (!active) return;
          setLoading(false);

          if (status === 'OK' && results?.length) {
            setPredictions(results.slice(0, 7));
            setNotice('');
            return;
          }

          setPredictions([]);
          if (status !== 'ZERO_RESULTS') {
            setNotice('No pudimos cargar sugerencias en este momento. Intenta con una referencia más específica.');
          }
        },
      );
    }, 280);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [center, google, open, query]);

  async function selectPrediction(prediction: Prediction) {
    if (!google || !detailsContainerRef.current) return;

    setLoading(true);
    setNotice('');

    try {
      const details = await getPlaceDetails(google, detailsContainerRef.current, prediction.place_id);
      const location = details.geometry?.location;

      if (!location) {
        setNotice('No pudimos obtener la ubicación exacta. Elige otra referencia cercana.');
        return;
      }

      const addressComponents = parseAddressComponents(details.address_components ?? []);
      const latitude = location.lat();
      const longitude = location.lng();
      const name = details.name ?? prediction.structured_formatting?.main_text ?? prediction.description;
      const formattedAddress = details.formatted_address ?? prediction.description;
      const baseZone =
        addressComponents.neighborhood ||
        addressComponents.sublocality ||
        addressComponents.route ||
        name ||
        prediction.structured_formatting?.main_text ||
        '';

      onSelect({
        placeId: details.place_id ?? prediction.place_id,
        name,
        formattedAddress,
        latitude,
        longitude,
        city: addressComponents.city,
        state: addressComponents.state,
        country: addressComponents.country,
        baseZone,
        googleMapsReference: buildGoogleMapsReference({
          placeId: details.place_id ?? prediction.place_id,
          latitude,
          longitude,
        }),
      });

      setOpen(false);
      setQuery('');
      setPredictions([]);
    } catch (error) {
      console.error('[Establishment place picker] Error al seleccionar referencia:', error);
      setNotice('No pudimos leer esa referencia. Intenta seleccionarla nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full rounded-xl border border-line bg-white/[0.045] px-3 py-3 text-left transition hover:border-[#C9A227]/50 hover:bg-white/[0.07] focus:border-brand focus:outline-none"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-xs font-medium text-slate-400">{label}</span>
            <span className="mt-1 block truncate text-sm font-semibold text-ink">
              {baseZone || value || 'Buscar en Google Maps'}
            </span>
            <span className="mt-1 block line-clamp-2 text-xs text-muted">
              {address || 'Busca Barrio Obrero, La Concordia, Pueblo Nuevo, una calle o referencia.'}
            </span>
          </span>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#C9A227]/12 text-[#C9A227] transition group-hover:bg-[#C9A227]/18">
            <MapPin className="h-4 w-4" />
          </span>
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/10 bg-[#111827] shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <p className="text-lg font-semibold text-ink">Buscar referencia del establecimiento</p>
                <p className="mt-1 text-sm text-muted">
                  Selecciona una ubicación real para completar dirección, zona y datos técnicos automáticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Cerrar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5">
              {!apiKey ? (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Búsqueda avanzada no disponible.</p>
                      <p className="mt-1 text-amber-100/80">
                        La referencia puede guardarse manualmente por ahora. La conexión de mapas se configura desde el entorno del sistema.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-2">
                    <Search className="ml-2 h-4 w-4 shrink-0 text-[#C9A227]" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      autoFocus
                      placeholder="Ej: Barrio Obrero, La Concordia, Pueblo Nuevo..."
                      className="h-11 w-full min-w-0 border-0 bg-transparent px-2 text-sm text-ink outline-none placeholder:text-slate-500"
                    />
                    {loading || loadingPlaces ? <Loader2 className="mr-3 h-4 w-4 animate-spin text-[#C9A227]" /> : null}
                  </div>

                  {notice ? (
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                      {notice}
                    </div>
                  ) : null}

                  <div className="min-h-64 rounded-2xl border border-white/10 bg-[#0B1120] p-2">
                    {predictions.length ? (
                      <div className="grid gap-2">
                        {predictions.map((prediction) => (
                          <button
                            type="button"
                            key={prediction.place_id}
                            onClick={() => void selectPrediction(prediction)}
                            className="flex items-start gap-3 rounded-2xl border border-transparent p-3 text-left transition hover:border-[#C9A227]/25 hover:bg-white/[0.055]"
                          >
                            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C9A227]/12 text-[#C9A227]">
                              <MapPin className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-ink">
                                {prediction.structured_formatting?.main_text ?? prediction.description}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-muted">
                                {prediction.structured_formatting?.secondary_text ?? prediction.description}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid h-64 place-items-center text-center">
                        <div>
                          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#C9A227]/12 text-[#C9A227]">
                            <Search className="h-6 w-6" />
                          </div>
                          <p className="mt-4 text-sm font-semibold text-ink">Busca una referencia cercana</p>
                          <p className="mt-1 max-w-sm text-sm text-muted">
                            Fronti priorizará resultados alrededor de San Cristóbal o de la sucursal configurada.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {value || address ? (
                    <div className="rounded-2xl border border-[#22C55E]/20 bg-[#22C55E]/10 p-4 text-sm text-emerald-100">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#22C55E]" />
                        <div>
                          <p className="font-semibold">Referencia actual</p>
                          <p className="mt-1 text-emerald-100/80">{address || value}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
          <div ref={detailsContainerRef} className="hidden" />
        </div>
      ) : null}
    </>
  );
}

function getPlaceDetails(google: any, container: HTMLDivElement, placeId: string) {
  const service = new google.maps.places.PlacesService(container);

  return new Promise<any>((resolve, reject) => {
    service.getDetails(
      {
        placeId,
        fields: ['place_id', 'name', 'formatted_address', 'geometry', 'address_components'],
      },
      (place: any, status: string) => {
        if (status === 'OK' && place) {
          resolve(place);
          return;
        }

        reject(new Error(status));
      },
    );
  });
}

function parseAddressComponents(components: any[]) {
  const byType = (type: string) => components.find((component) => component.types?.includes(type))?.long_name ?? '';

  return {
    neighborhood: byType('neighborhood'),
    sublocality: byType('sublocality') || byType('sublocality_level_1'),
    route: byType('route'),
    city: byType('locality') || byType('administrative_area_level_2'),
    state: byType('administrative_area_level_1'),
    country: byType('country'),
  };
}

function buildGoogleMapsReference({
  placeId,
  latitude,
  longitude,
}: {
  placeId: string;
  latitude: number;
  longitude: number;
}) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=${encodeURIComponent(placeId)}`;
}

function isFiniteNumber(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value);
}
