import { Injectable } from '@angular/core';
import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  type ActionCodeSettings,
  FacebookAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type User
} from 'firebase/auth';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../core/base/models';
import { APP_STORAGE_KEYS } from '../storage-scope';

export interface FirebaseAuthSignInResult {
  profile: AppTypes.FirebaseAuthProfile | null;
  emailVerificationSent?: boolean;
  email?: string;
  errorMessage?: string;
}

export type FirebaseConfigFile = Pick<
  FirebaseOptions,
  'apiKey' | 'authDomain' | 'projectId' | 'storageBucket' | 'messagingSenderId' | 'appId'
> & Partial<Pick<FirebaseOptions, 'measurementId'>> & {
  vapidKey?: string;
};

@Injectable({
  providedIn: 'root'
})
export class FirebaseAuthService {
  private static readonly FIREBASE_AUTH_PROFILE_KEY = APP_STORAGE_KEYS.firebaseAuthProfile;
  private static readonly FIREBASE_CONFIG_PATH = 'keys/firebase.config.json';

  private firebaseAuthPromise: Promise<Auth | null> | null = null;
  private firebaseAppPromise: Promise<FirebaseApp | null> | null = null;

  get enabled(): boolean {
    return environment.firebaseLoginEnabled;
  }

  loadStoredProfile(): AppTypes.FirebaseAuthProfile | null {
    if (!this.enabled || typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(FirebaseAuthService.FIREBASE_AUTH_PROFILE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<AppTypes.FirebaseAuthProfile>;
      if (!parsed.id || !parsed.name || !parsed.email || !parsed.initials) {
        return null;
      }
      return {
        id: parsed.id,
        name: parsed.name,
        email: parsed.email,
        initials: parsed.initials
      };
    } catch {
      return null;
    }
  }

  async signInWithGoogle(): Promise<AppTypes.FirebaseAuthProfile | null> {
    return (await this.signIn({ provider: 'google' })).profile;
  }

  async signIn(request: AppTypes.FirebaseAuthRequest): Promise<FirebaseAuthSignInResult> {
    const auth = await this.ensureFirebaseAuth();
    if (!auth) {
      return { profile: null };
    }
    try {
      const result = await this.runAuthRequest(auth, request);
      if (result.emailVerificationSent) {
        this.clearStoredProfile();
        return {
          profile: null,
          emailVerificationSent: true,
          email: result.user.email?.trim() || request.email?.trim()
        };
      }
      return { profile: this.persistProfile(result.user) };
    } catch (error) {
      return {
        profile: null,
        errorMessage: this.firebaseAuthErrorMessage(error)
      };
    }
  }

  async restoreSessionProfile(): Promise<AppTypes.FirebaseAuthProfile | null> {
    if (!this.enabled) {
      return null;
    }
    const auth = await this.ensureFirebaseAuth();
    if (!auth) {
      return this.loadStoredProfile();
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
    this.clearStoredProfile();
    const auth = await this.ensureFirebaseAuth();
    if (!auth) {
      return;
    }
    try {
      await signOut(auth);
    } catch {
      // Keep logout resilient even if Firebase session teardown fails locally.
    }
  }

  async ensureFirebaseApp(): Promise<FirebaseApp | null> {
    if (typeof window === 'undefined') {
      return null;
    }
    if (!this.firebaseAppPromise) {
      this.firebaseAppPromise = this.initializeFirebaseApp();
    }
    return this.firebaseAppPromise;
  }

  private async ensureFirebaseAuth(): Promise<Auth | null> {
    if (!this.enabled || typeof window === 'undefined') {
      return null;
    }
    if (!this.firebaseAuthPromise) {
      this.firebaseAuthPromise = this.initializeFirebaseAuth();
    }
    return this.firebaseAuthPromise;
  }

  private async initializeFirebaseAuth(): Promise<Auth | null> {
    const app = await this.ensureFirebaseApp();
    if (!app) {
      return null;
    }
    const auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);
    return auth;
  }

  private async initializeFirebaseApp(): Promise<FirebaseApp | null> {
    const firebaseConfig = await this.loadFirebaseConfig();
    if (!firebaseConfig) {
      return null;
    }
    return this.resolveFirebaseApp(firebaseConfig);
  }

  private resolveFirebaseApp(firebaseConfig: FirebaseConfigFile): FirebaseApp {
    if (getApps().length > 0) {
      return getApp();
    }
    return initializeApp(firebaseConfig);
  }

  async loadFirebaseConfig(): Promise<FirebaseConfigFile | null> {
    if (typeof document === 'undefined') {
      return null;
    }
    const configUrl = new URL(FirebaseAuthService.FIREBASE_CONFIG_PATH, document.baseURI).toString();
    try {
      const response = await fetch(configUrl, { cache: 'no-store' });
      if (!response.ok) {
        return null;
      }
      const parsed = await response.json() as Partial<FirebaseConfigFile>;
      if (!this.isFirebaseConfigFile(parsed)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private isFirebaseConfigFile(value: Partial<FirebaseConfigFile>): value is FirebaseConfigFile {
    return (
      typeof value.apiKey === 'string' &&
      value.apiKey.trim().length > 0 &&
      typeof value.authDomain === 'string' &&
      value.authDomain.trim().length > 0 &&
      typeof value.projectId === 'string' &&
      value.projectId.trim().length > 0 &&
      typeof value.storageBucket === 'string' &&
      value.storageBucket.trim().length > 0 &&
      typeof value.messagingSenderId === 'string' &&
      value.messagingSenderId.trim().length > 0 &&
      typeof value.appId === 'string' &&
      value.appId.trim().length > 0 &&
      (value.measurementId === undefined || typeof value.measurementId === 'string')
    );
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

  private persistProfile(user: User): AppTypes.FirebaseAuthProfile {
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

  private toFirebaseAuthProfile(user: User): AppTypes.FirebaseAuthProfile {
    const fallbackName = user.displayName?.trim() || user.email?.trim() || 'Firebase User';
    return {
      id: user.uid,
      name: fallbackName,
      email: user.email?.trim() || `${user.uid}@firebase.local`,
      initials: this.initialsFromText(fallbackName)
    };
  }

  private async runAuthRequest(auth: Auth, request: AppTypes.FirebaseAuthRequest): Promise<{ user: User; emailVerificationSent?: boolean }> {
    if (request.provider === 'facebook') {
      const provider = new FacebookAuthProvider();
      provider.addScope('email');
      provider.setCustomParameters({ display: 'popup' });
      return signInWithPopup(auth, provider);
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
    return signInWithPopup(auth, provider);
  }

  private async runEmailAuthRequest(
    auth: Auth,
    email: string,
    password: string,
    mode?: AppTypes.FirebaseEmailAuthMode
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

  private async signInOrCreateEmailUser(auth: Auth, email: string, password: string): Promise<{ user: User }> {
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
        return 'Email login is not enabled in Firebase.';
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
