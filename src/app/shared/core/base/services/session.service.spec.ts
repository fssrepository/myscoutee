import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../../environments/environment';
import { APP_STORAGE_KEYS } from '../../common/storage-scope';
import type { FirebaseAuthRequestDto } from '../../contracts/user.interface';
import { FirebaseSessionRegistryService } from '../../http/services/firebase-session-registry.service';
import { HttpOperatorBootstrapAuthService } from '../../http/services/operator-bootstrap-auth.service';
import { FirebaseAuthService } from './firebase-auth.service';
import { SessionService } from './session.service';

describe('SessionService operator bootstrap session', () => {
  const originalActivitiesDataSource = environment.activitiesDataSource;
  const installerEmail =
    'operator-0123456789abcdef01234567@deployment.invalid';
  const bootstrapSignIn = vi.fn();
  const firebaseSignIn = vi.fn();
  const firebaseRestore = vi.fn();
  const firebaseSignOut = vi.fn();
  const firebaseGetIdToken = vi.fn();
  const registerLogin = vi.fn();
  const registerDemoLogin = vi.fn();
  const revokeDemoSession = vi.fn();
  const revokeFirebaseSession = vi.fn();

  beforeEach(() => {
    environment.activitiesDataSource = originalActivitiesDataSource;
    localStorage.clear();
    sessionStorage.clear();
    bootstrapSignIn.mockReset();
    firebaseSignIn.mockReset();
    firebaseRestore.mockReset().mockResolvedValue(null);
    firebaseSignOut.mockReset().mockResolvedValue(undefined);
    firebaseGetIdToken.mockReset().mockResolvedValue('firebase-token');
    registerLogin.mockReset().mockResolvedValue({
      accepted: true,
      existingSession: false,
      outcome: 'ACCEPTED',
      activeSessionCount: 1,
      maxActiveSessions: 2
    });
    registerDemoLogin.mockReset().mockResolvedValue({
      accepted: true,
      existingSession: false,
      outcome: 'ACCEPTED',
      activeSessionCount: 1,
      maxActiveSessions: 2
    });
    revokeDemoSession.mockReset().mockResolvedValue(undefined);
    revokeFirebaseSession.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        SessionService,
        {
          provide: HttpOperatorBootstrapAuthService,
          useValue: { signIn: bootstrapSignIn }
        },
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
          provide: FirebaseSessionRegistryService,
          useValue: {
            registerLogin,
            registerDemoLogin,
            revokeDemoSession,
            revokeFirebaseSession
          }
        }
      ]
    });
  });

  afterEach(() => {
    environment.activitiesDataSource = originalActivitiesDataSource;
    TestBed.resetTestingModule();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('stores only the short-lived bootstrap token in session storage', async () => {
    bootstrapSignIn.mockResolvedValue(validBootstrapResponse());
    const service = TestBed.inject(SessionService);

    await expect(service.startAuthSession(emailSignInRequest()))
      .resolves.toEqual({
        kind: 'operator-bootstrap',
        email: installerEmail,
        expiresAt: '2099-07-29T12:00:00Z'
      });

    expect(service.getOperatorBootstrapToken()).toBe('signed-token');
    expect(localStorage.getItem(APP_STORAGE_KEYS.session)).toBeNull();
    expect(sessionStorage.getItem(APP_STORAGE_KEYS.operatorBootstrapToken))
      .toBe('signed-token');
    expect([
      localStorage.getItem(APP_STORAGE_KEYS.session),
      sessionStorage.getItem(APP_STORAGE_KEYS.operatorBootstrapSession),
      sessionStorage.getItem(APP_STORAGE_KEYS.operatorBootstrapToken)
    ].join('|')).not.toContain('installer-password');
    expect(bootstrapSignIn).toHaveBeenCalledWith({
      email: installerEmail,
      password: 'installer-password'
    });
    expect(firebaseSignIn).not.toHaveBeenCalled();
  });

  it('falls through to Firebase only when bootstrap is not applicable', async () => {
    bootstrapSignIn.mockRejectedValue({ status: 404 });
    firebaseSignIn.mockResolvedValue({
      profile: {
        id: 'firebase-user',
        name: 'Firebase User',
        email: installerEmail,
        initials: 'FU'
      }
    });

    await expect(TestBed.inject(SessionService).startAuthSession(emailSignInRequest()))
      .resolves.toMatchObject({ kind: 'firebase' });
    expect(bootstrapSignIn).toHaveBeenCalledWith({
      email: installerEmail,
      password: 'installer-password'
    });
    expect(firebaseSignIn).toHaveBeenCalledWith(emailSignInRequest());
  });

  it.each([
    [401, 'operator.bootstrap.auth.invalid'],
    [429, 'operator.bootstrap.auth.throttled'],
    [500, 'operator.bootstrap.auth.failed']
  ])('does not fall through to Firebase after HTTP %s', async (status, notice) => {
    bootstrapSignIn.mockRejectedValue({ status });
    const service = TestBed.inject(SessionService);

    await expect(service.startAuthSession(emailSignInRequest())).resolves.toBeNull();

    expect(service.firebaseNotice()).toBe(notice);
    expect(firebaseSignIn).not.toHaveBeenCalled();
  });

  it('sends an ordinary email sign-in directly to Firebase without contacting Java', async () => {
    firebaseSignIn.mockResolvedValue({ profile: null });
    const request: FirebaseAuthRequestDto = {
      provider: 'email',
      emailMode: 'sign-in',
      email: 'member@example.test',
      password: 'firebase-password'
    };

    await TestBed.inject(SessionService).startAuthSession(request);

    expect(bootstrapSignIn).not.toHaveBeenCalled();
    expect(firebaseSignIn).toHaveBeenCalledWith(request);
  });

  it('keeps create-account and social-provider requests Firebase-only', async () => {
    firebaseSignIn.mockResolvedValue({ profile: null });
    const service = TestBed.inject(SessionService);
    const createRequest: FirebaseAuthRequestDto = {
      provider: 'email',
      emailMode: 'create',
      email: 'operator@example.test',
      password: 'firebase-password'
    };

    await service.startAuthSession(createRequest);
    await service.startAuthSession({ provider: 'google' });

    expect(bootstrapSignIn).not.toHaveBeenCalled();
    expect(firebaseSignIn).toHaveBeenNthCalledWith(1, createRequest);
    expect(firebaseSignIn).toHaveBeenNthCalledWith(2, { provider: 'google' });
  });

  it('clears an expired restored token without initializing Firebase', async () => {
    sessionStorage.setItem(APP_STORAGE_KEYS.operatorBootstrapSession, JSON.stringify({
      kind: 'operator-bootstrap',
      email: installerEmail,
      expiresAt: '2020-01-01T00:00:00Z'
    }));
    sessionStorage.setItem(APP_STORAGE_KEYS.operatorBootstrapToken, 'expired-token');

    const service = TestBed.inject(SessionService);

    await expect(service.ensureSession()).resolves.toBeNull();
    expect(sessionStorage.getItem(APP_STORAGE_KEYS.operatorBootstrapToken)).toBeNull();
    expect(firebaseRestore).not.toHaveBeenCalled();
  });

  it('keeps a persisted Firebase session while the warmed client is offline', async () => {
    const offline = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    localStorage.setItem(APP_STORAGE_KEYS.session, JSON.stringify({
      kind: 'firebase',
      sessionId: 'session:persisted-offline',
      profile: {
        id: 'firebase-user',
        name: 'Firebase User',
        email: 'firebase@example.com',
        initials: 'FU'
      }
    }));

    try {
      await expect(TestBed.inject(SessionService).ensureSession()).resolves.toMatchObject({
        kind: 'firebase',
        profile: { id: 'firebase-user' }
      });
      expect(firebaseRestore).not.toHaveBeenCalled();
    } finally {
      offline.mockRestore();
    }
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
    expect(revokeFirebaseSession).not.toHaveBeenCalled();
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
    expect(revokeDemoSession).not.toHaveBeenCalled();
  });

  it('clears the bootstrap token on logout', async () => {
    bootstrapSignIn.mockResolvedValue(validBootstrapResponse());
    const service = TestBed.inject(SessionService);
    await service.startAuthSession(emailSignInRequest());

    await service.logout();

    expect(service.currentSession()).toBeNull();
    expect(sessionStorage.getItem(APP_STORAGE_KEYS.operatorBootstrapToken)).toBeNull();
    expect(firebaseSignOut).not.toHaveBeenCalled();
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

function validBootstrapResponse() {
  return {
    tokenType: 'OperatorBootstrap' as const,
    accessToken: 'signed-token',
    email: 'operator-0123456789abcdef01234567@deployment.invalid',
    expiresAt: '2099-07-29T12:00:00Z'
  };
}
