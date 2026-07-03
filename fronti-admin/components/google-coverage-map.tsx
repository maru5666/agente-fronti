'use client';

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Layers3,
  LocateFixed,
  MapPin,
  Navigation,
  Power,
  Route,
  Search,
  Store,
  Truck,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button, StatusBadge } from '@/components/ui';
import {
  darkMapStyles,
  getConfiguredGoogleMapsKey,
  loadGoogleMapsWithRetry,
} from '@/lib/google-maps-client';
import { renderSafeValue } from '@/lib/render-safe-value';
import type { Company, CompanyBranch, DeliveryEstimate, DeliveryZone, Order } from '@/types';

type BranchLocation = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  isMain: boolean;
};

type DeliveryCalculation = {
  status: 'idle' | 'calculating' | 'available' | 'out_of_coverage' | 'needs_review';
  address: string;
  customerLocation?: { lat: number; lng: number };
  branch?: BranchLocation | null;
  zone?: DeliveryZone | null;
  source: 'google_maps' | 'openstreetmap' | 'local' | 'unavailable';
  distanceKm: number | null;
  durationMinutes: number | null;
  deliveryFeeUsd: number | null;
  message?: string;
  navigationLink?: string | null;
  usedLocalFallback?: boolean;
};

type Props = {
  company?: Company | null;
  zones: DeliveryZone[];
  branches: CompanyBranch[];
  orders: Order[];
  estimate?: DeliveryEstimate | null;
  onEstimateAddress: (address: string) => Promise<DeliveryEstimate | null>;
  onToggleZone: (zone: DeliveryZone) => Promise<void>;
};

const SAN_CRISTOBAL_CENTER = { lat: 7.76694, lng: -72.225 };
const MAX_REASONABLE_DELIVERY_DISTANCE_KM = 60;
const MAX_REASONABLE_DELIVERY_MINUTES = 240;
const PREPARED_LAYERS = [
  'Repartidores en tiempo real',
  'Pedidos en ruta',
  'Clientes',
  'Rutas optimizadas',
  'Tráfico',
  'Zonas calientes',
];

export function GoogleCoverageMap({
  company,
  zones,
  branches,
  orders,
  estimate,
  onEstimateAddress,
  onToggleZone,
}: Props) {
  const [apiKey, setApiKey] = useState('');
  const [mapMode, setMapMode] = useState<'google' | 'osm'>('google');
  const [osmCenter, setOsmCenter] = useState(SAN_CRISTOBAL_CENTER);
  const [mapNotice, setMapNotice] = useState('');
  const [loadingMap, setLoadingMap] = useState(false);
  const [address, setAddress] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [busyZoneId, setBusyZoneId] = useState('');
  const [trafficEnabled, setTrafficEnabled] = useState(false);
  const [deliveryCalculation, setDeliveryCalculation] = useState<DeliveryCalculation>({
    status: 'idle',
    address: '',
    source: 'unavailable',
    distanceKm: null,
    durationMinutes: null,
    deliveryFeeUsd: null,
  });

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);
  const trafficLayerRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const coverageShapesRef = useRef<any[]>([]);
  const branchMarkersRef = useRef<any[]>([]);
  const destinationMarkerRef = useRef<any>(null);

  const branchLocations = useMemo(
    () => buildBranchLocations(company, branches),
    [company, branches],
  );
  const selectedBranch =
    branchLocations.find((branch) => branch.id === selectedBranchId) ?? branchLocations[0] ?? null;

  useEffect(() => {
    const configuredKey = getConfiguredGoogleMapsKey();
    setApiKey(configuredKey);
    setMapMode(configuredKey ? 'google' : 'osm');
    if (!configuredKey) {
      setMapNotice('Mapa avanzado no disponible. Puedes seguir gestionando delivery con referencias locales.');
    }
  }, []);

  useEffect(() => {
    if (!selectedBranchId && branchLocations[0]) {
      setSelectedBranchId(branchLocations[0].id);
    }
  }, [branchLocations, selectedBranchId]);

  useEffect(() => {
    if (!apiKey || mapMode !== 'google' || !mapContainerRef.current) return;

    let mounted = true;
    setLoadingMap(true);
    setMapNotice('');

    loadGoogleMapsWithRetry(apiKey)
      .then((google) => {
        if (!mounted || !mapContainerRef.current) return;

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapContainerRef.current, {
            center: selectedBranch ?? SAN_CRISTOBAL_CENTER,
            zoom: selectedBranch ? 14 : 12,
            mapTypeControl: false,
            streetViewControl: true,
            fullscreenControl: true,
            clickableIcons: true,
            gestureHandling: 'greedy',
            styles: darkMapStyles,
          });
          infoWindowRef.current = new google.maps.InfoWindow();
          trafficLayerRef.current = new google.maps.TrafficLayer();
          directionsRendererRef.current = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor: '#C9A227',
              strokeOpacity: 0.95,
              strokeWeight: 5,
            },
          });
          directionsRendererRef.current.setMap(mapRef.current);
        }

        setLoadingMap(false);
      })
      .catch((error) => {
        console.error('[Delivery map] Error al cargar Google Maps:', error);
        if (mounted) {
          setMapNotice('No pudimos cargar el mapa avanzado. Usaremos una vista básica mientras tanto.');
          setMapMode('osm');
          setLoadingMap(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [apiKey, mapMode, selectedBranch]);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    renderBranches(window.google, branchLocations, selectedBranch, mapRef.current, branchMarkersRef);
    renderZones({
      google: window.google,
      map: mapRef.current,
      infoWindow: infoWindowRef.current,
      zones,
      orders,
      selectedBranch,
      shapesRef: coverageShapesRef,
      onSelectZone: (zone) => {
        setDeliveryCalculation((current) => ({
          ...current,
          status: current.status === 'idle' ? 'available' : current.status,
          zone,
          source: current.source === 'unavailable' ? 'local' : current.source,
          deliveryFeeUsd: current.deliveryFeeUsd ?? getZoneFee(zone),
          durationMinutes: current.durationMinutes ?? parseEstimatedMinutes(zone.estimatedTime),
          message: `Zona seleccionada: ${renderSafeValue(zone.name, 'Zona sin nombre')}.`,
        }));
      },
    });
    fitMapToCoverage(window.google, mapRef.current, branchLocations, zones, selectedBranch);
  }, [branchLocations, orders, selectedBranch, zones]);

  useEffect(() => {
    if (!mapRef.current || !window.google || !searchInputRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
      fields: ['formatted_address', 'geometry', 'name'],
      componentRestrictions: { country: 've' },
    });

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      const nextAddress = place.formatted_address ?? place.name ?? searchInputRef.current?.value ?? '';

      if (!location || !nextAddress) return;

      setAddress(nextAddress);
      void locateAddress(nextAddress, { lat: location.lat(), lng: location.lng() });
    });

    return () => {
      listener?.remove?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, selectedBranch, zones]);

  useEffect(() => {
    if (!estimate) return;
    const calculation = buildCalculationFromEstimate(estimate, zones, selectedBranch);
    setDeliveryCalculation(calculation);

    if (window.google && mapRef.current && calculation.customerLocation) {
      drawDestination(window.google, mapRef.current, destinationMarkerRef, calculation.customerLocation);
      maybeDrawRoute(window.google, directionsRendererRef.current, selectedBranch, calculation);
    }
  }, [estimate, selectedBranch, zones]);

  useEffect(() => {
    if (!trafficLayerRef.current || !mapRef.current) return;
    trafficLayerRef.current.setMap(trafficEnabled ? mapRef.current : null);
  }, [trafficEnabled]);

  async function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedAddress = address.trim();

    if (!trimmedAddress) {
      setMapNotice('Escribe una dirección o referencia para buscarla en el mapa.');
      return;
    }

    if (mapMode === 'osm') {
      await locateAddressWithOsm(trimmedAddress);
      return;
    }

    await locateAddress(trimmedAddress);
  }

  async function locateAddress(nextAddress: string, knownLocation?: { lat: number; lng: number }) {
    if (!window.google || !mapRef.current) return;

    setMapNotice('');
    setDeliveryCalculation((current) => ({
      ...current,
      status: 'calculating',
      address: nextAddress,
      branch: selectedBranch,
      distanceKm: null,
      durationMinutes: null,
      deliveryFeeUsd: null,
    }));

    try {
      const destination = knownLocation ?? (await geocodeAddress(window.google, nextAddress));
      mapRef.current.panTo(destination);
      mapRef.current.setZoom(15);
      drawDestination(window.google, mapRef.current, destinationMarkerRef, destination);
      clearRoute(directionsRendererRef.current);

      const localCoverage = detectCoverage(window.google, zones, selectedBranch, destination);
      setDeliveryCalculation(buildCalculationFromLocalCoverage({
        address: nextAddress,
        destination,
        selectedBranch,
        localCoverage,
      }));

      const backendEstimate = await onEstimateAddress(nextAddress);
      if (backendEstimate) {
        const calculation = buildCalculationFromEstimate(backendEstimate, zones, selectedBranch);
        setDeliveryCalculation(calculation);
        maybeDrawRoute(window.google, directionsRendererRef.current, selectedBranch, calculation);
      }
    } catch (error) {
      console.error('[Delivery map] Error al buscar dirección:', error);
      clearRoute(directionsRendererRef.current);
      setDeliveryCalculation({
        status: 'needs_review',
        address: nextAddress,
        branch: selectedBranch,
        source: 'unavailable',
        distanceKm: null,
        durationMinutes: null,
        deliveryFeeUsd: null,
        message: 'No encontramos esa dirección. Escribe una referencia cercana.',
      });
    }
  }

  async function locateAddressWithOsm(nextAddress: string) {
    setMapNotice('');
    setDeliveryCalculation({
      status: 'calculating',
      address: nextAddress,
      branch: selectedBranch,
      source: 'unavailable',
      distanceKm: null,
      durationMinutes: null,
      deliveryFeeUsd: null,
    });

    try {
      const destination = await geocodeWithOsm(nextAddress);
      setOsmCenter(destination);
      const backendEstimate = await onEstimateAddress(nextAddress);
      const calculation = backendEstimate
        ? buildCalculationFromEstimate(backendEstimate, zones, selectedBranch)
        : {
            status: 'needs_review' as const,
            address: nextAddress,
            customerLocation: destination,
            branch: selectedBranch,
            source: 'unavailable' as const,
            distanceKm: null,
            durationMinutes: null,
            deliveryFeeUsd: null,
            message: 'No pudimos calcular la ruta automáticamente.',
          };
      setDeliveryCalculation(calculation);
    } catch (error) {
      console.error('[Delivery map] Error al buscar con OpenStreetMap:', error);
      setDeliveryCalculation({
        status: 'needs_review',
        address: nextAddress,
        branch: selectedBranch,
        source: 'unavailable',
        distanceKm: null,
        durationMinutes: null,
        deliveryFeeUsd: null,
        message: 'No encontramos esa dirección. Escribe una referencia cercana.',
      });
    }
  }

  async function toggleZone(zone: DeliveryZone) {
    setBusyZoneId(zone.id);
    try {
      await onToggleZone(zone);
    } finally {
      setBusyZoneId('');
    }
  }

  return (
    <section className="grid gap-4">
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0B1120] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
      <div data-delivery-topbar="true" className="border-b border-white/10 bg-[#111827] p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
          <form
            onSubmit={submitAddress}
            className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-2"
          >
            <Search className="ml-2 h-4 w-4 shrink-0 text-[#C9A227]" />
            <input
              ref={searchInputRef}
              value={renderSafeValue(address, '')}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Buscar dirección, zona o referencia en San Cristóbal"
              className="h-11 w-full min-w-0 border-0 bg-transparent px-2 text-sm text-[#F8F5F0] outline-none placeholder:text-slate-500"
            />
            <Button
              type="submit"
              disabled={deliveryCalculation.status === 'calculating'}
              className="shrink-0 bg-[#C9A227] text-[#1E1E1E] hover:bg-[#B8901F]"
            >
              {deliveryCalculation.status === 'calculating' ? 'Calculando' : 'Buscar'}
            </Button>
          </form>

          <BranchSelect
            branches={branchLocations}
            selectedBranch={selectedBranch}
            onSelect={setSelectedBranchId}
          />

          <Button
            type="button"
            variant="secondary"
            onClick={() => setTrafficEnabled((current) => !current)}
            className={`h-12 ${trafficEnabled ? 'border-[#22C55E]/30 bg-[#22C55E]/15 text-[#22C55E]' : ''}`}
          >
            <Layers3 className="h-4 w-4" />
            Tráfico
          </Button>
        </div>

        {mapNotice ? (
          <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {mapNotice}
          </div>
        ) : null}
      </div>

      <div className="grid min-h-[520px] xl:min-h-[620px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div data-delivery-map="true" className="relative min-h-[360px] bg-[#0F172A] sm:min-h-[440px] xl:min-h-[640px]">
          {mapMode === 'google' ? (
            <div ref={mapContainerRef} className="h-full min-h-[360px] w-full sm:min-h-[440px] xl:min-h-[640px]" />
          ) : (
            <iframe
              title="Mapa básico de cobertura"
              src={buildOsmEmbedUrl(osmCenter)}
              className="h-full min-h-[360px] w-full border-0 sm:min-h-[440px] xl:min-h-[640px]"
            />
          )}

          {loadingMap ? (
            <div className="absolute inset-0 grid place-items-center bg-[#0B1120]/80 text-sm text-slate-200 backdrop-blur-sm">
              Cargando mapa...
            </div>
          ) : null}
        </div>

        <DeliveryDrawer
          calculation={deliveryCalculation}
          zones={zones}
          orders={orders}
          busyZoneId={busyZoneId}
          onToggleZone={toggleZone}
          onRequestReview={() => {
            setMapNotice('Solicitud de revisión registrada para el equipo de delivery.');
          }}
          onChangeAddress={() => {
            searchInputRef.current?.focus();
          }}
        />
      </div>
      </div>
    </section>
  );
}

function BranchSelect({
  branches,
  selectedBranch,
  onSelect,
}: {
  branches: BranchLocation[];
  selectedBranch: BranchLocation | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2">
      <Store className="h-4 w-4 shrink-0 text-[#C9A227]" />
      <select
        value={selectedBranch?.id ?? ''}
        onChange={(event) => onSelect(event.target.value)}
        className="h-8 min-w-[180px] border-0 bg-transparent text-sm font-medium text-[#F8F5F0] outline-none"
      >
        {!branches.length ? (
          <option value="" className="bg-[#111827] text-white">
            Sucursal pendiente
          </option>
        ) : null}
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id} className="bg-[#111827] text-white">
            {renderSafeValue(branch.name, 'Sucursal')}
          </option>
        ))}
      </select>
    </div>
  );
}

function DeliveryDrawer({
  calculation,
  zones,
  orders,
  busyZoneId,
  onToggleZone,
  onRequestReview,
  onChangeAddress,
}: {
  calculation: DeliveryCalculation;
  zones: DeliveryZone[];
  orders: Order[];
  busyZoneId: string;
  onToggleZone: (zone: DeliveryZone) => void;
  onRequestReview: () => void;
  onChangeAddress: () => void;
}) {
  const activeZones = zones.filter((zone) => zone.isActive);

  return (
    <aside data-delivery-drawer="true" className="rounded-t-[28px] border-t border-white/10 bg-[#111827] p-4 shadow-[0_-18px_60px_rgba(0,0,0,0.35)] xl:rounded-none xl:border-l xl:border-t-0 xl:shadow-none">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20 xl:hidden" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#F8F5F0]">Resultado de delivery</p>
          <p className="mt-1 text-xs text-slate-400">Una sola estimación, sin datos duplicados.</p>
        </div>
        <StatusBadge>{getStatusLabel(calculation.status)}</StatusBadge>
      </div>

      <div className="mt-4 rounded-[22px] border border-white/10 bg-[#0F172A] p-4">
        {calculation.status === 'idle' ? (
          <EmptyDeliveryPrompt />
        ) : calculation.status === 'out_of_coverage' ? (
          <OutOfCoverage
            address={calculation.address}
            onRequestReview={onRequestReview}
            onChangeAddress={onChangeAddress}
          />
        ) : (
          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#C9A227]/15 text-[#C9A227]">
                {calculation.status === 'calculating' ? (
                  <LocateFixed className="h-5 w-5 animate-pulse" />
                ) : calculation.status === 'available' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#F8F5F0]">
                  {calculation.status === 'calculating'
                    ? 'Calculando delivery...'
                    : calculation.status === 'available'
                      ? 'Delivery disponible'
                      : 'Pendiente de confirmar'}
                </p>
                <p className="mt-1 break-words text-sm text-slate-300">
                  {renderSafeValue(calculation.address || calculation.message, 'Busca una dirección para comenzar.')}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <InfoRow icon={Building2} label="Sucursal" value={calculation.branch?.name ?? 'No disponible'} />
              <InfoRow icon={MapPin} label="Zona" value={calculation.zone?.name ?? 'No disponible'} />
              <InfoRow icon={Route} label="Distancia" value={formatKm(calculation.distanceKm)} />
              <InfoRow icon={Clock} label="Tiempo" value={formatMinutes(calculation.durationMinutes)} />
              <InfoRow
                icon={Truck}
                label="Costo"
                value={
                  calculation.status === 'calculating'
                    ? 'Calculando...'
                    : formatUsd(calculation.deliveryFeeUsd)
                }
              />
            </div>

            {calculation.usedLocalFallback || calculation.source === 'unavailable' ? (
              <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                No pudimos calcular la ruta automáticamente. Usaremos únicamente la configuración local de zonas.
              </p>
            ) : null}

            {calculation.navigationLink && calculation.status === 'available' ? (
              <a
                href={calculation.navigationLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm font-medium text-[#F8F5F0] transition hover:bg-white/[0.075]"
              >
                <Navigation className="h-4 w-4" />
                Ver ruta para el repartidor
              </a>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-[22px] border border-white/10 bg-[#0F172A] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#F8F5F0]">Zonas de cobertura</p>
            <p className="mt-1 text-xs text-slate-400">{activeZones.length} activas de {zones.length}</p>
          </div>
          <StatusBadge>{zones.length}</StatusBadge>
        </div>

        <div className="mt-3 grid max-h-64 gap-2 overflow-auto pr-1">
          {zones.map((zone) => {
            const orderCount = orders.filter((order) => order.deliveryZone?.id === zone.id).length;

            return (
              <div
                key={zone.id}
                className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: zone.color ?? '#C9A227' }} />
                      <p className="truncate text-sm font-semibold text-[#F8F5F0]">{renderSafeValue(zone.name, 'Zona sin nombre')}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatUsd(getZoneFee(zone))} · {formatEstimatedTimeText(zone.estimatedTime)} · {orderCount} pedidos
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyZoneId === zone.id}
                    onClick={() => onToggleZone(zone)}
                    className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border px-2 text-xs transition ${
                      zone.isActive
                        ? 'border-[#22C55E]/25 bg-[#22C55E]/10 text-[#22C55E]'
                        : 'border-[#EF4444]/25 bg-[#EF4444]/10 text-red-100'
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {zone.isActive ? 'Activa' : 'Inactiva'}
                  </button>
                </div>
              </div>
            );
          })}

          {!zones.length ? (
            <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
              Crea zonas para dibujar la cobertura real en el mapa.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 rounded-[22px] border border-white/10 bg-[#0F172A] p-4">
        <p className="text-sm font-semibold text-[#F8F5F0]">Preparado para crecer</p>
        <div className="mt-3 grid gap-2">
          {PREPARED_LAYERS.map((layer) => (
            <div key={layer} className="flex items-center gap-2 rounded-xl bg-white/[0.035] px-3 py-2 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-[#3B82F6]" />
              {layer}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function EmptyDeliveryPrompt() {
  return (
    <div className="grid gap-3 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#C9A227]/15 text-[#C9A227]">
        <MapPin className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#F8F5F0]">Busca una dirección</p>
        <p className="mt-1 text-sm text-slate-400">
          Fronti validará cobertura, zona, tiempo y costo desde una sola fuente.
        </p>
      </div>
    </div>
  );
}

function OutOfCoverage({
  address,
  onRequestReview,
  onChangeAddress,
}: {
  address: string;
  onRequestReview: () => void;
  onChangeAddress: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#EF4444]/15 text-[#EF4444]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#F8F5F0]">Esta dirección está fuera del área de cobertura.</p>
          <p className="mt-1 text-sm text-slate-400">
            No calcularemos rutas imposibles. El equipo puede revisar el caso o puedes probar otra dirección.
          </p>
          {address ? (
            <p className="mt-2 break-words rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-slate-300">
              {renderSafeValue(address)}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <Button type="button" onClick={onRequestReview} className="bg-[#C9A227] text-[#1E1E1E] hover:bg-[#B8901F]">
          Solicitar revisión
        </Button>
        <Button type="button" variant="secondary" onClick={onChangeAddress}>
          Cambiar dirección
        </Button>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Route;
  label: string;
  value: unknown;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3">
      <div className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
        <Icon className="h-4 w-4 shrink-0 text-[#C9A227]" />
        <span className="truncate">{label}</span>
      </div>
      <span className="max-w-[58%] truncate text-right text-sm font-semibold text-[#F8F5F0]">
        {renderSafeValue(value)}
      </span>
    </div>
  );
}

function buildCalculationFromEstimate(
  estimate: DeliveryEstimate,
  zones: DeliveryZone[],
  selectedBranch: BranchLocation | null,
): DeliveryCalculation {
  const destination = {
    lat: Number(estimate.destinationLatitude),
    lng: Number(estimate.destinationLongitude),
  };
  const zone = zones.find((item) => item.id === estimate.zoneId) ?? null;
  const distanceKm = sanitizeDistance(estimate.distanceKm);
  const durationMinutes = sanitizeDuration(estimate.durationMinutes);
  const deliveryFeeUsd = estimate.available ? sanitizeMoney(estimate.deliveryFeeUsd) : null;

  return {
    status: estimate.available ? 'available' : 'out_of_coverage',
    address: renderSafeValue(estimate.destinationAddress, 'Dirección pendiente'),
    customerLocation: Number.isFinite(destination.lat) && Number.isFinite(destination.lng) ? destination : undefined,
    branch: selectedBranch,
    zone,
    source: estimate.source,
    distanceKm,
    durationMinutes,
    deliveryFeeUsd,
    message: renderSafeValue(estimate.message, ''),
    navigationLink: estimate.googleMapsLink,
    usedLocalFallback: estimate.usedLocalFallback || estimate.source !== 'google_maps',
  };
}

function buildCalculationFromLocalCoverage({
  address,
  destination,
  selectedBranch,
  localCoverage,
}: {
  address: string;
  destination: { lat: number; lng: number };
  selectedBranch: BranchLocation | null;
  localCoverage: {
    covered: boolean;
    zone: DeliveryZone | null;
    distanceKm: number | null;
  };
}): DeliveryCalculation {
  if (!localCoverage.covered || !localCoverage.zone) {
    return {
      status: 'out_of_coverage',
      address,
      customerLocation: destination,
      branch: selectedBranch,
      zone: null,
      source: 'local',
      distanceKm: null,
      durationMinutes: null,
      deliveryFeeUsd: null,
      usedLocalFallback: true,
    };
  }

  return {
    status: 'available',
    address,
    customerLocation: destination,
    branch: selectedBranch,
    zone: localCoverage.zone,
    source: 'local',
    distanceKm: sanitizeDistance(localCoverage.distanceKm),
    durationMinutes: sanitizeDuration(parseEstimatedMinutes(localCoverage.zone.estimatedTime)),
    deliveryFeeUsd: sanitizeMoney(getZoneFee(localCoverage.zone)),
    usedLocalFallback: true,
  };
}

function buildBranchLocations(company?: Company | null, branches: CompanyBranch[] = []) {
  const locations = branches
    .filter((branch) => branch.isActive)
    .map((branch) => {
      const lat = toNumber(branch.latitude);
      const lng = toNumber(branch.longitude);

      if (!isUsableDeliveryCoordinate(lat, lng)) return null;

      return {
        id: branch.id,
        name: branch.name,
        address: branch.address ?? 'Sucursal sin dirección registrada',
        lat,
        lng,
        isMain: branch.isMain,
      };
    })
    .filter(Boolean) as BranchLocation[];

  const companyLat = toNumber(company?.establishmentLatitude);
  const companyLng = toNumber(company?.establishmentLongitude);

  if (isUsableDeliveryCoordinate(companyLat, companyLng)) {
    const lat = companyLat as number;
    const lng = companyLng as number;
    const companyLocation = {
      id: 'company-origin',
      name: company?.establishmentName ?? company?.commercialName ?? company?.name ?? 'Establecimiento',
      address: company?.establishmentAddress ?? company?.address ?? 'Dirección principal',
      lat,
      lng,
      isMain: !locations.some((location) => location.isMain),
    };

    const duplicated = locations.some(
      (location) => Math.abs(location.lat - lat) < 0.00001 && Math.abs(location.lng - lng) < 0.00001,
    );

    if (!duplicated) {
      locations.unshift(companyLocation);
    }
  }

  if (!locations.length && company) {
    locations.unshift({
      id: 'company-origin-fallback',
      name: company.establishmentName ?? company.commercialName ?? company.name ?? 'Establecimiento',
      address: company.establishmentAddress ?? company.address ?? 'Dirección principal pendiente',
      lat: SAN_CRISTOBAL_CENTER.lat,
      lng: SAN_CRISTOBAL_CENTER.lng,
      isMain: true,
    });
  }

  return locations;
}

function renderBranches(
  google: any,
  branches: BranchLocation[],
  selectedBranch: BranchLocation | null,
  map: any,
  markersRef: { current: any[] },
) {
  markersRef.current.forEach((marker) => marker.setMap(null));
  markersRef.current = branches.map((branch) => {
    const isSelected = selectedBranch?.id === branch.id;
    return new google.maps.Marker({
      map,
      position: { lat: branch.lat, lng: branch.lng },
      title: branch.name,
      label: {
        text: isSelected ? 'Tienda' : 'Sucursal',
        color: '#1E1E1E',
        fontSize: '11px',
        fontWeight: '700',
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: isSelected ? '#C9A227' : '#3B82F6',
        fillOpacity: 1,
        strokeColor: '#F8F5F0',
        strokeWeight: 2,
        scale: isSelected ? 13 : 10,
      },
    });
  });

  if (selectedBranch) {
    map.panTo({ lat: selectedBranch.lat, lng: selectedBranch.lng });
  }
}

function renderZones({
  google,
  map,
  infoWindow,
  zones,
  orders,
  selectedBranch,
  shapesRef,
  onSelectZone,
}: {
  google: any;
  map: any;
  infoWindow: any;
  zones: DeliveryZone[];
  orders: Order[];
  selectedBranch: BranchLocation | null;
  shapesRef: { current: any[] };
  onSelectZone: (zone: DeliveryZone) => void;
}) {
  shapesRef.current.forEach((shape) => shape.setMap(null));
  shapesRef.current = zones
    .map((zone) => {
      const center = getZoneCenter(zone, selectedBranch);
      const radiusKm = toNumber(zone.localRadiusKm) ?? toNumber(zone.maxDistanceKm);

      if (!center || !radiusKm) return null;

      const color = zone.color ?? '#C9A227';
      const circle = new google.maps.Circle({
        map,
        center,
        radius: radiusKm * 1000,
        strokeColor: color,
        strokeOpacity: zone.isActive ? 0.85 : 0.3,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: zone.isActive ? 0.18 : 0.05,
        clickable: true,
      });

      circle.addListener('click', (event: any) => {
        const orderCount = orders.filter((order) => order.deliveryZone?.id === zone.id).length;
        onSelectZone(zone);
        infoWindow.setContent(`
          <div style="min-width:220px;color:#1E1E1E;font-family:Inter,Arial,sans-serif">
            <strong style="font-size:14px">${escapeHtml(renderSafeValue(zone.name, 'Zona sin nombre'))}</strong>
            <div style="margin-top:8px;font-size:12px;line-height:1.55">
              <div>Costo delivery: ${escapeHtml(formatUsd(getZoneFee(zone)))}</div>
              <div>Tiempo estimado: ${escapeHtml(renderSafeValue(zone.estimatedTime, 'No disponible'))}</div>
              <div>Pedidos realizados: ${orderCount}</div>
              <div>Estado: ${zone.isActive ? 'Activa' : 'Inactiva'}</div>
            </div>
          </div>
        `);
        infoWindow.setPosition(event.latLng);
        infoWindow.open(map);
      });

      return circle;
    })
    .filter(Boolean) as any[];
}

function fitMapToCoverage(
  google: any,
  map: any,
  branches: BranchLocation[],
  zones: DeliveryZone[],
  selectedBranch: BranchLocation | null,
) {
  const bounds = new google.maps.LatLngBounds();
  branches.forEach((branch) => bounds.extend({ lat: branch.lat, lng: branch.lng }));
  zones.forEach((zone) => {
    const center = getZoneCenter(zone, selectedBranch);
    if (center) bounds.extend(center);
  });

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, 80);
  }
}

function getZoneCenter(zone: DeliveryZone, selectedBranch: BranchLocation | null) {
  const zoneLat = toNumber(zone.localLatitude);
  const zoneLng = toNumber(zone.localLongitude);

  if (zoneLat !== undefined && zoneLng !== undefined) {
    return { lat: zoneLat, lng: zoneLng };
  }

  if (selectedBranch) {
    return { lat: selectedBranch.lat, lng: selectedBranch.lng };
  }

  return null;
}

async function geocodeAddress(google: any, address: string): Promise<{ lat: number; lng: number }> {
  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve, reject) => {
    geocoder.geocode({ address: `${address}, San Cristóbal, Táchira, Venezuela` }, (results: any, status: string) => {
      if (status !== 'OK' || !results?.[0]?.geometry?.location) {
        reject(new Error('address_not_found'));
        return;
      }

      const location = results[0].geometry.location;
      resolve({ lat: location.lat(), lng: location.lng() });
    });
  });
}

async function geocodeWithOsm(address: string): Promise<{ lat: number; lng: number }> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', `${address}, San Cristóbal, Táchira, Venezuela`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  const results = (await response.json()) as Array<{ lat: string; lon: string }>;
  const result = results[0];

  if (!result) {
    throw new Error('address_not_found');
  }

  return {
    lat: Number(result.lat),
    lng: Number(result.lon),
  };
}

function buildOsmEmbedUrl(center: { lat: number; lng: number }) {
  const delta = 0.025;
  const bbox = [
    center.lng - delta,
    center.lat - delta,
    center.lng + delta,
    center.lat + delta,
  ].join(',');

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${center.lat},${center.lng}`;
}

function drawDestination(
  google: any,
  map: any,
  markerRef: { current: any },
  destination: { lat: number; lng: number },
) {
  markerRef.current?.setMap(null);
  markerRef.current = new google.maps.Marker({
    map,
    position: destination,
    title: 'Dirección del cliente',
    icon: {
      path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
      fillColor: '#22C55E',
      fillOpacity: 1,
      strokeColor: '#F8F5F0',
      strokeWeight: 2,
      scale: 6,
    },
  });
}

function maybeDrawRoute(
  google: any,
  directionsRenderer: any,
  selectedBranch: BranchLocation | null,
  calculation: DeliveryCalculation,
) {
  clearRoute(directionsRenderer);

  if (
    !selectedBranch ||
    !directionsRenderer ||
    !calculation.customerLocation ||
    calculation.status !== 'available' ||
    calculation.source !== 'google_maps'
  ) {
    return;
  }

  const directionsService = new google.maps.DirectionsService();
  directionsService.route(
    {
      origin: { lat: selectedBranch.lat, lng: selectedBranch.lng },
      destination: calculation.customerLocation,
      travelMode: google.maps.TravelMode.DRIVING,
    },
    (result: any, status: string) => {
      if (status === 'OK') {
        directionsRenderer.setDirections(result);
      } else {
        clearRoute(directionsRenderer);
      }
    },
  );
}

function clearRoute(directionsRenderer: any) {
  directionsRenderer?.setDirections?.({ routes: [] });
}

function detectCoverage(
  google: any,
  zones: DeliveryZone[],
  selectedBranch: BranchLocation | null,
  destination: { lat: number; lng: number },
) {
  const activeZones = zones.filter((zone) => zone.isActive);

  for (const zone of activeZones) {
    const center = getZoneCenter(zone, selectedBranch);
    const radiusKm = toNumber(zone.localRadiusKm) ?? toNumber(zone.maxDistanceKm);
    if (!center || !radiusKm) continue;

    const distanceKm = distanceBetweenKm(google, center, destination);
    if (distanceKm <= radiusKm) {
      return {
        covered: true,
        zone,
        distanceKm: sanitizeDistance(distanceKm),
      };
    }
  }

  return {
    covered: false,
    zone: null,
    distanceKm: null,
  };
}

function distanceBetweenKm(google: any, origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) {
  if (google.maps.geometry?.spherical) {
    return (
      google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(origin.lat, origin.lng),
        new google.maps.LatLng(destination.lat, destination.lng),
      ) / 1000
    );
  }

  const earthRadiusKm = 6371;
  const dLat = degreesToRadians(destination.lat - origin.lat);
  const dLng = degreesToRadians(destination.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degreesToRadians(origin.lat)) *
      Math.cos(degreesToRadians(destination.lat)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(degrees: number) {
  return degrees * (Math.PI / 180);
}

function toNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function isUsableDeliveryCoordinate(lat?: number, lng?: number) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 6.5 &&
    lat <= 8.8 &&
    lng >= -73.8 &&
    lng <= -71
  );
}

function sanitizeDistance(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_REASONABLE_DELIVERY_DISTANCE_KM) {
    return null;
  }

  return Number(value.toFixed(1));
}

function sanitizeDuration(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_REASONABLE_DELIVERY_MINUTES) {
    return null;
  }

  return Math.round(value);
}

function sanitizeMoney(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    return null;
  }

  return Number(value.toFixed(2));
}

function formatKm(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} km` : 'No disponible';
}

function formatMinutes(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)} min` : 'No disponible';
}

function formatUsd(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? `USD ${value.toFixed(2)}` : 'Pendiente de confirmar';
}

function formatEstimatedTimeText(value?: unknown) {
  const minutes = parseEstimatedMinutes(renderSafeValue(value, ''));
  return minutes ? formatMinutes(minutes) : 'Tiempo no disponible';
}

function getZoneFee(zone?: DeliveryZone | null) {
  if (!zone) return null;
  return toNumber(zone.fixedFeeUsd) ?? toNumber(zone.priceUsd) ?? null;
}

function parseEstimatedMinutes(value?: unknown) {
  const safeValue = renderSafeValue(value, '');
  if (!safeValue) return null;
  const match = safeValue.match(/\d+/);
  if (!match) return null;
  const minutes = Number(match[0]);
  return Number.isFinite(minutes) ? minutes : null;
}

function getStatusLabel(status: DeliveryCalculation['status']) {
  const labels = {
    idle: 'Sin cálculo',
    calculating: 'Calculando',
    available: 'Disponible',
    out_of_coverage: 'Fuera de cobertura',
    needs_review: 'Revisión',
  };

  return labels[status];
}

function escapeHtml(value: unknown) {
  return renderSafeValue(value, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
