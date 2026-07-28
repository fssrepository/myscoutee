import {
  normalizeOperatorRegistryBaseUrl,
  validateOperatorRegistryBaseUrl,
  validateOperatorRegistryScope
} from './operator-registry-candidate';

describe('operator registry candidate validation', () => {
  it('accepts and normalizes an origin-only registry URL', () => {
    expect(validateOperatorRegistryBaseUrl('https://registry.example.com:8443/', true))
      .toBe('');
    expect(normalizeOperatorRegistryBaseUrl('https://registry.example.com:8443/', true))
      .toBe('https://registry.example.com:8443');
    expect(validateOperatorRegistryBaseUrl('http://127.0.0.1:8081', false))
      .toBe('');
  });

  it('rejects URL shapes the Java operator endpoint rejects', () => {
    expect(validateOperatorRegistryBaseUrl('https://registry.example.com/v1', true))
      .toContain('origin-only');
    expect(validateOperatorRegistryBaseUrl('https://registry.example.com//', true))
      .toContain('origin-only');
    expect(validateOperatorRegistryBaseUrl('https://registry.example.com?scope=demo', true))
      .toContain('origin-only');
    expect(validateOperatorRegistryBaseUrl('https://user:secret@registry.example.com', true))
      .toContain('credentials');
    expect(validateOperatorRegistryBaseUrl('http://registry.example.com', true))
      .toContain('require HTTPS');
  });

  it('uses the same portable registry-scope syntax as Java and Go', () => {
    expect(validateOperatorRegistryScope('demo:local-registry')).toBe('');
    expect(validateOperatorRegistryScope('region.eu_west-1')).toBe('');
    expect(validateOperatorRegistryScope('')).toBe('');
    expect(validateOperatorRegistryScope('EU:central')).toContain('3–128');
    expect(validateOperatorRegistryScope('-demo')).toContain('3–128');
    expect(validateOperatorRegistryScope('ab')).toContain('3–128');
    expect(validateOperatorRegistryScope('demo/scope')).toContain('3–128');
    expect(validateOperatorRegistryScope(`a${'b'.repeat(128)}`)).toContain('3–128');
  });
});
