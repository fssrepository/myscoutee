import '@angular/compiler';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { LocalCountryPartitionsRepository } from './country-partitions.repository';

describe('Offline partition catalog', () => {
  const repository = new LocalCountryPartitionsRepository();
  afterEach(() => vi.restoreAllMocks());

  it('keeps the four supported countries without loading boundary geometry', () => {
    expect(repository.querySupportedCountries().map(country => country.countryCode)).toEqual(['DE', 'ES', 'GB', 'HU']);
    for (const code of ['DE', 'ES', 'GB', 'HU']) {
      const partition = repository.queryPartitionByCountryCode(code)!;
      expect(partition).not.toHaveProperty('geometry');
      expect(partition).not.toHaveProperty('bounds');
      expect(partition.partitionKey).toBe(`country:${code.toLowerCase()}`);
      expect(partition.locationCoordinates.latitude).toBeTypeOf('number');
    }
  });

  it.each([[0, 'DE'], [0.25, 'ES'], [0.5, 'GB'], [0.9999, 'HU']] as const)(
    'can assign each supported partition with random value %s', (random, code) => {
      vi.spyOn(Math, 'random').mockReturnValue(random);
      expect(repository.randomPartition().countryCode).toBe(code);
    });

  it('keeps the catalog sample unchanged when a returned location is edited', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    repository.randomPartition().locationCoordinates.latitude = 0;
    expect(repository.randomPartition().locationCoordinates.latitude).toBe(52.52);
  });

  it('normalizes supported codes and rejects unknown codes', () => {
    expect(repository.resolvePartitionKeyByCountryCode(' hu ')).toBe('country:hu');
    expect(repository.resolvePartitionKeyByCountryCode('US')).toBeNull();
    expect(repository.resolvePartitionKeyByCountryCode(null)).toBeNull();
  });
});
