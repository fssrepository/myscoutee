import { signal } from '@angular/core';
import { SideMenuComponent } from './side-menu.component';

describe('startup avatar ring handoff', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [1200, 60, 1800],
    [3000, 0, 1],
    [5000, 0, 1]
  ])('continues the ring after %i ms instead of restarting it', (elapsed, start, durationMs) => {
    vi.spyOn(Date, 'now').mockReturnValue(10000 + elapsed);
    const menu = Object.create(SideMenuComponent.prototype) as SideMenuComponent;
    const timing = signal({ start: 100, durationMs: 3000 });
    Object.assign(menu, { initialAvatarLoadTiming: timing });
    menu.avatarLoadStartedAt = 10000;
    expect(timing()).toEqual({ start, durationMs });
  });
});
