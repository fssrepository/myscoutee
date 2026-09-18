import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type Route } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from './app.routes';
import { CURRENT_PROFILE_FORM_VERSION } from './shared/core/common/constants';
import { type AppSession, SessionService } from './shared/core/base/services/session.service';
import { UsersService } from './shared/core/base/services/users.service';

@Component({ template: 'Page' })
class TestPage {}

// Exercise the production guards and redirects without loading unrelated page trees.
function guardRoutes(source: Route[]): Route[] {
  return source.map(route => {
    const { loadComponent, loadChildren, children, ...rest } = route;
    return {
      ...rest,
      ...(loadComponent || loadChildren ? { component: TestPage } : {}),
      ...(children ? { children: guardRoutes(children) } : {})
    };
  });
}

describe('startup authentication routing', () => {
  const firebaseSession: AppSession = {
    kind: 'firebase', sessionId: 'test-session',
    profile: { id: 'user-1', name: 'Test', email: 'test@example.com', initials: 'T' }
  };
  let storedSession: AppSession | null;
  const ensureSession = vi.fn();
  const peekCachedUserById = vi.fn();
  const loadUserById = vi.fn();

  beforeEach(() => {
    storedSession = firebaseSession;
    ensureSession.mockReset().mockImplementation(async () => storedSession);
    peekCachedUserById.mockReset().mockReturnValue(null);
    loadUserById.mockReset().mockResolvedValue({
      id: 'user-1', profileStatus: 'active', profileFormVersion: CURRENT_PROFILE_FORM_VERSION
    });
    TestBed.configureTestingModule({ providers: [
      provideRouter(guardRoutes(routes)),
      { provide: SessionService, useValue: {
        currentSession: () => storedSession, ensureSession
      } },
      { provide: UsersService, useValue: {
        localModeEnabled: false, peekCachedUserById, loadUserById
      } }
    ] });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('authenticates once across the root-to-game redirect and still loads the server user', async () => {
    await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/game');
    expect(ensureSession).toHaveBeenCalledTimes(1);
    expect(loadUserById).toHaveBeenCalledExactlyOnceWith(undefined, 8000);
  });

  it.each([
    ['admin', { admin: true }],
    ['operator', { operator: true }]
  ])('authenticates once when the cached role routes to %s', async (destination, role) => {
    peekCachedUserById.mockReturnValue({ id: 'user-1', ...role });
    loadUserById.mockResolvedValue({ id: 'user-1', ...role });
    await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe(`/${destination}`);
    expect(ensureSession).toHaveBeenCalledTimes(1);
    expect(loadUserById).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid saved session at the protected destination', async () => {
    ensureSession.mockResolvedValue(null);
    await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/entry?redirect=%2Fgame');
    expect(ensureSession).toHaveBeenCalledTimes(1);
    expect(loadUserById).not.toHaveBeenCalled();
  });

  it('does not trust a cached admin role when the server returns a member', async () => {
    peekCachedUserById.mockReturnValue({ id: 'user-1', admin: true });
    await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/game');
    expect(loadUserById).toHaveBeenCalledTimes(2);
  });

  it('still requires onboarding according to the server profile', async () => {
    loadUserById.mockResolvedValue({ id: 'user-1', profileStatus: 'onboarding' });
    await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/entry?redirect=%2Fgame&onboarding=1');
    expect(ensureSession).toHaveBeenCalledTimes(1);
  });

  it('keeps signed-out visitors on the public entry page', async () => {
    storedSession = null;
    await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/');
    expect(ensureSession).not.toHaveBeenCalled();
    expect(loadUserById).not.toHaveBeenCalled();
  });

  it('checks authentication again on a later protected navigation', async () => {
    const harness = await RouterTestingHarness.create('/');
    await harness.navigateByUrl('/entry');
    ensureSession.mockResolvedValue(null);
    await harness.navigateByUrl('/game');
    expect(TestBed.inject(Router).url).toBe('/entry?redirect=%2Fgame');
    expect(ensureSession).toHaveBeenCalledTimes(2);
  });

  it('waits for authentication before fetching the user or activating a protected page', async () => {
    const harness = await RouterTestingHarness.create();
    let resolveSession!: (session: AppSession | null) => void;
    ensureSession.mockReturnValue(new Promise<AppSession | null>(resolve => {
      resolveSession = resolve;
    }));
    const navigation = harness.navigateByUrl('/');
    await vi.waitFor(() => expect(ensureSession).toHaveBeenCalledTimes(1));
    expect(loadUserById).not.toHaveBeenCalled();
    expect(harness.routeNativeElement).toBeNull();
    resolveSession(firebaseSession);
    await navigation;
    expect(TestBed.inject(Router).url).toBe('/game');
    expect(loadUserById).toHaveBeenCalledTimes(1);
  });

  it('does not admit a saved session when the server user lookup fails', async () => {
    loadUserById.mockRejectedValue(new Error('Unavailable'));
    await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/entry?redirect=%2Fgame');
    expect(ensureSession).toHaveBeenCalledTimes(1);
  });
});
