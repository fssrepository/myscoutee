import { isNavigatorHydrationRoute } from './navigator-hydration-route';

describe('isNavigatorHydrationRoute', () => {
  it('keeps Admin workspace hydration owned by Admin bootstrap', () => {
    expect(isNavigatorHydrationRoute('/admin')).toBe(false);
    expect(isNavigatorHydrationRoute('/admin/workspace')).toBe(false);
  });

  it('hydrates the Operator profile through the shared navigator path', () => {
    expect(isNavigatorHydrationRoute('/operator')).toBe(true);
    expect(isNavigatorHydrationRoute('/operator?panel=registry')).toBe(true);
  });

  it('preserves existing Member route behavior', () => {
    expect(isNavigatorHydrationRoute('/game')).toBe(true);
    expect(isNavigatorHydrationRoute('/activities/events')).toBe(true);
    expect(isNavigatorHydrationRoute('/entry')).toBe(false);
    expect(isNavigatorHydrationRoute('/')).toBe(false);
  });
});
