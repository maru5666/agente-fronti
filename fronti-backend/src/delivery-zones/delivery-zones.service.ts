import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CompaniesService } from '../companies/companies.service';
import { Coordinates, MapsService } from '../maps/maps.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliveryZoneDto } from './dto/create-delivery-zone.dto';
import { EstimateDeliveryDto } from './dto/estimate-delivery.dto';
import { UpdateDeliveryZoneDto } from './dto/update-delivery-zone.dto';

type LocalDeliveryReference = {
  name: string;
  aliases: string[];
  latitude: number;
  longitude: number;
  radiusKm: number;
  estimatedDistanceKm: number;
  suggestedFeeUsd: number;
  color: string;
};

type DeliveryRoute =
  | {
      source: 'google_maps' | 'openstreetmap' | 'local';
      distanceKm: number;
      durationMinutes: number;
    }
  | {
      source: 'unavailable';
      distanceKm: null;
      durationMinutes: null;
    };

const MAX_REASONABLE_DELIVERY_DISTANCE_KM = 60;
const MAX_REASONABLE_DELIVERY_MINUTES = 240;

const SAN_CRISTOBAL_REFERENCES: LocalDeliveryReference[] = [
  {
    name: 'Centro',
    aliases: ['centro', 'plaza bolivar', 'casco central'],
    latitude: 7.7669,
    longitude: -72.225,
    radiusKm: 1.8,
    estimatedDistanceKm: 1.2,
    suggestedFeeUsd: 1.5,
    color: '#C9A227',
  },
  {
    name: 'Barrio Obrero',
    aliases: ['barrio obrero', 'obrero'],
    latitude: 7.7791,
    longitude: -72.2228,
    radiusKm: 2.2,
    estimatedDistanceKm: 2.2,
    suggestedFeeUsd: 2,
    color: '#22C55E',
  },
  {
    name: 'Pueblo Nuevo',
    aliases: ['pueblo nuevo', 'plaza de toros', 'polideportivo'],
    latitude: 7.7857,
    longitude: -72.2148,
    radiusKm: 2.5,
    estimatedDistanceKm: 3.2,
    suggestedFeeUsd: 2.5,
    color: '#3B82F6',
  },
  {
    name: 'La Concordia',
    aliases: ['la concordia', 'concordia'],
    latitude: 7.7556,
    longitude: -72.2296,
    radiusKm: 2,
    estimatedDistanceKm: 2.4,
    suggestedFeeUsd: 2,
    color: '#F59E0B',
  },
  {
    name: 'Pirineos',
    aliases: ['pirineos', 'los pirineos'],
    latitude: 7.7806,
    longitude: -72.213,
    radiusKm: 2.2,
    estimatedDistanceKm: 3.8,
    suggestedFeeUsd: 3,
    color: '#8B5CF6',
  },
  {
    name: 'Tariba',
    aliases: ['tariba', 'táriba', 'tariba centro'],
    latitude: 7.818,
    longitude: -72.224,
    radiusKm: 3.5,
    estimatedDistanceKm: 6.5,
    suggestedFeeUsd: 4,
    color: '#14B8A6',
  },
  {
    name: 'Palmira',
    aliases: ['palmira', 'guásimos', 'guasimos'],
    latitude: 7.8375,
    longitude: -72.226,
    radiusKm: 4,
    estimatedDistanceKm: 9,
    suggestedFeeUsd: 5,
    color: '#EF4444',
  },
];

@Injectable()
export class DeliveryZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
    private readonly mapsService: MapsService,
  ) {}

  async create(createDeliveryZoneDto: CreateDeliveryZoneDto) {
    await this.companiesService.ensureExists(createDeliveryZoneDto.companyId);

    return this.prisma.deliveryZone.create({
      data: createDeliveryZoneDto,
    });
  }

  async findByCompany(companyId: string, onlyActive = true) {
    await this.companiesService.ensureExists(companyId);

    return this.prisma.deliveryZone.findMany({
      where: {
        companyId,
        ...(onlyActive ? { isActive: true } : {}),
      },
      orderBy: [{ priority: 'desc' }, { maxDistanceKm: 'asc' }, { name: 'asc' }],
    });
  }

  async update(id: string, updateDeliveryZoneDto: UpdateDeliveryZoneDto) {
    await this.findOneOrThrow(id);

    if (updateDeliveryZoneDto.companyId) {
      await this.companiesService.ensureExists(updateDeliveryZoneDto.companyId);
    }

    return this.prisma.deliveryZone.update({
      where: { id },
      data: updateDeliveryZoneDto,
    });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);

    return this.prisma.deliveryZone.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async findOneOrThrow(id: string) {
    const deliveryZone = await this.prisma.deliveryZone.findUnique({
      where: { id },
    });

    if (!deliveryZone) {
      throw new NotFoundException('Zona de delivery no encontrada.');
    }

    return deliveryZone;
  }

  async findByName(companyId: string, zoneName: string) {
    const normalizedZoneName = this.normalize(zoneName);
    const zones = await this.findByCompany(companyId);

    return zones.find((zone) =>
      this.normalize(zone.name).includes(normalizedZoneName),
    );
  }

  async findByDistance(companyId: string, distanceKm: number) {
    const zones = await this.findByCompany(companyId);

    return zones.find((zone) => {
      const minDistanceKm = zone.minDistanceKm
        ? Number(zone.minDistanceKm.toString())
        : 0;
      const maxDistanceKm = zone.maxDistanceKm
        ? Number(zone.maxDistanceKm.toString())
        : null;

      if (distanceKm < minDistanceKm) {
        return false;
      }

      return maxDistanceKm === null || maxDistanceKm >= distanceKm;
    });
  }

  getLocalReferences() {
    return SAN_CRISTOBAL_REFERENCES;
  }

  async estimateDelivery(dto: EstimateDeliveryDto) {
    if (!dto.address && (dto.latitude === undefined || dto.longitude === undefined)) {
      throw new BadRequestException(
        'Escribe una dirección o comparte una ubicación para calcular el delivery.',
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    const localMatch = dto.address
      ? this.findLocalReferenceByText(dto.address)
      : this.findLocalReferenceByCoordinates({
          latitude: Number(dto.latitude),
          longitude: Number(dto.longitude),
        });
    const origin = await this.resolveOrigin(company).catch(() => null);
    const destination = await this.resolveDestination(dto, company.address, localMatch);
    const configuredZones = await this.findByCompany(dto.companyId);
    const zoneByName = localMatch
      ? configuredZones.find((deliveryZone) =>
          this.normalize(deliveryZone.name).includes(this.normalize(localMatch.name)),
        ) ?? null
      : null;
    const zoneByCoverage = this.findZoneCoveringCoordinates(
      configuredZones,
      destination.coordinates,
    );
    const coveredZone = zoneByName ?? zoneByCoverage;
    const route: DeliveryRoute = origin
      ? await this.resolveRoute(origin, destination.coordinates, localMatch)
      : coveredZone
        ? this.buildConfiguredZoneRoute(coveredZone, localMatch, origin, destination.coordinates)
        : this.buildLocalRoute(localMatch, undefined);
    const zone =
      coveredZone ??
      (route.distanceKm !== null
        ? await this.findByDistance(dto.companyId, route.distanceKm)
        : null);
    const available = Boolean(zone);
    const deliveryFeeUsd = this.calculateDeliveryFee({
      company,
      zone,
      distanceKm: route.distanceKm,
      localMatch,
      orderSubtotalUsd: dto.orderSubtotalUsd,
    });
    const googleMapsLink = this.mapsService.generateNavigationLink(
      destination.coordinates,
    );

    return {
      available,
      source: route.source,
      usedLocalFallback: route.source === 'local',
      originAddress:
        company.establishmentAddress ?? company.address ?? 'Establecimiento',
      destinationAddress: destination.formattedAddress,
      destinationLatitude: destination.coordinates.latitude,
      destinationLongitude: destination.coordinates.longitude,
      zoneId: zone?.id ?? null,
      zoneName: zone?.name ?? null,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      deliveryFeeUsd,
      deliveryFeeBs: zone?.priceBs?.toString() ?? null,
      googleMapsLink,
      message: this.buildEstimateMessage({
        companyAddress:
          company.establishmentAddress ?? company.address ?? 'el establecimiento',
        destinationLabel: localMatch?.name ?? destination.formattedAddress,
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        deliveryFeeUsd,
        hasZones: Boolean(configuredZones.length),
        zone,
        source: route.source,
      }),
    };
  }

  private async resolveOrigin(company: {
    establishmentLatitude?: Prisma.Decimal | null;
    establishmentLongitude?: Prisma.Decimal | null;
    latitude?: Prisma.Decimal | null;
    longitude?: Prisma.Decimal | null;
    establishmentAddress?: string | null;
    address?: string | null;
  }): Promise<Coordinates> {
    if (company.establishmentLatitude && company.establishmentLongitude) {
      const coordinates = {
        latitude: Number(company.establishmentLatitude.toString()),
        longitude: Number(company.establishmentLongitude.toString()),
      };

      if (this.isUsableDeliveryCoordinate(coordinates)) {
        return coordinates;
      }
    }

    if (company.latitude && company.longitude) {
      const coordinates = {
        latitude: Number(company.latitude.toString()),
        longitude: Number(company.longitude.toString()),
      };

      if (this.isUsableDeliveryCoordinate(coordinates)) {
        return coordinates;
      }
    }

    const address = company.establishmentAddress ?? company.address;
    if (!address) {
      throw new Error('origin_not_configured');
    }

    const geocoded = await this.mapsService.geocodeAddress(
      `${address}, San Cristobal, Tachira, Venezuela`,
    );

    if (!geocoded) {
      throw new Error('origin_not_found');
    }

    return {
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
    };
  }

  private async resolveDestination(
    dto: EstimateDeliveryDto,
    companyAddress?: string | null,
    localMatch?: LocalDeliveryReference | null,
  ) {
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      const coordinates = {
        latitude: Number(dto.latitude),
        longitude: Number(dto.longitude),
      };
      const geocoded = await this.mapsService
        .reverseGeocodeCoordinates(coordinates)
        .catch(() => null);

      return {
        formattedAddress:
          geocoded?.formattedAddress ??
          localMatch?.name ??
          'Ubicación compartida',
        coordinates,
      };
    }

    const address = dto.address?.trim();
    if (!address) {
      throw new BadRequestException(
        'Escribe una dirección o comparte una ubicación para calcular el delivery.',
      );
    }

    const cached = await this.getCachedAddress(dto.companyId, address);
    if (cached?.latitude && cached.longitude) {
      return {
        formattedAddress: cached.formattedAddress,
        coordinates: {
          latitude: Number(cached.latitude.toString()),
          longitude: Number(cached.longitude.toString()),
        },
      };
    }

    const geocoded = await this.mapsService
      .geocodeAddress(
        `${address}, San Cristobal, Tachira, Venezuela`,
        companyAddress,
      )
      .catch(() => null);

    if (geocoded) {
      await this.saveCachedAddress(dto.companyId, address, geocoded, 'google_maps');
      return {
        formattedAddress: geocoded.formattedAddress,
        coordinates: {
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
        },
      };
    }

    if (localMatch) {
      return {
        formattedAddress: localMatch.name,
        coordinates: {
          latitude: localMatch.latitude,
          longitude: localMatch.longitude,
        },
      };
    }

    throw new BadRequestException(
      'No encontramos esa dirección. Escribe una referencia cercana.',
    );
  }

  private async resolveRoute(
    origin: Coordinates,
    destination: Coordinates,
    localMatch?: LocalDeliveryReference | null,
  ): Promise<DeliveryRoute> {
    const googleRoute = await this.mapsService
      .calculateDistance(origin, destination)
      .catch(() => null);

    if (googleRoute) {
      const distanceKm = Number(googleRoute.distanceKm);
      const durationMinutes = Number(googleRoute.durationMinutes);

      if (!this.isReasonableRoute(distanceKm, durationMinutes)) {
        return this.buildLocalRoute(localMatch, this.haversineKm(origin, destination));
      }

      return {
        source: googleRoute.source,
        distanceKm,
        durationMinutes,
      };
    }

    return this.buildLocalRoute(localMatch, this.haversineKm(origin, destination));
  }

  private buildConfiguredZoneRoute(
    zone: {
      estimatedTime: string;
      distanceFromCompanyKm?: Prisma.Decimal | null;
    },
    localMatch: LocalDeliveryReference | null | undefined,
    origin: Coordinates | null,
    destination: Coordinates,
  ): DeliveryRoute {
    const configuredDistance = this.decimalToNumber(zone.distanceFromCompanyKm);
    const haversineDistance =
      origin !== null ? this.haversineKm(origin, destination) : undefined;
    const distanceKm =
      configuredDistance ??
      localMatch?.estimatedDistanceKm ??
      haversineDistance ??
      null;
    const durationMinutes =
      this.parseEstimatedMinutes(zone.estimatedTime) ??
      (distanceKm !== null ? this.estimateLocalMinutes(distanceKm) : null);

    if (
      distanceKm === null ||
      durationMinutes === null ||
      !this.isReasonableRoute(distanceKm, durationMinutes)
    ) {
      return {
        source: 'unavailable',
        distanceKm: null,
        durationMinutes: null,
      };
    }

    return {
      source: 'local',
      distanceKm: Number(distanceKm.toFixed(2)),
      durationMinutes,
    };
  }

  private buildLocalRoute(
    localMatch?: LocalDeliveryReference | null,
    haversineDistanceKm?: number,
  ): DeliveryRoute {
    const distanceKm = Number(
      (
        haversineDistanceKm ??
        localMatch?.estimatedDistanceKm ??
        0
      ).toFixed(2),
    );
    const durationMinutes = this.estimateLocalMinutes(distanceKm);

    if (!this.isReasonableRoute(distanceKm, durationMinutes)) {
      return {
        source: 'unavailable',
        distanceKm: null,
        durationMinutes: null,
      };
    }

    return {
      source: 'local' as const,
      distanceKm,
      durationMinutes,
    };
  }

  private calculateDeliveryFee(input: {
    company: {
      deliveryBaseFeeUsd?: Prisma.Decimal | null;
      deliveryPricePerKmUsd?: Prisma.Decimal | null;
      deliveryMinimumFeeUsd?: Prisma.Decimal | null;
      deliveryFarZoneSurchargeUsd?: Prisma.Decimal | null;
      deliveryFreeFromUsd?: Prisma.Decimal | null;
    };
    zone?: {
      priceUsd: Prisma.Decimal;
      fixedFeeUsd?: Prisma.Decimal | null;
      pricePerKmUsd?: Prisma.Decimal | null;
      maxDistanceKm?: Prisma.Decimal | null;
    } | null;
    distanceKm: number | null;
    localMatch?: LocalDeliveryReference | null;
    orderSubtotalUsd?: number;
  }) {
    if (!input.zone || input.distanceKm === null) {
      return null;
    }

    const freeFrom = this.decimalToNumber(input.company.deliveryFreeFromUsd);
    if (
      freeFrom !== null &&
      freeFrom > 0 &&
      input.orderSubtotalUsd !== undefined &&
      input.orderSubtotalUsd >= freeFrom
    ) {
      return 0;
    }

    const fixedFee =
      this.decimalToNumber(input.zone?.fixedFeeUsd) ??
      this.decimalToNumber(input.zone?.priceUsd);

    if (fixedFee !== null && fixedFee > 0) {
      return Number(fixedFee.toFixed(2));
    }

    const baseFee = this.decimalToNumber(input.company.deliveryBaseFeeUsd) ?? 1;
    const pricePerKm =
      this.decimalToNumber(input.zone?.pricePerKmUsd) ??
      this.decimalToNumber(input.company.deliveryPricePerKmUsd) ??
      0.5;
    const minimumFee =
      this.decimalToNumber(input.company.deliveryMinimumFeeUsd) ??
      input.localMatch?.suggestedFeeUsd ??
      1.5;
    const maxDistance = this.decimalToNumber(input.zone?.maxDistanceKm);
    const surcharge =
      maxDistance !== null && input.distanceKm > maxDistance
        ? this.decimalToNumber(input.company.deliveryFarZoneSurchargeUsd) ?? 0
        : 0;
    const calculated = baseFee + input.distanceKm * pricePerKm + surcharge;

    return Number(Math.max(calculated, minimumFee).toFixed(2));
  }

  private buildEstimateMessage(input: {
    companyAddress: string;
    destinationLabel: string;
    distanceKm: number | null;
    durationMinutes: number | null;
    deliveryFeeUsd: number | null;
    hasZones: boolean;
    zone?: { name: string } | null;
    source: 'google_maps' | 'openstreetmap' | 'local' | 'unavailable';
  }) {
    if (!input.hasZones) {
      return [
        'La empresa todavía no configuró zonas de delivery.',
        'Puedo registrar la dirección y dejar el pedido pendiente de confirmación.',
      ].join('\n');
    }

    if (!input.zone) {
      return [
        'Esta dirección está fuera del área de cobertura.',
        'Puedes solicitar revisión o cambiar la dirección.',
      ].join('\n');
    }

    const fallbackNote =
      input.source === 'local'
        ? '\nNo pudimos calcular la ruta automáticamente. Usaremos la configuración local de la zona.'
        : input.source === 'unavailable'
          ? '\nNo pudimos calcular la ruta automáticamente. Un operador puede confirmar el delivery.'
          : '';

    return [
      `Perfecto, tomaré como referencia nuestra tienda en ${input.companyAddress}.`,
      `Delivery disponible para ${input.zone.name}.`,
      input.distanceKm !== null
        ? `Distancia estimada: ${input.distanceKm} km.`
        : 'Distancia: no disponible.',
      input.durationMinutes !== null
        ? `Tiempo estimado: ${input.durationMinutes} min.`
        : 'Tiempo estimado: no disponible.',
      input.deliveryFeeUsd !== null
        ? `Costo aproximado de delivery: ${input.deliveryFeeUsd} USD.`
        : 'Costo de delivery: pendiente de confirmar.',
      '¿Confirmas esta dirección?',
      fallbackNote,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async getCachedAddress(companyId: string, query: string) {
    return this.prisma.deliveryAddressCache.findUnique({
      where: {
        companyId_normalizedQuery: {
          companyId,
          normalizedQuery: this.normalize(query),
        },
      },
    });
  }

  private saveCachedAddress(
    companyId: string,
    query: string,
    geocoded: { formattedAddress: string; latitude: number; longitude: number },
    source: string,
  ) {
    return this.prisma.deliveryAddressCache.upsert({
      where: {
        companyId_normalizedQuery: {
          companyId,
          normalizedQuery: this.normalize(query),
        },
      },
      create: {
        companyId,
        query,
        normalizedQuery: this.normalize(query),
        formattedAddress: geocoded.formattedAddress,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        source,
      },
      update: {
        query,
        formattedAddress: geocoded.formattedAddress,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        source,
      },
    });
  }

  private findLocalReferenceByText(value: string) {
    const normalized = this.normalize(value);

    return SAN_CRISTOBAL_REFERENCES.find((reference) =>
      reference.aliases.some((alias) => normalized.includes(this.normalize(alias))),
    );
  }

  private findLocalReferenceByCoordinates(coordinates: Coordinates) {
    return SAN_CRISTOBAL_REFERENCES.find((reference) => {
      const distanceKm = this.haversineKm(coordinates, {
        latitude: reference.latitude,
        longitude: reference.longitude,
      });

      return distanceKm <= reference.radiusKm;
    });
  }

  private findZoneCoveringCoordinates<
    T extends {
      isActive: boolean;
      localLatitude?: Prisma.Decimal | null;
      localLongitude?: Prisma.Decimal | null;
      localRadiusKm?: Prisma.Decimal | null;
      maxDistanceKm?: Prisma.Decimal | null;
    },
  >(
    zones: T[],
    coordinates: Coordinates,
  ) {
    return zones.find((zone) => {
      if (!zone.isActive) {
        return false;
      }

      const latitude = this.decimalToNumber(zone.localLatitude);
      const longitude = this.decimalToNumber(zone.localLongitude);
      const radiusKm =
        this.decimalToNumber(zone.localRadiusKm) ??
        this.decimalToNumber(zone.maxDistanceKm);

      if (latitude === null || longitude === null || radiusKm === null || radiusKm <= 0) {
        return false;
      }

      const distanceKm = this.haversineKm(
        { latitude, longitude },
        coordinates,
      );

      return distanceKm <= radiusKm;
    }) ?? null;
  }

  private haversineKm(origin: Coordinates, destination: Coordinates) {
    const earthRadiusKm = 6371;
    const deltaLatitude = this.toRadians(destination.latitude - origin.latitude);
    const deltaLongitude = this.toRadians(destination.longitude - origin.longitude);
    const originLatitude = this.toRadians(origin.latitude);
    const destinationLatitude = this.toRadians(destination.latitude);
    const value =
      Math.sin(deltaLatitude / 2) ** 2 +
      Math.cos(originLatitude) *
        Math.cos(destinationLatitude) *
        Math.sin(deltaLongitude / 2) ** 2;

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  private estimateLocalMinutes(distanceKm: number) {
    return Math.max(12, Math.ceil(10 + distanceKm * 4));
  }

  private parseEstimatedMinutes(value?: string | null) {
    if (!value) {
      return null;
    }

    const match = value.match(/\d+/);
    if (!match) {
      return null;
    }

    const minutes = Number(match[0]);
    return Number.isFinite(minutes) ? minutes : null;
  }

  private isReasonableRoute(distanceKm: number, durationMinutes: number) {
    return (
      Number.isFinite(distanceKm) &&
      Number.isFinite(durationMinutes) &&
      distanceKm >= 0 &&
      durationMinutes >= 0 &&
      distanceKm <= MAX_REASONABLE_DELIVERY_DISTANCE_KM &&
      durationMinutes <= MAX_REASONABLE_DELIVERY_MINUTES
    );
  }

  private isUsableDeliveryCoordinate(coordinates: Coordinates) {
    return (
      Number.isFinite(coordinates.latitude) &&
      Number.isFinite(coordinates.longitude) &&
      coordinates.latitude >= 6.5 &&
      coordinates.latitude <= 8.8 &&
      coordinates.longitude >= -73.8 &&
      coordinates.longitude <= -71
    );
  }

  private decimalToNumber(value?: Prisma.Decimal | null) {
    if (value === undefined || value === null) {
      return null;
    }

    return Number(value.toString());
  }

  private toRadians(value: number) {
    return (value * Math.PI) / 180;
  }

  private normalize(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
