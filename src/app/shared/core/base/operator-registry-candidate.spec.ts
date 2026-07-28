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
      .toBe('operator.registration.error.url.origin');
    expect(validateOperatorRegistryBaseUrl('https://registry.example.com//', true))
      .toBe('operator.registration.error.url.origin');
    expect(validateOperatorRegistryBaseUrl('https://registry.example.com?scope=demo', true))
      .toBe('operator.registration.error.url.origin');
    expect(validateOperatorRegistryBaseUrl('https://user:secret@registry.example.com', true))
      .toBe('operator.registration.error.url.credentials');
    expect(validateOperatorRegistryBaseUrl('http://registry.example.com', true))
      .toBe('operator.registration.error.url.https.required');
  });

  it('uses the same portable registry-scope syntax as Java and Go', () => {
    expect(validateOperatorRegistryScope('demo:local-registry')).toBe('');
    expect(validateOperatorRegistryScope('region.eu_west-1')).toBe('');
    expect(validateOperatorRegistryScope('')).toBe('');
    expect(validateOperatorRegistryScope('EU:central'))
      .toBe('operator.registration.error.scope.invalid');
    expect(validateOperatorRegistryScope('-demo'))
      .toBe('operator.registration.error.scope.invalid');
    expect(validateOperatorRegistryScope('ab'))
      .toBe('operator.registration.error.scope.invalid');
    expect(validateOperatorRegistryScope('demo/scope'))
      .toBe('operator.registration.error.scope.invalid');
    expect(validateOperatorRegistryScope(`a${'b'.repeat(128)}`))
      .toBe('operator.registration.error.scope.invalid');
  });
});
