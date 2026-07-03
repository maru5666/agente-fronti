import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodedAddress extends Coordinates {
  formattedAddress: string;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export interface DistanceResult {
  distanceKm: number;
  durationMinutes: number;
  source: 'google_maps' | 'openstreetmap';
}

const MAX_REASONABLE_DELIVERY_DISTANCE_KM = 60;
const MAX_REASONABLE_DELIVERY_MINUTES = 240;
const DEFAULT_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const DEFAULT_DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';

@Injectable()
export class MapsService {
  constructor(private readonly configService: ConfigService) {}

  async validateAddress(address: string, companyAddress?: string | null) {
    const geocoded = await this.geocodeAddress(address, companyAddress);

    if (!geocoded) {
      throw new BadRequestException('No encontramos esa dirección. Escribe una referencia cercana.');
    }

    return geocoded;
  }

  async geocodeAddress(
    address: string,
    companyAddress?: string | null,
  ): Promise<GeocodedAddress | null> {
    const query = companyAddress ? `${address}, cerca de ${companyAddress}` : address;
    const googleResult = await this.geocodeWithGoogle(query).catch((error) => {
      console.error('[MapsService] Google geocoding falló:', this.errorMessage(error));
      return null;
    });

    if (googleResult) {
      return googleResult;
    }

    return this.geocodeWithOpenStreetMap(query).catch((error) => {
      console.error('[MapsService] OpenStreetMap geocoding falló:', this.errorMessage(error));
      return null;
    });
  }

  reverseGeocode(coordinates: Coordinates) {
    return this.reverseGeocodeCoordinates(coordinates);
  }

  async reverseGeocodeCoordinates(
    coordinates: Coordinates,
  ): Promise<GeocodedAddress | null> {
    const googleResult = await this.reverseGeocodeWithGoogle(coordinates).catch((error) => {
      console.error('[MapsService] Google reverse geocoding falló:', this.errorMessage(error));
      return null;
    });

    if (googleResult) {
      return googleResult;
    }

    return this.reverseGeocodeWithOpenStreetMap(coordinates).catch((error) => {
      console.error('[MapsService] OpenStreetMap reverse geocoding falló:', this.errorMessage(error));
      return null;
    });
  }

  async calculateDistance(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<DistanceResult> {
    const googleDistance = await this.calculateDistanceWithGoogle(origin, destination).catch((error) => {
      console.error('[MapsService] Google Distance Matrix falló:', this.errorMessage(error));
      return null;
    });

    if (googleDistance) {
      return googleDistance;
    }

    const osrmDistance = await this.calculateDistanceWithOpenStreetMap(origin, destination).catch((error) => {
      console.error('[MapsService] OSRM routing falló:', this.errorMessage(error));
      return null;
    });

    if (osrmDistance) {
      return osrmDistance;
    }

    throw new BadRequestException('No encontramos una ruta válida para delivery.');
  }

  estimateDeliveryTime(distanceKm: number, baseMinutes = 10) {
    return Math.ceil(baseMinutes + distanceKm * 3);
  }

  generateNavigationLink(destination: Coordinates) {
    return `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`;
  }

  private async geocodeWithGoogle(query: string): Promise<GeocodedAddress | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    const url =
      this.configService.get<string>('GOOGLE_MAPS_GEOCODING_URL') ?? DEFAULT_GEOCODING_URL;
    const { data } = await axios.get(url, {
      params: { address: query, key: apiKey },
      timeout: 7000,
    });
    const result = data.results?.[0];

    if (!result) {
      return null;
    }

    return this.toGoogleGeocodedAddress(result, {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
    });
  }

  private async reverseGeocodeWithGoogle(coordinates: Coordinates): Promise<GeocodedAddress | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    const url =
      this.configService.get<string>('GOOGLE_MAPS_GEOCODING_URL') ?? DEFAULT_GEOCODING_URL;
    const { data } = await axios.get(url, {
      params: {
        latlng: `${coordinates.latitude},${coordinates.longitude}`,
        key: apiKey,
      },
      timeout: 7000,
    });
    const result = data.results?.[0];

    if (!result) {
      return null;
    }

    return this.toGoogleGeocodedAddress(result, coordinates);
  }

  private async calculateDistanceWithGoogle(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<DistanceResult | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    const url =
      this.configService.get<string>('GOOGLE_MAPS_DISTANCE_MATRIX_URL') ??
      DEFAULT_DISTANCE_MATRIX_URL;
    const { data } = await axios.get(url, {
      params: {
        origins: `${origin.latitude},${origin.longitude}`,
        destinations: `${destination.latitude},${destination.longitude}`,
        key: apiKey,
        units: 'metric',
      },
      timeout: 7000,
    });
    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      return null;
    }

    const distanceKm = Number((element.distance.value / 1000).toFixed(2));
    const durationMinutes = Math.ceil(element.duration.value / 60);

    return this.isReasonableRoute(distanceKm, durationMinutes)
      ? { distanceKm, durationMinutes, source: 'google_maps' }
      : null;
  }

  private async geocodeWithOpenStreetMap(query: string): Promise<GeocodedAddress | null> {
    const { data } = await axios.get(NOMINATIM_SEARCH_URL, {
      params: {
        q: query,
        format: 'jsonv2',
        addressdetails: 1,
        limit: 1,
        countrycodes: 've',
      },
      headers: this.openStreetMapHeaders(),
      timeout: 8000,
    });
    const result = Array.isArray(data) ? data[0] : null;

    if (!result) {
      return null;
    }

    return this.toOpenStreetMapAddress(result, {
      latitude: Number(result.lat),
      longitude: Number(result.lon),
    });
  }

  private async reverseGeocodeWithOpenStreetMap(
    coordinates: Coordinates,
  ): Promise<GeocodedAddress | null> {
    const { data } = await axios.get(NOMINATIM_REVERSE_URL, {
      params: {
        lat: coordinates.latitude,
        lon: coordinates.longitude,
        format: 'jsonv2',
        addressdetails: 1,
        zoom: 18,
      },
      headers: this.openStreetMapHeaders(),
      timeout: 8000,
    });

    if (!data || data.error) {
      return null;
    }

    return this.toOpenStreetMapAddress(data, coordinates);
  }

  private async calculateDistanceWithOpenStreetMap(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<DistanceResult | null> {
    const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const { data } = await axios.get(`${OSRM_ROUTE_URL}/${coordinates}`, {
      params: {
        overview: 'false',
        alternatives: 'false',
        steps: 'false',
      },
      timeout: 9000,
    });
    const route = data.routes?.[0];

    if (!route) {
      return null;
    }

    const distanceKm = Number((route.distance / 1000).toFixed(2));
    const durationMinutes = Math.ceil(route.duration / 60);

    return this.isReasonableRoute(distanceKm, durationMinutes)
      ? { distanceKm, durationMinutes, source: 'openstreetmap' }
      : null;
  }

  private getApiKey() {
    return this.configService.get<string>('GOOGLE_MAPS_API_KEY')?.trim() || null;
  }

  private toGoogleGeocodedAddress(
    result: {
      formatted_address: string;
      address_components?: Array<{
        long_name: string;
        short_name: string;
        types: string[];
      }>;
    },
    coordinates: Coordinates,
  ): GeocodedAddress {
    const components = result.address_components ?? [];

    return {
      formattedAddress: result.formatted_address,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      neighborhood:
        this.findGoogleAddressComponent(components, [
          'neighborhood',
          'sublocality',
          'sublocality_level_1',
          'route',
        ]) ?? null,
      city:
        this.findGoogleAddressComponent(components, [
          'locality',
          'administrative_area_level_2',
        ]) ?? null,
      state:
        this.findGoogleAddressComponent(components, [
          'administrative_area_level_1',
        ]) ?? null,
      country: this.findGoogleAddressComponent(components, ['country']) ?? null,
    };
  }

  private toOpenStreetMapAddress(result: any, coordinates: Coordinates): GeocodedAddress {
    const address = result.address ?? {};

    return {
      formattedAddress:
        result.display_name ??
        [address.road, address.neighbourhood, address.city, address.state, address.country]
          .filter(Boolean)
          .join(', ') ??
        'Ubicación compartida',
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      neighborhood:
        address.neighbourhood ??
        address.suburb ??
        address.quarter ??
        address.road ??
        null,
      city: address.city ?? address.town ?? address.municipality ?? address.county ?? null,
      state: address.state ?? null,
      country: address.country ?? null,
    };
  }

  private findGoogleAddressComponent(
    components: Array<{ long_name: string; types: string[] }>,
    types: string[],
  ) {
    return components.find((component) =>
      types.some((type) => component.types.includes(type)),
    )?.long_name;
  }

  private isReasonableRoute(distanceKm: number, durationMinutes: number) {
    return (
      Number.isFinite(distanceKm) &&
      Number.isFinite(durationMinutes) &&
      distanceKm > 0 &&
      durationMinutes > 0 &&
      distanceKm <= MAX_REASONABLE_DELIVERY_DISTANCE_KM &&
      durationMinutes <= MAX_REASONABLE_DELIVERY_MINUTES
    );
  }

  private openStreetMapHeaders() {
    return {
      'User-Agent': 'FrontiAI/1.0 (delivery@fronti.local)',
      'Accept-Language': 'es-VE,es;q=0.9,en;q=0.5',
    };
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
