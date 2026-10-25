import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { APP_STORAGE_KEYS } from '../../../common/storage-scope';
import type { FirebaseAuthRequestDto } from '../../../contracts/accounts/user.interface';
import { HttpSessionRegistryService } from '../../../http/services/accounts/session-registry.service';
import { FirebaseAuthService } from './firebase-auth.service';
import { SessionService } from './session.service';
import { AppMemoryDb } from '../../../common/app.db';

describe('SessionService account sessions', () => {
  const originalActivitiesDataSource = environment.activitiesDataSource;
  const installerEmail =
    'operator-0123456789abcdef01234567@deployment.invalid';
  const registerPasswordLogin = vi.fn();
  const firebaseSignIn = vi.fn();
  const firebaseRestore = vi.fn();
  const firebaseSignOut = vi.fn();
  const firebaseGetIdToken = vi.fn();
  const registerLogin = vi.fn();
  const registerDemoLogin = vi.fn();
  const revokeDemoSession = vi.fn();
  const revokeSession = vi.fn();

  const keys = new Map<string, CryptoKey>();
  beforeEach(async () => {
    const { webcrypto } = await vi.importActual<{ webcrypto: Crypto }>('node:crypto');
    vi.stubGlobal('crypto', webcrypto);
    keys.clear();
    // Session tests do not start the unrelated asynchronous messaging tree.
    vi.spyOn(SessionService.prototype as unknown as {
      initializeFirebaseMessagingForSession(session: unknown): Promise<void>;
    }, 'initializeFirebaseMessagingForSession').mockResolvedValue(undefined);
    environment.activitiesDataSource = originalActivitiesDataSource;
    localStorage.clear();
    sessionStorage.clear();
    registerPasswordLogin.mockReset();
    firebaseSignIn.mockReset();
    firebaseRestore.mockReset().mockResolvedValue(null);
    firebaseSignOut.mockReset().mockResolvedValue(undefined);
    firebaseGetIdToken.mockReset().mockResolvedValue('firebase-token');
    registerLogin.mockReset().mockImplementation((sessionId: string) => Promise.resolve(loginResponse(sessionId)));
    registerDemoLogin.mockReset().mockResolvedValue({
      accepted: true,
      existingSession: false,
      outcome: 'ACCEPTED',
      activeSessionCount: 1,
      maxActiveSessions: 2
    });
    revokeDemoSession.mockReset().mockResolvedValue(undefined);
    revokeSession.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        SessionService,
        { provide: AppMemoryDb, useValue: {
          readIndexedDbTableEntry: async (key: string) => keys.get(key) ?? null,
          updateIndexedDbTableEntry: async (key: string, update: (current: CryptoKey | null) => CryptoKey) => {
            const value = structuredClone(update(keys.get(key) ?? null));
            keys.set(key, value);
            return structuredClone(value);
          }
        } },
        {
          provide: FirebaseAuthService,
          useValue: {
            signIn: firebaseSignIn,
            restoreSessionProfile: firebaseRestore,
            signOut: firebaseSignOut,
            getIdToken: firebaseGetIdToken
          }
        },
        {
          provide: HttpSessionRegistryService,
          useValue: {
            registerLogin,
            registerPasswordLogin,
            registerDemoLogin,
            revokeDemoSession,
            revokeSession
          }
        }
      ]
    });
  });

  afterEach(async () => {
    await TestBed.inject(SessionService).ensureSession();
    environment.activitiesDataSource = originalActivitiesDataSource;
    TestBed.resetTestingModule();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('persists only the current Firebase session avatar preview and restores it', async () => {
    const session = { kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', sessionId: 'current-session', profile: {
      id: 'firebase-user', name: 'User', email: 'user@example.test', initials: 'U'
    } };
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify(session));
    const service = TestBed.inject(SessionService);
    service.setSessionAvatarPreview('old-session', '/wrong.webp');
    expect(service.currentSession()).not.toHaveProperty('avatarImageUrl', '/wrong.webp');
    service.setSessionAvatarPreview('current-session', '/correct.webp');
    expect(service.currentSession()).toMatchObject({ avatarImageUrl: '/correct.webp' });
    await service.ensureSession();
    const restored = TestBed.runInInjectionContext(() => new SessionService());
    await expect(restored.ensureSession()).resolves.toMatchObject({ avatarImageUrl: '/correct.webp' });
    expect(firebaseRestore).not.toHaveBeenCalled();
  });

  it('keeps image bytes across restoration but rejects stale session/source results and clears changed photos', async () => {
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', sessionId: 'current',
      profile: { id: 'firebase-user', name: 'User', email: 'user@example.test', initials: 'U' }, avatarImageUrl: '/photo.webp' }));
    const service = TestBed.inject(SessionService);
    const preview = 'data:image/webp;base64,UklGRg==';
    service.setSessionAvatarPreviewData('old', '/photo.webp', preview);
    service.setSessionAvatarPreviewData('current', '/old.webp', preview);
    expect(service.currentSession()).not.toHaveProperty('avatarImageDataUrl', preview);
    service.setSessionAvatarPreviewData('current', '/photo.webp', preview);
    service.setSessionAvatarPreview('current', '/photo.webp');
    await service.ensureSession();
    const restored = TestBed.runInInjectionContext(() => new SessionService());
    await expect(restored.ensureSession()).resolves.toMatchObject({ avatarImageDataUrl: preview });
    service.setSessionAvatarPreview('current', '');
    expect(service.currentSession()).toHaveProperty('avatarImageDataUrl', undefined);
    service.setSessionAvatarPreviewData('current', '/photo.webp', preview);
    expect(service.currentSession()).toHaveProperty('avatarImageDataUrl', undefined);
  });

  it.each(['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/webp;base64,' + 'A'.repeat(90000)])(
    'rejects unsafe or oversized stored avatar data', data => {
      localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify({ kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', sessionId: 'current',
        profile: { id: 'firebase-user', name: 'User', email: 'user@example.test', initials: 'U' },
        avatarImageUrl: '/photo.webp', avatarImageDataUrl: data }));
      expect(TestBed.inject(SessionService).currentSession()).toHaveProperty('avatarImageDataUrl', undefined);
    });

  it('exchanges a password proof for the shared account session without persisting the password', async () => {
    registerPasswordLogin.mockResolvedValue(loginResponse('session:password'));
    const service = TestBed.inject(SessionService);
    await expect(service.startAuthSession(emailSignInRequest())).resolves.toMatchObject({
      kind: 'authenticated', profile: { id: 'account-user' }, accessToken: 'app-token'
    });
    expect(await service.getAccessToken()).toBe('app-token');
    await service.ensureSession();
    const stored = localStorage.getItem(APP_STORAGE_KEYS.session)!;
    expect(JSON.parse(stored)).toMatchObject({ kind: 'authenticated', version: 1 });
    for (const value of ['installer-password', 'app-token', installerEmail, 'account-user']) expect(stored).not.toContain(value);
    const key = keys.get('session.cache-key.v1')!;
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
    const restored = TestBed.runInInjectionContext(() => new SessionService());
    await expect(restored.getAccessToken()).resolves.toBe('app-token');
    expect(registerPasswordLogin).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/^session:/),
      expect.objectContaining({ email: installerEmail, password: 'installer-password' }));
    expect(firebaseSignIn).not.toHaveBeenCalled();
  });

  it('does not let extra response fields turn an account login into plaintext demo storage', async () => {
    const response = loginResponse('session:account');
    registerPasswordLogin.mockResolvedValue({
      ...response,
      session: { ...response.session, kind: 'demo', userId: installerEmail }
    });
    const service = TestBed.inject(SessionService);
    await expect(service.startAuthSession(emailSignInRequest())).resolves.toMatchObject({
      kind: 'authenticated', accessToken: 'app-token'
    });
    await service.ensureSession();
    const stored = localStorage.getItem(APP_STORAGE_KEYS.session)!;
    expect(JSON.parse(stored)).toMatchObject({ kind: 'authenticated', version: 1 });
    for (const value of ['app-token', installerEmail, 'session:account']) expect(stored).not.toContain(value);
    const restored = TestBed.runInInjectionContext(() => new SessionService());
    await expect(restored.getAccessToken()).resolves.toBe('app-token');
  });

  it('keeps a newly selected demo session when an account encryption write is pending', async () => {
    registerPasswordLogin.mockResolvedValue(loginResponse('session:account'));
    const service = TestBed.inject(SessionService);
    await service.startAuthSession(emailSignInRequest());
    const demo = service.startDemoSession('demo-user');
    await service.ensureSession();
    expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEYS.session)!)).toEqual(demo);
    const restored = TestBed.runInInjectionContext(() => new SessionService());
    await expect(restored.ensureSession()).resolves.toEqual(demo);
  });

  it('migrates the existing plaintext account session and restores it while offline', async () => {
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify({ kind: 'authenticated', ...loginResponse('legacy').session }));
    const service = TestBed.inject(SessionService);
    expect(localStorage.getItem(APP_STORAGE_KEYS.session)).toBeNull();
    await service.ensureSession();
    expect(localStorage.getItem(APP_STORAGE_KEYS.session)).not.toContain('app-token');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const restored = TestBed.runInInjectionContext(() => new SessionService());
    await expect(restored.ensureSession()).resolves.toMatchObject({ sessionId: 'legacy', accessToken: 'app-token' });
    expect(registerLogin).not.toHaveBeenCalled();
    expect(firebaseRestore).not.toHaveBeenCalled();
  });

  it('rejects tampered ciphertext without accepting the stored account identity', async () => {
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify({ kind: 'authenticated', ...loginResponse('tampered').session }));
    await TestBed.inject(SessionService).ensureSession();
    const stored = JSON.parse(localStorage.getItem(APP_STORAGE_KEYS.session)!);
    stored.ciphertext[0] ^= 1;
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify(stored));
    const restored = TestBed.runInInjectionContext(() => new SessionService());
    await expect(restored.ensureSession()).resolves.toBeNull();
    expect(localStorage.getItem(APP_STORAGE_KEYS.session)).toBeNull();
  });

  it('keeps an account in memory without storing plaintext when encryption is unavailable', async () => {
    registerPasswordLogin.mockResolvedValue(loginResponse('unavailable'));
    vi.spyOn(crypto.subtle, 'generateKey').mockRejectedValue(new Error('Storage unavailable'));
    const service = TestBed.inject(SessionService);
    await service.startAuthSession(emailSignInRequest());
    await expect(service.ensureSession()).resolves.toMatchObject({ accessToken: 'app-token' });
    expect(localStorage.getItem(APP_STORAGE_KEYS.session)).toBeNull();
  });

  it('does not replace a newly selected support perspective with a pending account restoration', async () => {
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify({ kind: 'authenticated', ...loginResponse('admin').session }));
    await TestBed.inject(SessionService).ensureSession();
    const stored = localStorage.getItem(APP_STORAGE_KEYS.session);
    const restored = TestBed.runInInjectionContext(() => new SessionService());
    restored.startDemoSession('reported-user', { supportContext: { kind: 'admin-support', targetUrl: '/game?supportTarget=member' } });
    await expect(restored.ensureSession()).resolves.toMatchObject({ kind: 'demo', userId: 'reported-user' });
    expect(localStorage.getItem(APP_STORAGE_KEYS.session)).toBe(stored);
  });

  it('does not resurrect a logged-out account after a pending encrypted write', async () => {
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify({ kind: 'authenticated', ...loginResponse('pending').session }));
    const service = TestBed.inject(SessionService);
    service.rejectSession('pending');
    await service.ensureSession();
    expect(localStorage.getItem(APP_STORAGE_KEYS.session)).toBeNull();
    expect(service.currentSession()).toBeNull();
  });

  it('registers a password login once across concurrent clicks and session continuation', async () => {
    let accept!: (response: ReturnType<typeof loginResponse>) => void;
    registerPasswordLogin.mockReturnValue(new Promise(resolve => accept = resolve));
    const service = TestBed.inject(SessionService);
    const pending = service.startAuthSession(emailSignInRequest());
    await expect(service.startAuthSession(emailSignInRequest())).resolves.toBeNull();
    await vi.waitFor(() => expect(registerPasswordLogin).toHaveBeenCalledOnce());
    accept(loginResponse('single-login'));
    await pending;
    await expect(service.restoreAuthSession()).resolves.toMatchObject({ sessionId: 'single-login' });
    expect(registerPasswordLogin).toHaveBeenCalledOnce();
    expect(registerLogin).not.toHaveBeenCalled();
    expect(firebaseRestore).not.toHaveBeenCalled();
  });

  it('exchanges Firebase identity proof for the same canonical account session', async () => {
    firebaseSignIn.mockResolvedValue({ profile: { id: 'provider-uid', name: 'Provider', email: installerEmail, initials: 'P' } });
    const service = TestBed.inject(SessionService);
    await expect(service.startAuthSession({ provider: 'google' })).resolves.toMatchObject({
      kind: 'authenticated', profile: { id: 'account-user' }, accessToken: 'app-token'
    });
    expect(registerLogin).toHaveBeenCalledExactlyOnceWith(expect.any(String), 'firebase-token', expect.objectContaining({ provider: 'google' }));
    expect(await service.getAccessToken()).toBe('app-token');
    expect(firebaseGetIdToken).toHaveBeenCalledOnce();
  });

  it('tries the available password proof for ordinary emails and falls back only when inapplicable', async () => {
    registerPasswordLogin.mockRejectedValue({ status: 404 });
    firebaseSignIn.mockResolvedValue({ profile: null });
    const request = { ...emailSignInRequest(), email: 'member@example.test' };
    await TestBed.inject(SessionService).startAuthSession(request);
    expect(registerPasswordLogin).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ email: request.email }));
    expect(firebaseSignIn).toHaveBeenCalledWith(request);
  });

  it.each([401, 429, 500])('does not fall through after a rejected password proof (%s)', async status => {
    registerPasswordLogin.mockRejectedValue({ status });
    const service = TestBed.inject(SessionService);
    await expect(service.startAuthSession(emailSignInRequest())).resolves.toBeNull();
    expect(firebaseSignIn).not.toHaveBeenCalled();
    expect(service.authNotice()).toBe(status === 429 ? 'auth.session.login.throttled' : 'auth.session.login.failed');
  });

  it('keeps a valid account session online and offline without reloading the identity provider', async () => {
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify({ kind: 'authenticated', ...loginResponse('persisted').session }));
    const service = TestBed.inject(SessionService);
    await expect(service.ensureSession()).resolves.toMatchObject({ sessionId: 'persisted' });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(service.ensureSession()).resolves.toMatchObject({ sessionId: 'persisted' });
    expect(firebaseRestore).not.toHaveBeenCalled();
    expect(registerLogin).not.toHaveBeenCalled();
  });

  it('rejects expired stored sessions regardless of login method', async () => {
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify({ kind: 'authenticated',
      ...loginResponse('expired').session, expiresAt: '2020-01-01T00:00:00Z' }));
    await expect(TestBed.inject(SessionService).ensureSession()).resolves.toBeNull();
    expect(firebaseRestore).not.toHaveBeenCalled();
  });

  it('ignores a late rejection belonging to a previous session', () => {
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify({ kind: 'authenticated', ...loginResponse('current').session }));
    const service = TestBed.inject(SessionService);
    expect(service.rejectSession('old')).toBe(false);
    expect(service.currentSession()).not.toBeNull();
    expect(service.rejectSession('current')).toBe(true);
    expect(service.currentSession()).toBeNull();
    expect(localStorage.getItem(APP_STORAGE_KEYS.session)).toBeNull();
  });

  it('revokes the common credential on logout without consulting the identity provider', async () => {
    environment.activitiesDataSource = 'http';
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify({ kind: 'authenticated', ...loginResponse('current').session }));
    const service = TestBed.inject(SessionService);
    await service.logout();
    expect(revokeSession).toHaveBeenCalledWith('current', 'account-user', 'app-token');
    expect(service.currentSession()).toBeNull();
    expect(firebaseGetIdToken).not.toHaveBeenCalled();
  });

  it.each(['authenticated', 'demo'])('does not revoke an already completed %s logout twice', async kind => {
    environment.activitiesDataSource = 'http';
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify(kind === 'demo'
      ? { kind: 'demo', userId: 'account-user', sessionId: 'revoked' }
      : { kind: 'authenticated', ...loginResponse('revoked').session }));
    const service = TestBed.inject(SessionService);
    await service.logout({ sessionAlreadyRevoked: true });
    await service.ensureSession();
    expect(revokeSession).not.toHaveBeenCalled();
    expect(revokeDemoSession).not.toHaveBeenCalled();
    expect(service.currentSession()).toBeNull();
    expect(localStorage.getItem(APP_STORAGE_KEYS.session)).toBeNull();
  });

  it('publishes a tracked demo session only after server registration accepts it', async () => {
    let acceptRegistration!: (value: {
      accepted: boolean;
      existingSession: boolean;
      outcome: string;
      activeSessionCount: number;
      maxActiveSessions: number;
    }) => void;
    registerDemoLogin.mockReturnValue(new Promise(resolve => {
      acceptRegistration = resolve;
    }));
    const service = TestBed.inject(SessionService);

    const login = service.startTrackedDemoSession('demo-user');

    expect(service.currentSession()).toBeNull();
    expect(localStorage.getItem(APP_STORAGE_KEYS.session)).toBeNull();
    await vi.waitFor(() => expect(registerDemoLogin).toHaveBeenCalledOnce());

    acceptRegistration({
      accepted: true,
      existingSession: false,
      outcome: 'ACCEPTED',
      activeSessionCount: 1,
      maxActiveSessions: 2
    });

    await expect(login).resolves.toMatchObject({ kind: 'demo', userId: 'demo-user' });
    expect(service.currentSession()).toMatchObject({ kind: 'demo', userId: 'demo-user' });
  });

  it('reuses the tracked demo session when the same browser reopens the same user', async () => {
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify({
      kind: 'demo',
      userId: 'admin-demo-ava',
      sessionId: 'session:current-browser'
    }));
    registerDemoLogin.mockResolvedValue({
      accepted: true,
      existingSession: true,
      outcome: 'ACCEPTED',
      activeSessionCount: 2,
      maxActiveSessions: 2
    });
    const service = TestBed.inject(SessionService);

    await expect(service.startTrackedDemoSession('admin-demo-ava')).resolves.toMatchObject({
      kind: 'demo',
      userId: 'admin-demo-ava',
      sessionId: 'session:current-browser'
    });

    expect(registerDemoLogin).toHaveBeenCalledWith(
      'session:current-browser',
      'admin-demo-ava',
      expect.objectContaining({ provider: 'demo' })
    );
  });

  it('keeps the current browser session when another tracked demo login is rejected', async () => {
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify({
      kind: 'demo',
      userId: 'admin-demo-ava',
      sessionId: 'session:current-browser'
    }));
    registerDemoLogin.mockRejectedValue({ status: 409 });
    const service = TestBed.inject(SessionService);

    await expect(service.startTrackedDemoSession('other-demo-user')).resolves.toBeNull();

    expect(service.currentSession()).toMatchObject({
      kind: 'demo',
      userId: 'admin-demo-ava',
      sessionId: 'session:current-browser'
    });
    expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEYS.session) ?? '{}'))
      .toMatchObject({ sessionId: 'session:current-browser' });
  });

  it('revokes a tracked demo session before logout completes', async () => {
    environment.activitiesDataSource = 'http';
    const service = TestBed.inject(SessionService);
    const session = await service.startTrackedDemoSession('demo-user');

    await service.logout();

    expect(revokeDemoSession).toHaveBeenCalledWith(
      session?.kind === 'demo' ? session.sessionId : '',
      'demo-user'
    );
    expect(service.currentSession()).toBeNull();
  });

  it('logs out a local demo session without contacting the session registry', async () => {
    environment.activitiesDataSource = 'local';
    const service = TestBed.inject(SessionService);
    service.startDemoSession('demo-user');

    await service.logout();

    expect(revokeDemoSession).not.toHaveBeenCalled();
    expect(revokeSession).not.toHaveBeenCalled();
    expect(service.currentSession()).toBeNull();
    expect(localStorage.getItem(APP_STORAGE_KEYS.session)).toBeNull();
  });

  it('keeps an admin help perspective in the new tab without replacing the admin session', () => {
    const service = TestBed.inject(SessionService);
    service.startDemoSession('admin-demo-ava');
    const storedAdminSession = localStorage.getItem(APP_STORAGE_KEYS.session);

    expect(service.startDemoSession('reported-user', {
      supportContext: {
        kind: 'admin-support',
        targetUrl: '/game?supportTarget=member'
      }
    })).toMatchObject({
      kind: 'demo',
      userId: 'reported-user',
      supportContext: { kind: 'admin-support' }
    });

    expect(localStorage.getItem(APP_STORAGE_KEYS.session)).toBe(storedAdminSession);
    expect(localStorage.getItem(APP_STORAGE_KEYS.demoActiveUser)).toBe('admin-demo-ava');
    expect(JSON.parse(sessionStorage.getItem(APP_STORAGE_KEYS.adminSupportSession) ?? '{}'))
      .toMatchObject({
        kind: 'demo',
        userId: 'reported-user',
        supportContext: { kind: 'admin-support' }
      });
  });

  it('publishes an admin help perspective only after its server session is registered', async () => {
    const service = TestBed.inject(SessionService);
    service.startDemoSession('admin-demo-ava');
    const storedAdminSession = localStorage.getItem(APP_STORAGE_KEYS.session);

    await expect(service.startTrackedDemoSession('reported-user', {
      supportContext: {
        kind: 'admin-support',
        targetUrl: '/game?supportTarget=member'
      }
    })).resolves.toMatchObject({
      kind: 'demo',
      userId: 'reported-user',
      supportContext: { kind: 'admin-support' }
    });

    expect(registerDemoLogin).toHaveBeenCalledWith(
      expect.stringMatching(/^session:/),
      'reported-user',
      expect.objectContaining({ provider: 'demo' })
    );
    expect(localStorage.getItem(APP_STORAGE_KEYS.session)).toBe(storedAdminSession);
    expect(JSON.parse(sessionStorage.getItem(APP_STORAGE_KEYS.adminSupportSession) ?? '{}'))
      .toMatchObject({
        kind: 'demo',
        userId: 'reported-user',
        sessionId: expect.stringMatching(/^session:/),
        supportContext: { kind: 'admin-support' }
      });
  });

  it('restores the tab-scoped admin help perspective before the shared browser session', () => {
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify({
      kind: 'demo',
      userId: 'admin-demo-ava',
      sessionId: 'session:admin'
    }));
    sessionStorage.setItem(APP_STORAGE_KEYS.adminSupportSession, JSON.stringify({
      kind: 'demo',
      userId: 'reported-user',
      sessionId: 'session:support',
      supportContext: {
        kind: 'admin-support',
        targetUrl: '/game?supportTarget=member'
      }
    }));

    expect(TestBed.inject(SessionService).currentSession()).toMatchObject({
      kind: 'demo',
      userId: 'reported-user',
      sessionId: 'session:support'
    });
  });

  it('does not clear the admin session when the tab-scoped help perspective logs out', async () => {
    environment.activitiesDataSource = 'http';
    const service = TestBed.inject(SessionService);
    service.startDemoSession('admin-demo-ava');
    const storedAdminSession = localStorage.getItem(APP_STORAGE_KEYS.session);
    service.startDemoSession('reported-user', {
      supportContext: { kind: 'admin-support' }
    });

    await service.logout();

    expect(service.currentSession()).toBeNull();
    expect(sessionStorage.getItem(APP_STORAGE_KEYS.adminSupportSession)).toBeNull();
    expect(localStorage.getItem(APP_STORAGE_KEYS.session)).toBe(storedAdminSession);
    expect(localStorage.getItem(APP_STORAGE_KEYS.demoActiveUser)).toBe('admin-demo-ava');
    expect(revokeDemoSession).toHaveBeenCalledWith(
      expect.stringMatching(/^session:/),
      'reported-user'
    );
  });


});

function emailSignInRequest(): FirebaseAuthRequestDto {
  return {
    provider: 'email',
    emailMode: 'sign-in',
    email: 'operator-0123456789abcdef01234567@deployment.invalid',
    password: 'installer-password'
  };
}

function loginResponse(sessionId: string) {
  return { accepted: true, existingSession: false, outcome: 'ACCEPTED', activeSessionCount: 1, maxActiveSessions: 2,
    session: { sessionId, accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z',
      profile: { id: 'account-user', name: 'Account', email: 'account@example.test', initials: 'A' } } };
}
