import { Injectable } from '@angular/core';

import type { LocationCoordinates } from '../../../contracts/user.interface';
import type { CountryPartition } from '../entity/country-partition.entity';

const DEMO_COUNTRY_PARTITIONS: readonly CountryPartition[] = [
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
}
