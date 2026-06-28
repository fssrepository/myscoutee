import { Injectable } from '@angular/core';
import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';

export type FirebaseConfigFile = Pick<
  FirebaseOptions,
  'apiKey' | 'authDomain' | 'projectId' | 'storageBucket' | 'messagingSenderId' | 'appId'
> & Partial<Pick<FirebaseOptions, 'measurementId'>> & {
  vapidKey?: string;
};

@Injectable({
  providedIn: 'root'
})
export class FirebaseAppService {
  private static readonly FIREBASE_CONFIG_PATH = 'keys/firebase.config.json';

  private firebaseAppPromise: Promise<FirebaseApp | null> | null = null;

  async ensureFirebaseApp(): Promise<FirebaseApp | null> {
    if (typeof window === 'undefined') {
      return null;
    }
    if (!this.firebaseAppPromise) {
      this.firebaseAppPromise = this.initializeFirebaseApp();
    }
    return this.firebaseAppPromise;
  }

  async loadFirebaseConfig(): Promise<FirebaseConfigFile | null> {
    if (typeof document === 'undefined') {
      return null;
    }
    const configUrl = new URL(FirebaseAppService.FIREBASE_CONFIG_PATH, document.baseURI).toString();
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

  private async initializeFirebaseApp(): Promise<FirebaseApp | null> {
    const firebaseConfig = await this.loadFirebaseConfig();
    if (!firebaseConfig) {
      return null;
    }
    if (getApps().length > 0) {
      return getApp();
    }
    return initializeApp(firebaseConfig);
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
}
