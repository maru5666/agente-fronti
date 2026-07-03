'use client';

import { Circle, MapPin, MousePointer2, PenTool, RefreshCw, Search, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button, ErrorState, Field, Input } from '@/components/ui';
import {
  darkMapStyles,
  getConfiguredGoogleMapsKey,
  loadGoogleMapsWithRetry,
} from '@/lib/google-maps-client';
import { renderSafeValue } from '@/lib/render-safe-value';
import type { Company, DeliveryZone } from '@/types';

type Coordinates = {
  latitude: number;
  longitude: number;
};

type ZoneGeometry = {
  name?: string;
  formattedAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  center?: Coordinates;
  radiusKm: number;
  distanceFromCompanyKm?: number;
  durationMinutes?: number;
  polygonCoordinates?: Coordinates[];
};

type ZonePayload = {
  name: string;
  description?: string;
  priceUsd: number;
  priceBs: number;
  fixedFeeUsd?: number;
  pricePerKmUsd?: number;
  minDistanceKm?: number;
  maxDistanceKm?: number;
  estimatedTime: string;
  color?: string;
  priority?: number;
  localLatitude?: number;
  localLongitude?: number;
  localRadiusKm?: number;
  city?: string;
  state?: string;
  country?: string;
  distanceFromCompanyKm?: number;
  polygonCoordinates?: Coordinates[];
  isActive?: boolean;
};

type Props = {
  open: boolean;
  company?: Company | null;
  zone?: Partial<DeliveryZone> | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (payload: ZonePayload) => Promise<void>;
};

const SAN_CRISTOBAL = { latitude: 7.76694, longitude: -72.225 };
const DEFAULT_RADIUS_KM = 1.5;

export function DeliveryZoneMapModal({
  open,
  company,
  zone,
  saving = false,
  onClose,
  onSave,
}: Props) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const drawingManagerRef = useRef<any>(null);
  const mapListenersRef = useRef<Array<{ remove?: () => void }>>([]);

  const [googleKey, setGoogleKey] = useState('');
  const [mapMode, setMapMode] = useState<'google' | 'osm'>('google');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleName, setVisibleName] = useState('');
  const [fixedFeeUsd, setFixedFeeUsd] = useState('');
  const [pricePerKmUsd, setPricePerKmUsd] = useState('0.5');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [color, setColor] = useState('#C9A227');
  const [isActive, setIsActive] = useState(true);
  const [geometry, setGeometry] = useState<ZoneGeometry>({ radiusKm: DEFAULT_RADIUS_KM });
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const [drawingMode, setDrawingMode] = useState<'circle' | 'polygon'>('circle');

  const origin = useMemo(() => resolveCompanyOrigin(company), [company]);
  const fallbackCenter = geometry.center ?? origin ?? SAN_CRISTOBAL;

  useEffect(() => {
    if (!open) return;

    const configuredKey = getConfiguredGoogleMapsKey();
    setGoogleKey(configuredKey);
    setMapMode('google');
    setError('');
    setSearchQuery(zone?.name ?? '');
    setVisibleName(zone?.name ?? '');
    setFixedFeeUsd(numberText(zone?.fixedFeeUsd ?? zone?.priceUsd));
    setPricePerKmUsd(numberText(zone?.pricePerKmUsd) || '0.5');
    setEstimatedTime(zone?.estimatedTime ?? '');
    setColor(zone?.color ?? '#C9A227');
    setIsActive(zone?.isActive ?? true);
    setDrawingMode(zone?.polygonCoordinates?.length ? 'polygon' : 'circle');
    setGeometry({
      name: zone?.name,
      city: zone?.city ?? undefined,
      state: zone?.state ?? undefined,
      country: zone?.country ?? undefined,
      center:
        toNumber(zone?.localLatitude) !== undefined && toNumber(zone?.localLongitude) !== undefined
          ? {
              latitude: toNumber(zone?.localLatitude)!,
              longitude: toNumber(zone?.localLongitude)!,
            }
          : undefined,
      radiusKm: toNumber(zone?.localRadiusKm) ?? DEFAULT_RADIUS_KM,
      distanceFromCompanyKm: toNumber(zone?.distanceFromCompanyKm),
      durationMinutes: parseMinutes(zone?.estimatedTime),
      polygonCoordinates: zone?.polygonCoordinates ?? undefined,
    });
  }, [open, zone]);

  useEffect(() => {
    if (!open || !googleKey || mapMode !== 'google') return;

    let mounted = true;
    loadGoogleMapsWithRetry(googleKey)
      .then((google) => {
        if (!mounted || !mapNodeRef.current) return;

        cleanupGoogleMap();
        mapRef.current = new google.maps.Map(mapNodeRef.current, {
          center: toGoogleLatLng(fallbackCenter),
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: true,
          fullscreenControl: true,
          gestureHandling: 'greedy',
          styles: darkMapStyles,
        });

        const clickListener = mapRef.current.addListener('click', (event: any) => {
          if (!event.latLng) return;
          void applyGooglePoint(google, {
            latitude: event.latLng.lat(),
            longitude: event.latLng.lng(),
          });
        });
        mapListenersRef.current.push(clickListener);

        setupAutocomplete(google);
        setupDrawingTools(google);

        if (geometry.center) {
          drawGoogleCoverage(google, geometry);
        }
      })
      .catch((loadError) => {
        console.error('[Delivery zone modal] Google Maps no disponible:', loadError);
        if (mounted) {
          setMapMode('osm');
          setError('No pudimos cargar el mapa avanzado. Usaremos un mapa basico mientras tanto.');
        }
      });

    return () => {
      mounted = false;
      cleanupGoogleMap();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, googleKey, mapMode]);

  useEffect(() => {
    if (!open || mapMode !== 'google' || !window.google || !mapRef.current) return;
    drawGoogleCoverage(window.google, geometry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry.center, geometry.radiusKm, geometry.polygonCoordinates, color, drawingMode]);

  if (!open) return null;

  async function submitSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const query = searchQuery.trim();
    if (!query) {
      setError('Escribe una zona o dirección para buscarla en el mapa.');
      return;
    }

    setSearching(true);
    setError('');

    try {
      if (mapMode === 'google' && window.google) {
        await searchWithGoogle(window.google, query);
      } else {
        await searchWithOsm(query);
      }
    } catch (searchError) {
      console.error('[Delivery zone modal] Error al buscar zona:', searchError);
      setError('No encontramos esa zona. Prueba con una referencia más cercana.');
    } finally {
      setSearching(false);
    }
  }

  async function saveZone() {
    if (!visibleName.trim()) {
      setError('Escribe el nombre visible de la zona.');
      return;
    }

    if (!geometry.center) {
      setError('Busca una zona o selecciona un punto en el mapa antes de guardar.');
      return;
    }

    const fixedFee = toNumber(fixedFeeUsd) ?? 0;
    const pricePerKm = toNumber(pricePerKmUsd) ?? 0;
    const radiusKm = geometry.radiusKm || DEFAULT_RADIUS_KM;
    const durationText =
      estimatedTime.trim() ||
      `${geometry.durationMinutes ?? estimateMinutes(geometry.distanceFromCompanyKm ?? radiusKm)} minutos`;

    await onSave({
      name: visibleName.trim(),
      description: geometry.formattedAddress
        ? `Zona creada desde mapa: ${renderSafeValue(geometry.formattedAddress)}`
        : 'Zona creada desde mapa.',
      priceUsd: fixedFee,
      priceBs: 0,
      fixedFeeUsd: fixedFee,
      pricePerKmUsd: pricePerKm,
      minDistanceKm: 0,
      maxDistanceKm: Number(radiusKm.toFixed(2)),
      estimatedTime: durationText,
      color,
      priority: 0,
      localLatitude: geometry.center.latitude,
      localLongitude: geometry.center.longitude,
      localRadiusKm: Number(radiusKm.toFixed(2)),
      city: geometry.city,
      state: geometry.state,
      country: geometry.country,
      distanceFromCompanyKm: geometry.distanceFromCompanyKm,
      polygonCoordinates: geometry.polygonCoordinates,
      isActive,
    });
  }

  function setupAutocomplete(google: any) {
    if (!searchInputRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
      fields: ['formatted_address', 'geometry', 'name', 'address_components'],
      componentRestrictions: { country: 've' },
    });

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      if (!location) return;

      setSearchQuery(place.formatted_address ?? place.name ?? searchInputRef.current?.value ?? '');
      void applyGooglePlace(google, {
        name: place.name,
        formattedAddress: place.formatted_address,
        addressComponents: place.address_components,
        center: { latitude: location.lat(), longitude: location.lng() },
      });
    });
    mapListenersRef.current.push(listener);
  }

  function setupDrawingTools(google: any) {
    if (!mapRef.current || !google.maps.drawing) return;

    drawingManagerRef.current?.setMap(null);
    drawingManagerRef.current = new google.maps.drawing.DrawingManager({
      drawingControl: false,
      circleOptions: {
        fillColor: color,
        fillOpacity: 0.18,
        strokeColor: color,
        strokeWeight: 2,
        editable: true,
        draggable: true,
      },
      polygonOptions: {
        fillColor: color,
        fillOpacity: 0.18,
        strokeColor: color,
        strokeWeight: 2,
        editable: true,
        draggable: true,
      },
    });
    drawingManagerRef.current.setMap(mapRef.current);

    const overlayListener = google.maps.event.addListener(drawingManagerRef.current, 'overlaycomplete', (event: any) => {
      if (event.type === 'polygon') {
        polygonRef.current?.setMap(null);
        circleRef.current?.setMap(null);
        polygonRef.current = event.overlay;
        const path = polygonRef.current
          .getPath()
          .getArray()
          .map((point: any) => ({ latitude: point.lat(), longitude: point.lng() }));
        const center = getPolygonCenter(path);
        setDrawingMode('polygon');
        setGeometry((current) => ({
          ...current,
          center,
          polygonCoordinates: path,
          radiusKm: estimatePolygonRadiusKm(path, center),
        }));
      }

      if (event.type === 'circle') {
        circleRef.current?.setMap(null);
        polygonRef.current?.setMap(null);
        circleRef.current = event.overlay;
        const center = circleRef.current.getCenter();
        setDrawingMode('circle');
        setGeometry((current) => ({
          ...current,
          center: { latitude: center.lat(), longitude: center.lng() },
          radiusKm: circleRef.current.getRadius() / 1000,
          polygonCoordinates: undefined,
        }));
      }

      drawingManagerRef.current.setDrawingMode(null);
    });
    mapListenersRef.current.push(overlayListener);
  }

  async function searchWithGoogle(google: any, query: string) {
    const geocoder = new google.maps.Geocoder();
    const result = await new Promise<any>((resolve, reject) => {
      geocoder.geocode(
        { address: `${query}, San Cristóbal, Táchira, Venezuela` },
        (results: any[], status: string) => {
          if (status !== 'OK' || !results?.[0]) {
            reject(new Error(status));
            return;
          }

          resolve(results[0]);
        },
      );
    });

    const location = result.geometry.location;
    await applyGooglePlace(google, {
      name: query,
      formattedAddress: result.formatted_address,
      addressComponents: result.address_components,
      center: { latitude: location.lat(), longitude: location.lng() },
    });
  }

  async function applyGooglePlace(
    google: any,
    place: {
      name?: string;
      formattedAddress?: string;
      addressComponents?: Array<{ long_name: string; types: string[] }>;
      center: Coordinates;
    },
  ) {
    const distance = await calculateGoogleDistance(google, place.center).catch(() => null);
    const nextGeometry: ZoneGeometry = {
      name: place.name,
      formattedAddress: place.formattedAddress,
      city: findComponent(place.addressComponents, ['locality', 'administrative_area_level_2']),
      state: findComponent(place.addressComponents, ['administrative_area_level_1']),
      country: findComponent(place.addressComponents, ['country']),
      center: place.center,
      radiusKm: geometry.radiusKm || suggestRadius(distance?.distanceKm),
      distanceFromCompanyKm: distance?.distanceKm ?? estimateDistanceFromOrigin(place.center),
      durationMinutes: distance?.durationMinutes,
      polygonCoordinates: drawingMode === 'polygon' ? geometry.polygonCoordinates : undefined,
    };

    setVisibleName((current) => current || place.name || extractNameFromAddress(place.formattedAddress) || searchQuery);
    setEstimatedTime((current) => current || `${nextGeometry.durationMinutes ?? estimateMinutes(nextGeometry.distanceFromCompanyKm ?? nextGeometry.radiusKm)} minutos`);
    setGeometry(nextGeometry);
    mapRef.current?.panTo(toGoogleLatLng(place.center));
    mapRef.current?.setZoom(14);
  }

  async function applyGooglePoint(google: any, center: Coordinates) {
    const geocoder = new google.maps.Geocoder();
    const result = await new Promise<any | null>((resolve) => {
      geocoder.geocode({ location: toGoogleLatLng(center) }, (results: any[], status: string) => {
        resolve(status === 'OK' ? results?.[0] ?? null : null);
      });
    });

    await applyGooglePlace(google, {
      name: result ? extractNameFromAddress(result.formatted_address) : 'Zona seleccionada',
      formattedAddress: result?.formatted_address,
      addressComponents: result?.address_components,
      center,
    });
  }

  async function calculateGoogleDistance(google: any, destination: Coordinates) {
    if (!origin) return null;

    const service = new google.maps.DistanceMatrixService();
    return new Promise<{ distanceKm: number; durationMinutes: number }>((resolve, reject) => {
      service.getDistanceMatrix(
        {
          origins: [toGoogleLatLng(origin)],
          destinations: [toGoogleLatLng(destination)],
          travelMode: google.maps.TravelMode.DRIVING,
          unitSystem: google.maps.UnitSystem.METRIC,
        },
        (response: any, status: string) => {
          const element = response?.rows?.[0]?.elements?.[0];
          if (status !== 'OK' || element?.status !== 'OK') {
            reject(new Error(status));
            return;
          }

          resolve({
            distanceKm: Number((element.distance.value / 1000).toFixed(2)),
            durationMinutes: Math.ceil(element.duration.value / 60),
          });
        },
      );
    });
  }

  async function searchWithOsm(query: string) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', `${query}, San Cristóbal, Táchira, Venezuela`);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '1');

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    const results = (await response.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
      address?: Record<string, string>;
    }>;
    const result = results[0];

    if (!result) {
      throw new Error('osm_not_found');
    }

    const center = {
      latitude: Number(result.lat),
      longitude: Number(result.lon),
    };
    const distanceKm = estimateDistanceFromOrigin(center);
    const nextGeometry = {
      name: query,
      formattedAddress: result.display_name,
      city: result.address?.city ?? result.address?.town ?? result.address?.municipality,
      state: result.address?.state,
      country: result.address?.country,
      center,
      radiusKm: geometry.radiusKm || suggestRadius(distanceKm),
      distanceFromCompanyKm: distanceKm,
      durationMinutes: estimateMinutes(distanceKm ?? DEFAULT_RADIUS_KM),
    };

    setVisibleName((current) => current || query);
    setEstimatedTime((current) => current || `${nextGeometry.durationMinutes} minutos`);
    setGeometry(nextGeometry);
  }

  function drawGoogleCoverage(google: any, currentGeometry: ZoneGeometry) {
    if (!mapRef.current || !currentGeometry.center) return;

    markerRef.current?.setMap(null);
    markerRef.current = new google.maps.Marker({
      map: mapRef.current,
      position: toGoogleLatLng(currentGeometry.center),
      title: visibleName || 'Zona seleccionada',
    });

    if (drawingMode === 'polygon' && currentGeometry.polygonCoordinates?.length) {
      circleRef.current?.setMap(null);
      polygonRef.current?.setMap(null);
      polygonRef.current = new google.maps.Polygon({
        map: mapRef.current,
        paths: currentGeometry.polygonCoordinates.map(toGoogleLatLng),
        fillColor: color,
        fillOpacity: 0.18,
        strokeColor: color,
        strokeWeight: 2,
        editable: true,
        draggable: true,
      });
      return;
    }

    polygonRef.current?.setMap(null);
    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        map: mapRef.current,
        editable: true,
        draggable: true,
      });
      const radiusListener = circleRef.current.addListener('radius_changed', () => {
        setGeometry((current) => ({
          ...current,
          radiusKm: Number((circleRef.current.getRadius() / 1000).toFixed(2)),
        }));
      });
      const centerListener = circleRef.current.addListener('center_changed', () => {
        const center = circleRef.current.getCenter();
        setGeometry((current) => ({
          ...current,
          center: { latitude: center.lat(), longitude: center.lng() },
        }));
      });
      mapListenersRef.current.push(radiusListener, centerListener);
    }

    circleRef.current.setOptions({
      map: mapRef.current,
      center: toGoogleLatLng(currentGeometry.center),
      radius: currentGeometry.radiusKm * 1000,
      fillColor: color,
      fillOpacity: 0.18,
      strokeColor: color,
      strokeWeight: 2,
    });
  }

  function startDrawing(nextMode: 'circle' | 'polygon') {
    setDrawingMode(nextMode);

    if (!drawingManagerRef.current || !window.google) return;
    drawingManagerRef.current.setDrawingMode(
      nextMode === 'circle'
        ? window.google.maps.drawing.OverlayType.CIRCLE
        : window.google.maps.drawing.OverlayType.POLYGON,
    );
  }

  function cleanupGoogleMap() {
    mapListenersRef.current.forEach((listener) => listener.remove?.());
    mapListenersRef.current = [];
    drawingManagerRef.current?.setMap?.(null);
    markerRef.current?.setMap?.(null);
    circleRef.current?.setMap?.(null);
    polygonRef.current?.setMap?.(null);
    drawingManagerRef.current = null;
    markerRef.current = null;
    circleRef.current = null;
    polygonRef.current = null;
    mapRef.current = null;
  }

  function estimateDistanceFromOrigin(destination: Coordinates) {
    return origin ? Number(haversineKm(origin, destination).toFixed(2)) : undefined;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <section className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-line bg-[#0B1120] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <header className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold text-ink">
              {zone ? 'Editar zona de delivery' : 'Agregar zona'}
            </p>
            <p className="mt-1 text-sm text-muted">
              Busca una zona, ajusta la cobertura en el mapa y Fronti guardará la información necesaria internamente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white/[0.045] text-muted transition hover:bg-white/[0.075] hover:text-ink"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 xl:grid-cols-[1fr_360px]">
          <div className="grid gap-3">
            <form
              onSubmit={submitSearch}
              className="grid gap-2 rounded-2xl border border-line bg-white/[0.045] p-2 sm:grid-cols-[1fr_auto]"
            >
              <div className="flex items-center gap-2 px-2">
                <Search className="h-4 w-4 shrink-0 text-[#C9A227]" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar zona o dirección. Ej: La Concordia"
                  className="h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-slate-500"
                />
              </div>
              <Button type="submit" disabled={searching}>
                {searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar en mapa
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={drawingMode === 'circle' ? 'primary' : 'secondary'}
                onClick={() => startDrawing('circle')}
              >
                <Circle className="h-4 w-4" />
                Dibujar círculo
              </Button>
              <Button
                type="button"
                variant={drawingMode === 'polygon' ? 'primary' : 'secondary'}
                onClick={() => startDrawing('polygon')}
              >
                <PenTool className="h-4 w-4" />
                Dibujar polígono
              </Button>
              <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-white/[0.045] px-3 py-2 text-xs text-muted">
                <MousePointer2 className="h-4 w-4 text-[#C9A227]" />
                También puedes hacer clic sobre el mapa
              </span>
            </div>

            {error ? <ErrorState message={error} /> : null}

            <div className="relative overflow-hidden rounded-[24px] border border-line bg-[#111827]">
              {!googleKey && mapMode === 'google' ? (
                <div className="grid h-[560px] place-items-center p-5">
                  <div className="max-w-md rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                    <p className="font-semibold">Mapa avanzado no disponible.</p>
                    <p className="mt-1 text-amber-100/80">
                      Puedes continuar con la referencia local. La conexión de mapas se configura desde el entorno del sistema.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-4"
                      onClick={() => setMapMode('osm')}
                    >
                      Usar mapa básico
                    </Button>
                  </div>
                </div>
              ) : mapMode === 'google' ? (
                <div ref={mapNodeRef} className="h-[560px] w-full" />
              ) : (
                <iframe
                  title="Mapa basico"
                  src={buildOsmEmbedUrl(fallbackCenter)}
                  className="h-[560px] w-full border-0"
                />
              )}
              <div className="absolute bottom-4 left-4 rounded-2xl border border-line bg-[#111827]/90 p-3 text-xs text-slate-300 shadow-xl backdrop-blur-xl">
                <div className="flex items-center gap-2 font-medium text-ink">
                  <MapPin className="h-4 w-4 text-[#C9A227]" />
                  {mapMode === 'google' ? 'Mapa avanzado' : 'Mapa basico'}
                </div>
                <p className="mt-1 max-w-xs">
                  {renderSafeValue(geometry.formattedAddress, 'Busca una zona o selecciona un punto para calcular la cobertura.')}
                </p>
              </div>
            </div>
          </div>

          <aside className="grid content-start gap-4 rounded-[24px] border border-line bg-white/[0.045] p-4">
            <Field label="Nombre de zona">
              <Input
                value={visibleName}
                onChange={(event) => setVisibleName(event.target.value)}
                placeholder="La Concordia"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tarifa fija USD">
                <Input
                  type="number"
                  step="0.01"
                  value={fixedFeeUsd}
                  onChange={(event) => setFixedFeeUsd(event.target.value)}
                  placeholder="2.00"
                />
              </Field>
              <Field label="Tarifa por km USD">
                <Input
                  type="number"
                  step="0.01"
                  value={pricePerKmUsd}
                  onChange={(event) => setPricePerKmUsd(event.target.value)}
                  placeholder="0.50"
                />
              </Field>
            </div>

            <Field label="Tiempo estimado opcional">
              <Input
                value={estimatedTime}
                onChange={(event) => setEstimatedTime(event.target.value)}
                placeholder="20 minutos"
              />
            </Field>

            <div className="grid grid-cols-[90px_1fr] gap-3">
              <Field label="Color">
                <Input
                  type="color"
                  className="p-1"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                />
              </Field>
              <label className="mt-6 flex h-10 items-center gap-2 rounded-xl border border-line bg-white/[0.045] px-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#C9A227]"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                />
                Zona activa
              </label>
            </div>

            <div className="rounded-2xl border border-line bg-[#111827] p-3">
              <p className="text-xs font-semibold text-ink">Datos calculados</p>
              <div className="mt-3 grid gap-2 text-xs text-muted">
                <CalculatedItem label="Ubicación" value={geometry.formattedAddress ?? 'Pendiente'} />
                <CalculatedItem label="Distancia desde la empresa" value={geometry.distanceFromCompanyKm ? `${geometry.distanceFromCompanyKm} km` : 'Pendiente'} />
                <CalculatedItem label="Radio sugerido" value={`${geometry.radiusKm.toFixed(1)} km`} />
                <CalculatedItem label="Tiempo estimado" value={estimatedTime || (geometry.durationMinutes ? `${geometry.durationMinutes} minutos` : 'Pendiente')} />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
              <Button type="button" disabled={saving} onClick={saveZone} className="w-full">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                Guardar zona
              </Button>
              <Button type="button" variant="secondary" onClick={onClose} className="w-full">
                Cancelar
              </Button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function CalculatedItem({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-line bg-white/[0.035] px-3 py-2">
      <span>{label}</span>
      <span className="max-w-[190px] text-right font-medium text-slate-200">{renderSafeValue(value)}</span>
    </div>
  );
}

function resolveCompanyOrigin(company?: Company | null): Coordinates | null {
  const lat = toNumber(company?.establishmentLatitude);
  const lng = toNumber(company?.establishmentLongitude);

  if (lat !== undefined && lng !== undefined && !(lat === 0 && lng === 0)) {
    return { latitude: lat, longitude: lng };
  }

  return null;
}

function toGoogleLatLng(coordinates: Coordinates) {
  return { lat: coordinates.latitude, lng: coordinates.longitude };
}

function numberText(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

function toNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function parseMinutes(value?: string | null) {
  const match = value?.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

function findComponent(
  components: Array<{ long_name: string; types: string[] }> | undefined,
  types: string[],
) {
  return components?.find((component) =>
    types.some((type) => component.types.includes(type)),
  )?.long_name;
}

function extractNameFromAddress(address?: string) {
  return address?.split(',')[0]?.trim();
}

function suggestRadius(distanceKm?: number) {
  if (!distanceKm) return DEFAULT_RADIUS_KM;
  if (distanceKm <= 2) return 1.5;
  if (distanceKm <= 5) return 2;
  return 3;
}

function estimateMinutes(distanceKm: number) {
  return Math.max(12, Math.ceil(10 + distanceKm * 4));
}

function haversineKm(origin: Coordinates, destination: Coordinates) {
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(destination.latitude - origin.latitude);
  const deltaLongitude = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const value =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(deltaLongitude / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getPolygonCenter(path: Coordinates[]) {
  const total = path.reduce(
    (acc, point) => ({
      latitude: acc.latitude + point.latitude,
      longitude: acc.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: total.latitude / path.length,
    longitude: total.longitude / path.length,
  };
}

function estimatePolygonRadiusKm(path: Coordinates[], center: Coordinates) {
  const maxDistance = path.reduce(
    (currentMax, point) => Math.max(currentMax, haversineKm(center, point)),
    0,
  );

  return Number(Math.max(maxDistance, DEFAULT_RADIUS_KM).toFixed(2));
}

function buildOsmEmbedUrl(center: Coordinates) {
  const delta = 0.025;
  const bbox = [
    center.longitude - delta,
    center.latitude - delta,
    center.longitude + delta,
    center.latitude + delta,
  ].join(',');

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${center.latitude},${center.longitude}`;
}

