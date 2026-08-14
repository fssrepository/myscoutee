import { resolvePwaDevServiceWorkerOverride } from './pwa.service';

describe('PwaService dev service-worker override', () => {
  it('allows the explicit URL switch only outside production', () => {
    expect(resolvePwaDevServiceWorkerOverride('?pwa=on', false)).toBe('enabled');
    expect(resolvePwaDevServiceWorkerOverride('?pwa=off', false)).toBe('disabled');
  });

  it('ignores every URL override in production', () => {
    expect(resolvePwaDevServiceWorkerOverride('?pwa=on', true)).toBeNull();
    expect(resolvePwaDevServiceWorkerOverride('?pwa=off', true)).toBeNull();
  });

  it('ignores unrelated or invalid values', () => {
    expect(resolvePwaDevServiceWorkerOverride('?other=value', false)).toBeNull();
    expect(resolvePwaDevServiceWorkerOverride('?pwa=enabled', false)).toBeNull();
  });
});
