import { Injectable } from '@angular/core';

import type { LocationCoordinates } from '../../../contracts/user.interface';
import type { CountryPartition } from '../entity/country-partition.entity';
import { GERMANY_PARTITION } from './country-de.generated';

const DEMO_COUNTRY_PARTITIONS: readonly CountryPartition[] = [
  GERMANY_PARTITION,
  {
    partitionKey: 'country:hu',
    countryCode: 'HU',
    countryName: 'Hungary',
    bounds: {
      minLatitude: 45.7,
      maxLatitude: 48.7,
      minLongitude: 16,
      maxLongitude: 23
    }
  }
];

@Injectable({
  providedIn: 'root'
})
export class LocalCountryPartitionsRepository {
  querySupportedCountries(): { countryCode: string; countryName: string }[] {
    return DEMO_COUNTRY_PARTITIONS.map(({ countryCode, countryName }) => ({ countryCode, countryName }));
  }

  queryPartitionByCountryCode(countryCode: string | null | undefined): CountryPartition | null {
    const normalizedCountryCode = this.normalizeCountryCode(countryCode);
    if (!normalizedCountryCode) {
      return null;
    }
    return DEMO_COUNTRY_PARTITIONS.find(partition => partition.countryCode === normalizedCountryCode) ?? null;
  }

  resolvePartitionKeyByCountryCode(countryCode: string | null | undefined): string | null {
    return this.queryPartitionByCountryCode(countryCode)?.partitionKey ?? null;
  }

  resolvePartitionKeyByCoordinates(coordinates: LocationCoordinates | null | undefined): string | null {
    const latitude = Number(coordinates?.latitude);
    const longitude = Number(coordinates?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    const partition = DEMO_COUNTRY_PARTITIONS.find(candidate =>
      latitude >= candidate.bounds.minLatitude
      && latitude <= candidate.bounds.maxLatitude
      && longitude >= candidate.bounds.minLongitude
      && longitude <= candidate.bounds.maxLongitude
      && (!candidate.geometry || candidate.geometry.coordinates.some(polygon =>
        this.containsPoint(polygon[0], longitude, latitude)
        && !polygon.slice(1).some(hole => this.containsPoint(hole, longitude, latitude))))
    );
    return partition?.partitionKey ?? null;
  }

  private normalizeCountryCode(countryCode: string | null | undefined): string {
    return `${countryCode ?? ''}`
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
  }

  private containsPoint(ring: number[][], longitude: number, latitude: number): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, y] = ring[i];
      const [previousX, previousY] = ring[j];
      if ((y > latitude) !== (previousY > latitude)
          && longitude < (previousX - x) * (latitude - y) / (previousY - y) + x) {
        inside = !inside;
      }
    }
    return inside;
  }
}
