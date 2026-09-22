import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { LocalCountryPartitionsRepository } from './country-partitions.repository';

describe('Germany country eligibility', () => {
  const repository = new LocalCountryPartitionsRepository();
  it('lists Germany and resolves its country code', () => {
    expect(repository.querySupportedCountries()).toContainEqual({ countryCode: 'DE', countryName: 'Germany' });
    expect(repository.resolvePartitionKeyByCountryCode('de')).toBe('country:de');
  });
  it.each([[52.52, 13.405], [48.137, 11.575], [53.5511, 9.9937], [50.9375, 6.9603]])(
    'accepts a German city at %s, %s', (latitude, longitude) => {
      expect(repository.resolvePartitionKeyByCoordinates({ latitude, longitude })).toBe('country:de');
    });
  it.each([[50.0755, 14.4378], [47.3769, 8.5417], [52.3676, 4.9041], [48.8566, 2.3522]])(
    'does not expand Germany to neighbouring cities at %s, %s', (latitude, longitude) => {
      expect(repository.resolvePartitionKeyByCoordinates({ latitude, longitude })).toBeNull();
    });
  it('preserves Hungary', () => {
    expect(repository.resolvePartitionKeyByCoordinates({ latitude: 47.4979, longitude: 19.0402 })).toBe('country:hu');
  });
});
