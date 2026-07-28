import { isNavigatorHydrationRoute } from './navigator-hydration-route';

describe('isNavigatorHydrationRoute', () => {
  it('excludes privileged workspaces from Member profile hydration', () => {
    expect(isNavigatorHydrationRoute('/admin')).toBe(false);
    expect(isNavigatorHydrationRoute('/admin/workspace')).toBe(false);
    expect(isNavigatorHydrationRoute('/operator')).toBe(false);
    expect(isNavigatorHydrationRoute('/operator?panel=registry')).toBe(false);
  });

  it('preserves existing Member route behavior', () => {
    expect(isNavigatorHydrationRoute('/game')).toBe(true);
    expect(isNavigatorHydrationRoute('/activities/events')).toBe(true);
    expect(isNavigatorHydrationRoute('/entry')).toBe(false);
    expect(isNavigatorHydrationRoute('/')).toBe(false);
  });
});
