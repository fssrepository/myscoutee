import { Injectable, computed, inject, signal } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { FirebaseAuthProfileDto, FirebaseAuthRequestDto } from '../../contracts/user.interface';
import type { AuthMode } from '../../common/constants';
import { AppContext } from '../context';
import { APP_STORAGE_KEYS } from '../../common/storage-scope';
import { FirebaseAuthService } from './firebase-auth.service';

export interface SupportSessionContext {
  kind: 'admin-support';
  targetUrl?: string;
}

export type AppSession =
  | { kind: 'demo'; userId: string; supportContext?: SupportSessionContext }
  | { kind: 'firebase'; profile: FirebaseAuthProfileDto };

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private static readonly SESSION_STORAGE_KEY = APP_STORAGE_KEYS.session;
  private static readonly DEMO_ACTIVE_USER_KEY = APP_STORAGE_KEYS.demoActiveUser;

  private readonly firebaseAuthService = inject(FirebaseAuthService);
  private readonly appCtx = inject(AppContext);
  private readonly sessionRef = signal<AppSession | null>(this.loadStoredSession());
  private readonly firebaseBusyRef = signal(false);
  private readonly firebaseNoticeRef = signal('');

  readonly session = this.sessionRef.asReadonly();
  readonly firebaseBusy = this.firebaseBusyRef.asReadonly();
  readonly firebaseNotice = this.firebaseNoticeRef.asReadonly();
  readonly firebaseProfile = computed(() => {
    const current = this.sessionRef();
    return current?.kind === 'firebase' ? current.profile : null;
  });
  readonly authMode: AuthMode = environment.firebaseLoginEnabled ? 'firebase' : 'selector';

  constructor() {
    this.syncActiveUserIdWithSession(this.sessionRef());
  }

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

  startDemoSession(
    userId: string,
    options: { supportContext?: SupportSessionContext } = {}
  ): AppSession | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const session: AppSession = {
      kind: 'demo',
      userId: normalizedUserId,
      supportContext: this.normalizeSupportContext(options.supportContext)
    };
    localStorage.setItem(SessionService.DEMO_ACTIVE_USER_KEY, normalizedUserId);
    this.persistSession(session);
    return session;
  }

  async startFirebaseSession(request: FirebaseAuthRequestDto = { provider: 'google' }): Promise<AppSession | null> {
    if (this.firebaseBusyRef()) {
      return null;
    }
    this.firebaseBusyRef.set(true);
    this.firebaseNoticeRef.set('');
    try {
      const result = await this.firebaseAuthService.signIn(request);
      if (result.emailVerificationSent) {
        const email = result.email?.trim();
        this.firebaseNoticeRef.set(email
          ? `Verification email sent to ${email}. Confirm it, then continue here.`
          : 'Verification email sent. Confirm it, then continue here.');
        return null;
      }
      if (result.errorMessage) {
        this.firebaseNoticeRef.set(result.errorMessage);
        return null;
      }
      if (!result.profile) {
        return null;
      }
      localStorage.removeItem(SessionService.DEMO_ACTIVE_USER_KEY);
      const session: AppSession = {
        kind: 'firebase',
        profile: result.profile
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
    this.firebaseNoticeRef.set('');
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
    this.firebaseNoticeRef.set('');
    this.clearStoredSession();
    localStorage.removeItem(SessionService.DEMO_ACTIVE_USER_KEY);
    if (current?.kind === 'firebase') {
      await this.firebaseAuthService.signOut();
    }
  }

  private persistSession(session: AppSession): void {
    this.sessionRef.set(session);
    this.syncActiveUserIdWithSession(session);
    localStorage.setItem(SessionService.SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  private clearStoredSession(): void {
    this.sessionRef.set(null);
    this.syncActiveUserIdWithSession(null);
    localStorage.removeItem(SessionService.SESSION_STORAGE_KEY);
  }

  private syncActiveUserIdWithSession(session: AppSession | null): void {
    if (session?.kind === 'demo') {
      this.appCtx.setActiveUserId(session.userId.trim());
      return;
    }
    if (session?.kind === 'firebase') {
      this.appCtx.setActiveUserId(session.profile.id.trim());
      return;
    }
    this.appCtx.setActiveUserId('');
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
          userId: parsed.userId.trim(),
          supportContext: this.normalizeSupportContext(
            (parsed as { supportContext?: Partial<SupportSessionContext> }).supportContext
          )
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
            initials: parsed.profile.initials,
            imageUrl: typeof parsed.profile.imageUrl === 'string' ? parsed.profile.imageUrl : undefined
          }
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private normalizeSupportContext(
    context: Partial<SupportSessionContext> | null | undefined
  ): SupportSessionContext | undefined {
    if (context?.kind !== 'admin-support') {
      return undefined;
    }
    const targetUrl = `${context.targetUrl ?? ''}`.trim();
    return {
      kind: 'admin-support',
      targetUrl: targetUrl || undefined
    };
  }
}
