import { Injectable } from '@angular/core';
import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type Auth,
  type User
} from 'firebase/auth';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../core/base/models';

type FirebaseConfigFile = Pick<
  FirebaseOptions,
  'apiKey' | 'authDomain' | 'projectId' | 'storageBucket' | 'messagingSenderId' | 'appId'
> & Partial<Pick<FirebaseOptions, 'measurementId'>>;

@Injectable({
  providedIn: 'root'
})
export class FirebaseAuthService {
  private static readonly FIREBASE_AUTH_PROFILE_KEY = 'firebase-auth-profile';
  private static readonly FIREBASE_CONFIG_PATH = 'keys/firebase.config.json';

  private firebaseAuthPromise: Promise<Auth | null> | null = null;

  get enabled(): boolean {
    return environment.loginEnabled;
  }

  loadStoredProfile(): AppTypes.FirebaseAuthProfile | null {
    if (typeof localStorage === 'undefined') {
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
    const auth = await this.ensureFirebaseAuth();
    if (!auth) {
      return null;
    }
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      return this.persistProfile(result.user);
    } catch {
      return null;
    }
  }

  async restoreSessionProfile(): Promise<AppTypes.FirebaseAuthProfile | null> {
    const auth = await this.ensureFirebaseAuth();
    if (!auth) {
      return this.loadStoredProfile();
    }
    const currentUser = auth.currentUser ?? await this.waitForAuthState(auth);
    if (!currentUser) {
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
    const firebaseConfig = await this.loadFirebaseConfig();
    if (!firebaseConfig) {
      return null;
    }
    const app = this.resolveFirebaseApp(firebaseConfig);
    const auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);
    return auth;
  }

  private resolveFirebaseApp(firebaseConfig: FirebaseConfigFile): FirebaseApp {
    if (getApps().length > 0) {
      return getApp();
    }
    return initializeApp(firebaseConfig);
  }

  private async loadFirebaseConfig(): Promise<FirebaseConfigFile | null> {
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
