import { secureRandomInt } from '../../../../common/secure-random';
import { Injectable } from '@angular/core';

import type { CountryPartition } from '../../entity/platform/country-partition.entity';
import { GERMANY_PARTITION } from './country-de.generated';
import { UNITED_KINGDOM_PARTITION } from './country-gb.generated';
import { SPAIN_PARTITION } from './country-es.generated';
import { HUNGARY_PARTITION } from './country-hu.generated';

const DEMO_COUNTRY_PARTITIONS: readonly CountryPartition[] = [
  GERMANY_PARTITION,
  SPAIN_PARTITION,
  UNITED_KINGDOM_PARTITION,
  HUNGARY_PARTITION
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

  randomPartition(): CountryPartition {
    const partition = DEMO_COUNTRY_PARTITIONS[secureRandomInt(DEMO_COUNTRY_PARTITIONS.length)];
    return { ...partition, locationCoordinates: { ...partition.locationCoordinates } };
  }

  private normalizeCountryCode(countryCode: string | null | undefined): string {
    return `${countryCode ?? ''}`
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
  }

}
