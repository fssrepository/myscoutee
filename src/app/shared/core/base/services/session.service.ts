import { Injectable, computed, inject, signal } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../core/base/models';
import { FirebaseAuthService } from './firebase-auth.service';

export type AppSession =
  | { kind: 'demo'; userId: string }
  | { kind: 'firebase'; profile: AppTypes.FirebaseAuthProfile };

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private static readonly SESSION_STORAGE_KEY = 'app-session';
  private static readonly DEMO_ACTIVE_USER_KEY = 'demo-active-user';

  private readonly firebaseAuthService = inject(FirebaseAuthService);
  private readonly sessionRef = signal<AppSession | null>(this.loadStoredSession());
  private readonly firebaseBusyRef = signal(false);

  readonly session = this.sessionRef.asReadonly();
  readonly firebaseBusy = this.firebaseBusyRef.asReadonly();
  readonly firebaseProfile = computed(() => {
    const current = this.sessionRef();
    return current?.kind === 'firebase' ? current.profile : null;
  });
  readonly authMode: AppTypes.AuthMode = environment.loginEnabled ? 'firebase' : 'selector';

  currentSession(): AppSession | null {
    return this.sessionRef();
  }

  async ensureSession(): Promise<AppSession | null> {
    const current = this.sessionRef();
    if (!current) {
      return null;
    }
    if (current.kind === 'demo') {
      return current;
    }
    const restoredProfile = await this.firebaseAuthService.restoreSessionProfile();
    if (!restoredProfile) {
      this.clearStoredSession();
      return null;
    }
    const nextSession: AppSession = {
      kind: 'firebase',
      profile: restoredProfile
    };
    this.persistSession(nextSession);
    return nextSession;
  }

  startDemoSession(userId: string): AppSession | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const session: AppSession = {
      kind: 'demo',
      userId: normalizedUserId
    };
    localStorage.setItem(SessionService.DEMO_ACTIVE_USER_KEY, normalizedUserId);
    this.persistSession(session);
    return session;
  }

  async startFirebaseSession(): Promise<AppSession | null> {
    if (this.firebaseBusyRef()) {
      return null;
    }
    this.firebaseBusyRef.set(true);
    try {
      const profile = await this.firebaseAuthService.signInWithGoogle();
      if (!profile) {
        return null;
      }
      localStorage.removeItem(SessionService.DEMO_ACTIVE_USER_KEY);
      const session: AppSession = {
        kind: 'firebase',
        profile
      };
      this.persistSession(session);
      return session;
    } finally {
      this.firebaseBusyRef.set(false);
    }
  }

  async restoreFirebaseSession(): Promise<AppSession | null> {
    if (this.firebaseBusyRef()) {
      return this.sessionRef();
    }
    this.firebaseBusyRef.set(true);
    try {
      const profile = await this.firebaseAuthService.restoreSessionProfile();
      if (!profile) {
        this.clearStoredSession();
        return null;
      }
      const session: AppSession = {
        kind: 'firebase',
        profile
      };
      this.persistSession(session);
      return session;
    } finally {
      this.firebaseBusyRef.set(false);
    }
  }

  async logout(): Promise<void> {
    const current = this.sessionRef();
    this.clearStoredSession();
    localStorage.removeItem(SessionService.DEMO_ACTIVE_USER_KEY);
    if (current?.kind === 'firebase') {
      await this.firebaseAuthService.signOut();
    }
  }

  private persistSession(session: AppSession): void {
    this.sessionRef.set(session);
    localStorage.setItem(SessionService.SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  private clearStoredSession(): void {
    this.sessionRef.set(null);
    localStorage.removeItem(SessionService.SESSION_STORAGE_KEY);
  }

  private loadStoredSession(): AppSession | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(SessionService.SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<AppSession>;
      if (parsed.kind === 'demo' && typeof parsed.userId === 'string' && parsed.userId.trim().length > 0) {
        return {
          kind: 'demo',
          userId: parsed.userId.trim()
        };
      }
      if (
        parsed.kind === 'firebase' &&
        parsed.profile &&
        typeof parsed.profile.id === 'string' &&
        typeof parsed.profile.name === 'string' &&
        typeof parsed.profile.email === 'string' &&
        typeof parsed.profile.initials === 'string'
      ) {
        return {
          kind: 'firebase',
          profile: {
            id: parsed.profile.id,
            name: parsed.profile.name,
            email: parsed.profile.email,
            initials: parsed.profile.initials
          }
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}
