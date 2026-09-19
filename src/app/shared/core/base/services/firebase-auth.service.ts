import { Injectable, inject } from '@angular/core';
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  initializeAuth,
  linkWithCredential,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type ActionCodeSettings,
  type Auth,
  type OAuthCredential,
  type User
} from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';
import type { FirebaseError } from 'firebase/app';

import type {
  FirebaseAuthProfileDto,
  FirebaseAuthRequestDto,
  FirebaseEmailAuthMode
} from '../../contracts/user.interface';
import { APP_STORAGE_KEYS } from '../../common/storage-scope';
import { isFirebaseLoginEnabled } from '../../common/firebase-login-mode';
import { FirebaseAppService } from './firebase-app.service';

export interface FirebaseAuthSignInResult {
  profile: FirebaseAuthProfileDto | null;
  emailVerificationSent?: boolean;
  email?: string;
  errorMessage?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseAuthService {
  private static readonly FIREBASE_AUTH_PROFILE_KEY = APP_STORAGE_KEYS.firebaseAuthProfile;

  private readonly firebaseAppService = inject(FirebaseAppService);
  private firebaseAuthPromise: Promise<Auth | null> | null = null;
  private firebaseAuthApp: FirebaseApp | null = null;
  // OAuth credentials live only in memory, scoped to this Firebase Auth instance.
  private pendingLink: { auth: Auth; email: string; credential: OAuthCredential; expiresAt: number } | null = null;

  cancelAccountLink(): void {
    this.pendingLink = null;
  }

  get enabled(): boolean {
    return isFirebaseLoginEnabled();
  }

  loadStoredProfile(): FirebaseAuthProfileDto | null {
    if (!this.enabled || typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(FirebaseAuthService.FIREBASE_AUTH_PROFILE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<FirebaseAuthProfileDto>;
      if (!parsed.id || !parsed.name || !parsed.email || !parsed.initials) {
        return null;
      }
      return {
        id: parsed.id,
        name: parsed.name,
        email: parsed.email,
        initials: parsed.initials,
        imageUrl: typeof parsed.imageUrl === 'string' ? parsed.imageUrl : undefined
      };
    } catch {
      return null;
    }
  }

  async signInWithGoogle(): Promise<FirebaseAuthProfileDto | null> {
    return (await this.signIn({ provider: 'google' })).profile;
  }

  async signIn(request: FirebaseAuthRequestDto): Promise<FirebaseAuthSignInResult> {
    const auth = await this.ensureFirebaseAuth();
    if (!auth) {
      return { profile: null };
    }
    try {
      const pending = this.pendingLink;
      if (pending && (pending.auth !== auth || pending.expiresAt <= Date.now())) {
        this.cancelAccountLink();
        return { profile: null, errorMessage: 'firebase.auth.link.expired' };
      }
      if (pending && ((request.provider === 'email' && request.emailMode !== 'sign-in')
        || `${request.provider}.com` === pending.credential.providerId)) {
        return { profile: null, errorMessage: 'firebase.auth.link.required' };
      }
      const result = await this.runAuthRequest(auth, request);
      if (pending && this.normalizeEmail(result.user.email) !== pending.email) {
        await firebaseSignOut(auth);
        this.clearStoredProfile();
        return { profile: null, errorMessage: 'firebase.auth.link.email.mismatch' };
      }
      if (result.emailVerificationSent) {
        this.clearStoredProfile();
        return {
          profile: null,
          emailVerificationSent: true,
          email: result.user.email?.trim() || request.email?.trim()
        };
      }
      if (pending) {
        try {
          await linkWithCredential(result.user, pending.credential);
          // The backend must receive the newly linked provider claims.
          await result.user.getIdToken(true);
          this.cancelAccountLink();
        } catch (error) {
          this.cancelAccountLink();
          this.clearStoredProfile();
          await firebaseSignOut(auth);
          return { profile: null, errorMessage: 'firebase.auth.link.failed' };
        }
      }
      return { profile: this.persistProfile(result.user) };
    } catch (error) {
      if (this.firebaseErrorCode(error) === 'auth/account-exists-with-different-credential') {
        // Keep the original provider proof if the user selects another conflicting provider.
        if (!this.pendingLink) {
          const credential = request.provider === 'facebook'
            ? FacebookAuthProvider.credentialFromError(error as FirebaseError)
            : request.provider === 'google'
              ? GoogleAuthProvider.credentialFromError(error as FirebaseError) : null;
          const email = this.normalizeEmail((error as FirebaseError & { customData?: { email?: string } }).customData?.email);
          if (credential && email) {
            this.pendingLink = { auth, email, credential, expiresAt: Date.now() + 5 * 60_000 };
          }
        }
        this.clearStoredProfile();
        return { profile: null, errorMessage: this.pendingLink
          ? 'firebase.auth.link.required' : 'firebase.auth.link.failed' };
      }
      return {
        profile: null,
        errorMessage: this.firebaseAuthErrorMessage(error)
      };
    }
  }

  async restoreSessionProfile(): Promise<FirebaseAuthProfileDto | null> {
    if (!this.enabled) {
      return null;
    }
    const auth = await this.ensureFirebaseAuth();
    if (!auth) {
      /*
       * A profile snapshot is not authentication. If the currently activated
       * deployment Firebase runtime cannot be resolved, fail closed instead
       * of reviving a session from another or superseded revision.
       */
      this.clearStoredProfile();
      return null;
    }
    if (this.pendingLink) {
      return null;
    }
    const currentUser = auth.currentUser ?? await this.waitForAuthState(auth);
    if (!currentUser) {
      this.clearStoredProfile();
      return null;
    }
    await currentUser.reload();
    if (this.needsEmailVerification(currentUser)) {
      this.clearStoredProfile();
      return null;
    }
    return this.persistProfile(currentUser);
  }

  async getIdToken(): Promise<string | null> {
    const auth = await this.ensureFirebaseAuth();
    if (!auth) {
      return null;
    }
    if (this.pendingLink) {
      return null;
    }
    const currentUser = auth.currentUser ?? await this.waitForAuthState(auth);
    if (!currentUser) {
      return null;
    }
    try {
      return await currentUser.getIdToken();
    } catch {
      return null;
    }
  }

  async signOut(): Promise<void> {
    this.cancelAccountLink();
    this.clearStoredProfile();
    const auth = await this.ensureFirebaseAuth();
    if (!auth) {
      return;
    }
    try {
      await firebaseSignOut(auth);
    } catch {
      // Keep logout resilient even if Firebase session teardown fails locally.
    }
  }

  private async ensureFirebaseAuth(): Promise<Auth | null> {
    if (!this.enabled || typeof window === 'undefined') {
      return null;
    }
    const app = await this.firebaseAppService.ensureFirebaseApp();
    if (!app) {
      this.cancelAccountLink();
      this.firebaseAuthApp = null;
      this.firebaseAuthPromise = null;
      return null;
    }
    if (!this.firebaseAuthPromise || this.firebaseAuthApp !== app) {
      this.cancelAccountLink();
      this.firebaseAuthApp = app;
      this.firebaseAuthPromise = this.initializeFirebaseAuth(app);
    }
    const initialization = this.firebaseAuthPromise;
    try {
      return await initialization;
    } catch {
      if (this.firebaseAuthPromise === initialization) {
        this.firebaseAuthApp = null;
        this.firebaseAuthPromise = null;
      }
      return null;
    }
  }

  private async initializeFirebaseAuth(app: FirebaseApp): Promise<Auth> {
    // This application uses popup sign-in, not redirect sign-in. Installing the
    // default resolver here makes mobile Firebase load GAPI and its hidden iframe
    // before restoring an existing session. Load it only for an explicit login.
    const auth = initializeAuth(app, { persistence: browserLocalPersistence });
    await auth.authStateReady();
    return auth;
  }

  private async waitForAuthState(auth: Auth): Promise<User | null> {
    if (auth.currentUser) {
      return auth.currentUser;
    }
    return new Promise<User | null>(resolve => {
      const unsubscribe = onAuthStateChanged(
        auth,
        user => {
          unsubscribe();
          resolve(user);
        },
        () => {
          unsubscribe();
          resolve(null);
        }
      );
    });
  }

  private persistProfile(user: User): FirebaseAuthProfileDto {
    const profile = this.toFirebaseAuthProfile(user);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FirebaseAuthService.FIREBASE_AUTH_PROFILE_KEY, JSON.stringify(profile));
    }
    return profile;
  }

  private clearStoredProfile(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.removeItem(FirebaseAuthService.FIREBASE_AUTH_PROFILE_KEY);
  }

  private toFirebaseAuthProfile(user: User): FirebaseAuthProfileDto {
    const fallbackName = user.displayName?.trim() || user.email?.trim() || 'Firebase User';
    return {
      id: user.uid,
      name: fallbackName,
      email: user.email?.trim() || `${user.uid}@firebase.local`,
      initials: this.initialsFromText(fallbackName),
      imageUrl: user.photoURL?.trim() || undefined
    };
  }

  private async runAuthRequest(auth: Auth, request: FirebaseAuthRequestDto): Promise<{ user: User; emailVerificationSent?: boolean }> {
    if (request.provider === 'facebook') {
      const provider = new FacebookAuthProvider();
      provider.addScope('email');
      provider.setCustomParameters({ display: 'popup' });
      return signInWithPopup(auth, provider, browserPopupRedirectResolver);
    }
    if (request.provider === 'email') {
      const email = `${request.email ?? ''}`.trim();
      const password = `${request.password ?? ''}`;
      const credential = await this.runEmailAuthRequest(auth, email, password, request.emailMode);
      await credential.user.reload();
      if (this.needsEmailVerification(credential.user)) {
        await sendEmailVerification(credential.user, this.emailVerificationActionCodeSettings());
        return {
          user: credential.user,
          emailVerificationSent: true
        };
      }
      return credential;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return signInWithPopup(auth, provider, browserPopupRedirectResolver);
  }

  private async runEmailAuthRequest(
    auth: Auth,
    email: string,
    password: string,
    mode?: FirebaseEmailAuthMode
  ): Promise<{ user: User }> {
    if (mode === 'sign-in') {
      return signInWithEmailAndPassword(auth, email, password);
    }
    if (mode === 'create') {
      return createUserWithEmailAndPassword(auth, email, password);
    }
    return this.signInOrCreateEmailUser(auth, email, password);
  }

  private needsEmailVerification(user: User): boolean {
    return !user.emailVerified && user.providerData.some(provider => provider.providerId === 'password');
  }

  private emailVerificationActionCodeSettings(): ActionCodeSettings {
    const url = new URL('/entry', document.baseURI);
    url.searchParams.set('onboarding', '1');
    return {
      url: url.toString(),
      handleCodeInApp: false
    };
  }

  private async signInOrCreateEmailUser(
    auth: Auth,
    email: string,
    password: string
  ): Promise<{ user: User }> {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (signInError) {
      if (!this.shouldCreateEmailUserAfterSignInFailure(signInError)) {
        throw signInError;
      }
      try {
        return await createUserWithEmailAndPassword(auth, email, password);
      } catch (createError) {
        if (this.firebaseErrorCode(createError) === 'auth/email-already-in-use') {
          throw signInError;
        }
        throw createError;
      }
    }
  }

  private shouldCreateEmailUserAfterSignInFailure(error: unknown): boolean {
    return new Set([
      'auth/user-not-found',
      'auth/invalid-credential',
      'auth/wrong-password'
    ]).has(this.firebaseErrorCode(error));
  }

  private normalizeEmail(email: string | null | undefined): string {
    return `${email ?? ''}`.trim().toLowerCase();
  }

  private firebaseErrorCode(error: unknown): string {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return '';
    }
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code.trim() : '';
  }

  private firebaseAuthErrorMessage(error: unknown): string {
    switch (this.firebaseErrorCode(error)) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Use login instead.';
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Email or password is incorrect.';
      case 'auth/operation-not-allowed':
        return 'firebase.auth.provider.disabled';
      case 'auth/too-many-requests':
        return 'Too many login attempts. Try again later.';
      case 'auth/unauthorized-continue-uri':
        return 'Firebase does not allow this verification redirect domain.';
      default: {
        const code = this.firebaseErrorCode(error);
        return code ? `Firebase login failed (${code}).` : 'Firebase login failed.';
      }
    }
  }

  private initialsFromText(value: string): string {
    const words = value
      .split(/\s+/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
    if (words.length === 0) {
      return 'U';
    }
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
  }
}
