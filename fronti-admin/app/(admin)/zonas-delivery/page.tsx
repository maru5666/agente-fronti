'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Edit3,
  Power,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { DeliveryZoneMapModal } from '@/components/delivery-zone-map-modal';
import { DeliveryErrorBoundary } from '@/components/delivery-error-boundary';
import { EstablishmentPlacePicker } from '@/components/establishment-place-picker';
import { GoogleCoverageMap } from '@/components/google-coverage-map';
import { PageHeader } from '@/components/page-header';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Panel,
  StatusBadge,
  Textarea,
} from '@/components/ui';
import { useCompany } from '@/hooks/use-company';
import { useResource } from '@/hooks/use-resource';
import {
  deliverySettingsSchema,
  deliveryZoneSchema,
} from '@/lib/validations';
import { renderSafeValue } from '@/lib/render-safe-value';
import { branchesApi, companiesApi, deliveryZonesApi, getApiError, ordersApi } from '@/services/api';
import type { DeliveryEstimate, DeliveryZone, LocalDeliveryReference } from '@/types';

type ZoneForm = z.infer<typeof deliveryZoneSchema>;
type SettingsForm = z.infer<typeof deliverySettingsSchema>;

export default function ZonasDeliveryPage() {
  const { companyId, company, setCompanySession, loading: companyLoading } = useCompany();
  const [zoneError, setZoneError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [estimate, setEstimate] = useState<DeliveryEstimate | null>(null);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [draftZone, setDraftZone] = useState<Partial<DeliveryZone> | null>(null);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingZone, setSavingZone] = useState(false);

  const {
    data: zones,
    loading,
    error: loadError,
    reload,
  } = useResource(
    () => (companyId ? deliveryZonesApi.list(companyId) : Promise.resolve([])),
    [companyId],
  );
  const { data: localReferences } = useResource(
    () => deliveryZonesApi.localReferences(),
    [],
  );
  const { data: branches } = useResource(
    () => (companyId ? branchesApi.list(companyId).catch(() => []) : Promise.resolve([])),
    [companyId],
  );
  const { data: orders } = useResource(
    () => (companyId ? ordersApi.list(companyId).catch(() => []) : Promise.resolve([])),
    [companyId],
  );

  const settingsForm = useForm<SettingsForm>({
    resolver: zodResolver(deliverySettingsSchema),
  });

  useEffect(() => {
    if (!company) return;

    settingsForm.reset({
      establishmentName: company.establishmentName ?? company.commercialName ?? company.name,
      establishmentAddress: company.establishmentAddress ?? company.address ?? '',
      establishmentLatitude: toNumber(company.establishmentLatitude),
      establishmentLongitude: toNumber(company.establishmentLongitude),
      googleMapsReference: company.googleMapsReference ?? '',
      baseDeliveryZone: company.baseDeliveryZone ?? '',
      deliveryBaseFeeUsd: toNumber(company.deliveryBaseFeeUsd) ?? 1,
      deliveryPricePerKmUsd: toNumber(company.deliveryPricePerKmUsd) ?? 0.5,
      deliveryMinimumFeeUsd: toNumber(company.deliveryMinimumFeeUsd) ?? 1.5,
      deliveryFarZoneSurchargeUsd: toNumber(company.deliveryFarZoneSurchargeUsd) ?? 0,
      deliveryFreeFromUsd: toNumber(company.deliveryFreeFromUsd) ?? undefined,
    });
  }, [company, settingsForm]);

  const activeZones = useMemo(
    () => zones?.filter((zone) => zone.isActive).length ?? 0,
    [zones],
  );
  const coverageKm = useMemo(() => {
    const max = zones?.reduce((currentMax, zone) => {
      const distance = toNumber(zone.maxDistanceKm) ?? toNumber(zone.localRadiusKm) ?? 0;
      return Math.max(currentMax, distance);
    }, 0);

    return max ?? 0;
  }, [zones]);

  const watchedEstablishmentAddress = settingsForm.watch('establishmentAddress');
  const watchedGoogleMapsReference = settingsForm.watch('googleMapsReference');
  const watchedBaseDeliveryZone = settingsForm.watch('baseDeliveryZone');
  const watchedEstablishmentLatitude = settingsForm.watch('establishmentLatitude');
  const watchedEstablishmentLongitude = settingsForm.watch('establishmentLongitude');

  function selectEstablishmentPlace(place: {
    name: string;
    formattedAddress: string;
    latitude: number;
    longitude: number;
    baseZone: string;
    googleMapsReference: string;
  }) {
    const currentName = settingsForm.getValues('establishmentName');

    if (!currentName || currentName === company?.name || currentName === company?.commercialName) {
      settingsForm.setValue('establishmentName', place.name, { shouldDirty: true, shouldValidate: true });
    }

    settingsForm.setValue('establishmentAddress', place.formattedAddress, { shouldDirty: true, shouldValidate: true });
    settingsForm.setValue('googleMapsReference', place.googleMapsReference, { shouldDirty: true, shouldValidate: true });
    settingsForm.setValue('baseDeliveryZone', place.baseZone, { shouldDirty: true, shouldValidate: true });
    settingsForm.setValue('establishmentLatitude', place.latitude, { shouldDirty: true, shouldValidate: true });
    settingsForm.setValue('establishmentLongitude', place.longitude, { shouldDirty: true, shouldValidate: true });
  }

  async function submitSettings(values: SettingsForm) {
    if (!companyId) return;

    setSettingsError('');
    setSavingSettings(true);
    try {
      const savedCompany = await companiesApi.update(companyId, compactPayload(values));
      setCompanySession(savedCompany);
    } catch (err) {
      console.error('[Delivery] Error al guardar establecimiento:', err);
      setSettingsError(getApiError(err));
    } finally {
      setSavingSettings(false);
    }
  }

  async function submitZone(values: ZoneForm) {
    if (!companyId) return;

    setZoneError('');
    setSavingZone(true);
    try {
      const payload = {
        ...compactPayload(values),
        companyId,
        priceUsd: values.priceUsd,
        priceBs: values.priceBs,
        estimatedTime: values.estimatedTime,
        isActive: values.isActive ?? true,
      };

      if (editingZone) {
        await deliveryZonesApi.update(editingZone.id, payload);
      } else {
        await deliveryZonesApi.create(payload);
      }

      setEditingZone(null);
      setDraftZone(null);
      setZoneModalOpen(false);
      reload();
    } catch (err) {
      console.error('[Delivery] Error al guardar zona:', err);
      setZoneError(getApiError(err));
    } finally {
      setSavingZone(false);
    }
  }

  async function deactivate(id: string) {
    try {
      await deliveryZonesApi.remove(id);
      reload();
    } catch (err) {
      console.error('[Delivery] Error al desactivar zona:', err);
      setZoneError(getApiError(err));
    }
  }

  async function estimateFromMap(address: string) {
    if (!companyId) return null;

    try {
      const result = await deliveryZonesApi.estimate({
        companyId,
        address,
        orderSubtotalUsd: 0,
      });
      setEstimate(result);
      return result;
    } catch (err) {
      console.error('[Delivery] Error al calcular delivery desde el mapa:', err);
      return null;
    }
  }

  async function toggleZoneStatus(zone: DeliveryZone) {
    if (!companyId) return;

    try {
      if (zone.isActive) {
        await deliveryZonesApi.remove(zone.id);
      } else {
        await deliveryZonesApi.update(zone.id, {
          companyId,
          isActive: true,
        });
      }

      reload();
    } catch (err) {
      console.error('[Delivery] Error al cambiar estado de zona:', err);
      setZoneError(getApiError(err));
    }
  }

  function editZone(zone: DeliveryZone) {
    setEditingZone(zone);
    setDraftZone(null);
    setZoneModalOpen(true);
  }

  function applyLocalReference(reference: LocalDeliveryReference) {
    setEditingZone(null);
    setDraftZone({
      name: reference.name,
      description: `Referencia local para ${reference.name}, San Cristóbal.`,
      priceUsd: String(reference.suggestedFeeUsd),
      priceBs: '0',
      fixedFeeUsd: String(reference.suggestedFeeUsd),
      pricePerKmUsd: '0.5',
      estimatedTime: `${Math.max(12, Math.ceil(10 + reference.estimatedDistanceKm * 4))} minutos`,
      maxDistanceKm: String(reference.estimatedDistanceKm + 1),
      color: reference.color,
      localLatitude: String(reference.latitude),
      localLongitude: String(reference.longitude),
      localRadiusKm: String(reference.radiusKm),
      distanceFromCompanyKm: String(reference.estimatedDistanceKm),
      isActive: true,
    });
    setZoneModalOpen(true);
  }

  if (companyLoading) {
    return <LoadingState label="Cargando configuración de delivery" />;
  }

  return (
    <DeliveryErrorBoundary>
      <div className="pb-24 xl:pb-0">
        <PageHeader
          title="Delivery"
          description="Gestiona cobertura, zonas, rutas y tarifas con un mapa operativo limpio."
        />

      <div className="grid gap-4 md:grid-cols-3">
        <DeliveryMetric label="Zonas activas" value={activeZones} detail="Cobertura disponible" />
        <DeliveryMetric label="Cobertura máxima" value={`${coverageKm.toFixed(1)} km`} detail="Según zonas creadas" />
        <DeliveryMetric
          label="Origen"
          value={renderSafeValue(company?.establishmentName ?? company?.commercialName ?? company?.name, 'Empresa')}
          detail={company?.establishmentAddress ?? company?.address ?? 'Dirección pendiente'}
        />
      </div>

      <div className="mt-5">
        <GoogleCoverageMap
          company={company}
          zones={zones ?? []}
          branches={branches ?? []}
          orders={orders ?? []}
          estimate={estimate}
          onEstimateAddress={estimateFromMap}
          onToggleZone={toggleZoneStatus}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(340px,460px)_1fr]">
        <div className="grid gap-5">
          <Panel
            title="Dirección del establecimiento"
            description="Punto de origen para calcular cobertura, tiempo y costo."
          >
            <form className="grid gap-3" onSubmit={settingsForm.handleSubmit(submitSettings)}>
              {settingsError ? <ErrorState message={settingsError} /> : null}
              <Field label="Nombre del establecimiento" error={settingsForm.formState.errors.establishmentName?.message}>
                <Input placeholder="Beauty Hub Barrio Obrero" {...settingsForm.register('establishmentName')} />
              </Field>
              <Field label="Dirección principal" error={settingsForm.formState.errors.establishmentAddress?.message}>
                <Textarea placeholder="Av. principal, referencia cercana..." {...settingsForm.register('establishmentAddress')} />
              </Field>
              <Field label="Referencia de Google Maps" error={settingsForm.formState.errors.googleMapsReference?.message}>
                <EstablishmentPlacePicker
                  label="Ubicación seleccionada"
                  value={watchedGoogleMapsReference}
                  address={watchedEstablishmentAddress}
                  baseZone={watchedBaseDeliveryZone}
                  companyLatitude={toNumber(watchedEstablishmentLatitude) ?? toNumber(company?.establishmentLatitude)}
                  companyLongitude={toNumber(watchedEstablishmentLongitude) ?? toNumber(company?.establishmentLongitude)}
                  onSelect={selectEstablishmentPlace}
                />
              </Field>
              <input type="hidden" {...settingsForm.register('googleMapsReference')} />
              <input type="hidden" {...settingsForm.register('establishmentLatitude')} />
              <input type="hidden" {...settingsForm.register('establishmentLongitude')} />
              <Field label="Zona base" error={settingsForm.formState.errors.baseDeliveryZone?.message}>
                <Input placeholder="Barrio Obrero" {...settingsForm.register('baseDeliveryZone')} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tarifa base USD">
                  <Input type="number" step="0.01" {...settingsForm.register('deliveryBaseFeeUsd')} />
                </Field>
                <Field label="Tarifa por km USD">
                  <Input type="number" step="0.01" {...settingsForm.register('deliveryPricePerKmUsd')} />
                </Field>
                <Field label="Tarifa mínima USD">
                  <Input type="number" step="0.01" {...settingsForm.register('deliveryMinimumFeeUsd')} />
                </Field>
                <Field label="Recargo zona lejana USD">
                  <Input type="number" step="0.01" {...settingsForm.register('deliveryFarZoneSurchargeUsd')} />
                </Field>
              </div>
              <Field label="Delivery gratis desde USD">
                <Input type="number" step="0.01" placeholder="Opcional" {...settingsForm.register('deliveryFreeFromUsd')} />
              </Field>
              <Button type="submit" disabled={savingSettings}>
                {savingSettings ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar establecimiento
              </Button>
            </form>
          </Panel>

          <Panel
            title="Zonas de delivery"
            description="Crea zonas desde un mapa real. Los datos técnicos se guardan internamente."
            action={
              <Button
                type="button"
                onClick={() => {
                  setEditingZone(null);
                  setDraftZone(null);
                  setZoneModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Agregar zona
              </Button>
            }
          >
            {zoneError ? <ErrorState message={zoneError} /> : null}
            <div className="rounded-2xl border border-line bg-[#111827] p-4">
              <p className="text-sm font-semibold text-ink">Creación visual de zonas</p>
              <p className="mt-1 text-sm text-muted">
                Busca una zona, ajusta la cobertura y completa solo lo que el negocio necesita ver: nombre, tarifa, tiempo, color y estado.
              </p>
            </div>
          </Panel>
        </div>

        <div className="grid gap-5">
          <Panel title="Zonas configuradas" description="Activa, edita o desactiva zonas de entrega.">
            {loadError ? <ErrorState message={loadError} /> : null}
            {loading ? (
              <LoadingState label="Cargando zonas" />
            ) : zones?.length ? (
              <div className="grid gap-3">
                {zones.map((zone) => (
                  <ZoneCard
                    key={zone.id}
                    zone={zone}
                    onEdit={() => editZone(zone)}
                    onDeactivate={() => deactivate(zone.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Sin zonas de delivery"
                description="Crea zonas como Centro, Barrio Obrero, Pueblo Nuevo o La Concordia para que Fronti calcule costos automáticamente."
              />
            )}
          </Panel>

          <Panel title="Referencias locales de San Cristóbal" description="Úsalas como respaldo cuando Google Maps no responda.">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {localReferences?.map((reference) => (
                <button
                  key={reference.name}
                  type="button"
                  onClick={() => applyLocalReference(reference)}
                  className="rounded-2xl border border-line bg-white/[0.045] p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.075]"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: reference.color }} />
                    <span className="text-sm font-semibold text-ink">{reference.name}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {reference.estimatedDistanceKm} km aprox. · USD {reference.suggestedFeeUsd}
                  </p>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      </div>

      <DeliveryZoneMapModal
        open={zoneModalOpen}
        company={company}
        zone={editingZone ?? draftZone}
        saving={savingZone}
        onClose={() => {
          setZoneModalOpen(false);
          setEditingZone(null);
          setDraftZone(null);
        }}
        onSave={submitZone}
      />
    </DeliveryErrorBoundary>
  );
}

function DeliveryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: unknown;
  detail: unknown;
}) {
  return (
    <div className="glass-panel rounded-[22px] p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold text-ink">{renderSafeValue(value)}</p>
      <p className="mt-1 truncate text-xs text-muted">{renderSafeValue(detail)}</p>
    </div>
  );
}

function ZoneCard({
  zone,
  onEdit,
  onDeactivate,
}: {
  zone: DeliveryZone;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  return (
    <div className="rounded-[20px] border border-line bg-white/[0.045] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-1 h-4 w-4 shrink-0 rounded-full shadow-lg"
            style={{ backgroundColor: zone.color ?? '#C9A227' }}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold text-ink">{renderSafeValue(zone.name, 'Zona sin nombre')}</p>
              <StatusBadge>{zone.isActive ? 'Activa' : 'Inactiva'}</StatusBadge>
            </div>
            <p className="mt-1 text-sm text-muted">
              USD {renderSafeValue(zone.fixedFeeUsd ?? zone.priceUsd, '0')} · {renderSafeValue(zone.estimatedTime, 'Tiempo pendiente')} · {renderSafeValue(zone.maxDistanceKm ?? zone.localRadiusKm, 'sin límite')} km
            </p>
            {zone.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-slate-400">{renderSafeValue(zone.description)}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="secondary" onClick={onEdit}>
            <Edit3 className="h-4 w-4" />
            Editar
          </Button>
          <Button type="button" variant="ghost" onClick={onDeactivate}>
            {zone.isActive ? <Power className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            Desactivar
          </Button>
        </div>
      </div>
    </div>
  );
}

function toNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function compactPayload<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined || value === null || value === '') {
        return false;
      }

      if (typeof value === 'number' && Number.isNaN(value)) {
        return false;
      }

      return true;
    }),
  ) as T;
}
