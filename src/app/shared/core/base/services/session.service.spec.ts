import { TestBed } from '@angular/core/testing';

import { APP_STORAGE_KEYS } from '../../common/storage-scope';
import type { FirebaseAuthRequestDto } from '../../contracts/user.interface';
import { HttpOperatorBootstrapAuthService } from '../../http/services/operator-bootstrap-auth.service';
import { FirebaseAuthService } from './firebase-auth.service';
import { SessionService } from './session.service';

describe('SessionService operator bootstrap session', () => {
  const installerEmail =
    'operator-0123456789abcdef01234567@deployment.invalid';
  const bootstrapSignIn = vi.fn();
  const firebaseSignIn = vi.fn();
  const firebaseRestore = vi.fn();
  const firebaseSignOut = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    bootstrapSignIn.mockReset();
    firebaseSignIn.mockReset();
    firebaseRestore.mockReset().mockResolvedValue(null);
    firebaseSignOut.mockReset().mockResolvedValue(undefined);
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
            getIdToken: vi.fn()
          }
        }
      ]
    });
  });

  afterEach(() => {
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
