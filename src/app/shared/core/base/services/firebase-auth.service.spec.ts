import { TestBed } from '@angular/core/testing';
import { FacebookAuthProvider, GoogleAuthProvider, browserLocalPersistence, browserPopupRedirectResolver, initializeAuth, linkWithCredential, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  type Auth, type User, type UserCredential } from 'firebase/auth';
import { FirebaseAppService } from './firebase-app.service';
import { FirebaseAuthService } from './firebase-auth.service';

vi.mock('firebase/auth', async importOriginal => Object.assign(
  {}, await importOriginal<typeof import('firebase/auth')>(), {
  initializeAuth: vi.fn(), linkWithCredential: vi.fn(), signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(), createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(), sendEmailVerification: vi.fn()
}));

describe('FirebaseAuthService provider linking', () => {
  let service: FirebaseAuthService;
  let auth: Auth;
  let user: User;
  const facebookCredential = FacebookAuthProvider.credential('disposable-test-token');
  const googleCredential = GoogleAuthProvider.credential('disposable-test-token');

  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [
      FirebaseAuthService, { provide: FirebaseAppService, useValue: {} }
    ] });
    service = TestBed.inject(FirebaseAuthService);
    auth = {} as Auth;
    user = { uid: 'existing-user', email: 'person@example.test', emailVerified: true,
      displayName: 'Test User', providerData: [], reload: vi.fn().mockResolvedValue(undefined),
      getIdToken: vi.fn().mockResolvedValue('fresh-token') } as unknown as User;
    vi.spyOn(service as unknown as { ensureFirebaseAuth(): Promise<Auth> }, 'ensureFirebaseAuth').mockResolvedValue(auth);
    vi.spyOn(FacebookAuthProvider, 'credentialFromError').mockReturnValue(facebookCredential);
    vi.spyOn(GoogleAuthProvider, 'credentialFromError').mockReturnValue(googleCredential);
    vi.mocked(signOut).mockResolvedValue();
    vi.mocked(linkWithCredential).mockResolvedValue({ user } as UserCredential);
  });

  afterEach(() => { vi.restoreAllMocks(); TestBed.resetTestingModule(); localStorage.clear(); });

  async function conflict(provider: 'facebook' | 'google' = 'facebook') {
    vi.mocked(signInWithPopup).mockRejectedValueOnce({
      code: 'auth/account-exists-with-different-credential', customData: { email: ' Person@Example.Test ' }
    });
    const result = await service.signIn({ provider });
    expect(result).toEqual({ profile: null, errorMessage: 'firebase.auth.link.required' });
    expect(linkWithCredential).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  }

  it('signs in an already linked social account directly', async () => {
    vi.mocked(signInWithPopup).mockResolvedValueOnce({ user } as UserCredential);
    expect((await service.signIn({ provider: 'google' })).profile?.id).toBe('existing-user');
    expect(linkWithCredential).not.toHaveBeenCalled();
    expect(signInWithPopup).toHaveBeenCalledWith(auth, expect.any(GoogleAuthProvider), browserPopupRedirectResolver);
  });

  it('links Facebook after a fresh Google sign-in and refreshes backend claims', async () => {
    await conflict();
    vi.mocked(signInWithPopup).mockResolvedValueOnce({ user } as UserCredential);
    const result = await service.signIn({ provider: 'google' });
    expect(linkWithCredential).toHaveBeenCalledWith(user, facebookCredential);
    expect(user.getIdToken).toHaveBeenCalledWith(true);
    expect(result.profile?.id).toBe('existing-user');
    expect(JSON.stringify(localStorage)).not.toContain('disposable-test-token');
    vi.mocked(signInWithPopup).mockResolvedValueOnce({ user } as UserCredential);
    await service.signIn({ provider: 'facebook' });
    expect(linkWithCredential).toHaveBeenCalledTimes(1);
  });

  it('links Google after Facebook authenticates the existing account', async () => {
    await conflict('google');
    vi.mocked(signInWithPopup).mockResolvedValueOnce({ user } as UserCredential);
    expect((await service.signIn({ provider: 'facebook' })).profile?.id).toBe('existing-user');
    expect(linkWithCredential).toHaveBeenCalledWith(user, googleCredential);
  });

  it('links to an existing password account after a correct password', async () => {
    await conflict();
    vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({ user } as UserCredential);
    expect((await service.signIn({ provider: 'email', emailMode: 'sign-in', email: user.email!, password: 'correct' })).profile?.id).toBe('existing-user');
    expect(linkWithCredential).toHaveBeenCalledWith(user, facebookCredential);
  });

  it('does not link or create an account after an incorrect password; allows retry', async () => {
    await conflict();
    vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce({ code: 'auth/wrong-password' });
    expect((await service.signIn({ provider: 'email', emailMode: 'sign-in', email: user.email!, password: 'wrong' })).errorMessage).toBe('Email or password is incorrect.');
    expect(linkWithCredential).not.toHaveBeenCalled();
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({ user } as UserCredential);
    expect((await service.signIn({ provider: 'email', emailMode: 'sign-in', email: user.email!, password: 'correct' })).profile?.id).toBe('existing-user');
  });

  it('refuses a different email account and signs out without linking', async () => {
    await conflict();
    vi.mocked(signInWithPopup).mockResolvedValueOnce({ user: { ...user, email: 'someone-else@example.test' } } as UserCredential);
    expect((await service.signIn({ provider: 'google' })).errorMessage).toBe('firebase.auth.link.email.mismatch');
    expect(linkWithCredential).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith(auth);
    expect(localStorage.length).toBe(0);
  });

  it('never turns registration into account linking', async () => {
    await conflict();
    expect((await service.signIn({ provider: 'email', emailMode: 'create', email: user.email!, password: 'correct' })).errorMessage).toBe('firebase.auth.link.required');
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('preserves the normal duplicate-registration error', async () => {
    vi.mocked(createUserWithEmailAndPassword).mockRejectedValueOnce({ code: 'auth/email-already-in-use' });
    expect((await service.signIn({ provider: 'email', emailMode: 'create', email: user.email!, password: 'correct' })).errorMessage).toBe('This email is already registered. Use login instead.');
    expect(linkWithCredential).not.toHaveBeenCalled();
  });

  it('keeps pending proof for retry after the provider popup is cancelled', async () => {
    await conflict();
    vi.mocked(signInWithPopup).mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    expect((await service.signIn({ provider: 'google' })).profile).toBeNull();
    vi.mocked(signInWithPopup).mockResolvedValueOnce({ user } as UserCredential);
    await service.signIn({ provider: 'google' });
    expect(linkWithCredential).toHaveBeenCalledWith(user, facebookCredential);
  });

  it('clears pending proof when the login dialog is cancelled', async () => {
    await conflict();
    service.cancelAccountLink();
    vi.mocked(signInWithPopup).mockResolvedValueOnce({ user } as UserCredential);
    await service.signIn({ provider: 'google' });
    expect(linkWithCredential).not.toHaveBeenCalled();
  });

  it('expires pending proof before another provider can be contacted', async () => {
    await conflict();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60_000);
    expect((await service.signIn({ provider: 'google' })).errorMessage).toBe('firebase.auth.link.expired');
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
  });

  it('does not link a verified provider to an unverified password login', async () => {
    await conflict();
    const unverified = { ...user, emailVerified: false, providerData: [{ providerId: 'password' }] } as User;
    vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({ user: unverified } as UserCredential);
    const result = await service.signIn({ provider: 'email', emailMode: 'sign-in', email: user.email!, password: 'correct' });
    expect(result.emailVerificationSent).toBe(true);
    expect(linkWithCredential).not.toHaveBeenCalled();
    expect(await service.getIdToken()).toBeNull();
  });

  it('fails closed and signs out if Firebase refuses linking', async () => {
    await conflict();
    vi.mocked(signInWithPopup).mockResolvedValueOnce({ user } as UserCredential);
    vi.mocked(linkWithCredential).mockRejectedValueOnce({ code: 'auth/credential-already-in-use' });
    expect((await service.signIn({ provider: 'google' })).errorMessage).toBe('firebase.auth.link.failed');
    expect(signOut).toHaveBeenCalledWith(auth);
    expect(localStorage.length).toBe(0);
  });

  it('requires an existing-provider action instead of repeating the conflicting button', async () => {
    await conflict();
    expect((await service.signIn({ provider: 'facebook' })).errorMessage).toBe('firebase.auth.link.required');
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
  });
});


describe('FirebaseAuthService startup', () => {
  let service: FirebaseAuthService;
  let auth: Auth;
  let user: User;
  const app = {};
  const ensureFirebaseApp = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    user = { uid: 'restored-user', email: 'person@example.test', emailVerified: true,
      displayName: 'Test User', providerData: [], reload: vi.fn().mockResolvedValue(undefined),
      getIdToken: vi.fn().mockResolvedValue('session-token') } as unknown as User;
    auth = { currentUser: user, authStateReady: vi.fn().mockResolvedValue(undefined) } as unknown as Auth;
    vi.mocked(initializeAuth).mockReturnValue(auth);
    ensureFirebaseApp.mockResolvedValue(app);
    TestBed.configureTestingModule({ providers: [FirebaseAuthService,
      { provide: FirebaseAppService, useValue: { ensureFirebaseApp } }
    ] });
    service = TestBed.inject(FirebaseAuthService);
    vi.spyOn(service, 'enabled', 'get').mockReturnValue(true);
  });

  afterEach(() => { vi.restoreAllMocks(); TestBed.resetTestingModule(); localStorage.clear(); });

  it('initializes directly with local persistence and no proactive popup resolver', async () => {
    expect((await service.restoreSessionProfile())?.id).toBe('restored-user');
    expect(initializeAuth).toHaveBeenCalledWith(app, { persistence: browserLocalPersistence });
    expect(auth.authStateReady).toHaveBeenCalledOnce();
    // Keep explicit validation: Firebase itself tolerates a network error during startup.
    expect(user.reload).toHaveBeenCalledOnce();
  });

  it('shares initialization and waits for persisted auth before serving tokens', async () => {
    let ready!: () => void;
    vi.mocked(auth.authStateReady).mockImplementation(() => new Promise<void>(resolve => { ready = resolve; }));
    const first = service.getIdToken();
    const second = service.getIdToken();
    await vi.waitFor(() => expect(auth.authStateReady).toHaveBeenCalledOnce());
    expect(user.getIdToken).not.toHaveBeenCalled();
    ready();
    expect(await Promise.all([first, second])).toEqual(['session-token', 'session-token']);
    expect(initializeAuth).toHaveBeenCalledOnce();
  });

  it('fails closed when initialization fails, then allows another attempt', async () => {
    vi.mocked(auth.authStateReady).mockRejectedValueOnce(new Error('unavailable'));
    expect(await service.restoreSessionProfile()).toBeNull();
    expect(localStorage.length).toBe(0);
    expect((await service.restoreSessionProfile())?.id).toBe('restored-user');
    expect(initializeAuth).toHaveBeenCalledTimes(2);
  });

  it('does not revive a profile without the configured Firebase app', async () => {
    ensureFirebaseApp.mockResolvedValue(null);
    expect(await service.restoreSessionProfile()).toBeNull();
    expect(initializeAuth).not.toHaveBeenCalled();
  });

  it('keeps verification and explicit refresh on subsequent restorations', async () => {
    await service.restoreSessionProfile();
    Object.assign(user, { emailVerified: false, providerData: [{ providerId: 'password' }] });
    expect(await service.restoreSessionProfile()).toBeNull();
    expect(user.reload).toHaveBeenCalledTimes(2);
    expect(localStorage.length).toBe(0);
  });

  it('does not accept a cached profile when explicit server validation fails', async () => {
    vi.mocked(user.reload).mockRejectedValue(new Error('network unavailable'));
    await expect(service.restoreSessionProfile()).rejects.toThrow('network unavailable');
    expect(localStorage.length).toBe(0);
  });
});
