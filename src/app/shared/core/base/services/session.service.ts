import { Injectable, Injector, computed, inject, signal } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { FirebaseAuthProfileDto, FirebaseAuthRequestDto } from '../../contracts/user.interface';
import type { AuthMode } from '../../common/constants';
import { APP_STORAGE_KEYS } from '../../common/storage-scope';
import {
  isFirebaseLoginEnabled,
  resolveRuntimeAuthMode
} from '../../common/firebase-login-mode';

type FirebaseAuthServiceInstance = import('./firebase-auth.service').FirebaseAuthService;
type HttpOperatorBootstrapAuthServiceInstance =
  import('../../http/services/operator-bootstrap-auth.service').HttpOperatorBootstrapAuthService;
type FirebaseSessionRegistryServiceInstance =
  import('../../http/services/firebase-session-registry.service').FirebaseSessionRegistryService;

export interface SupportSessionContext {
  kind: 'admin-support';
  targetUrl?: string;
}

export type AppSession =
  | { kind: 'demo'; userId: string; sessionId?: string; supportContext?: SupportSessionContext }
  | { kind: 'firebase'; profile: FirebaseAuthProfileDto; sessionId: string }
  | { kind: 'operator-bootstrap'; email: string; expiresAt: string };

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private static readonly OPERATOR_BOOTSTRAP_EMAIL_PATTERN =
    /^operator-[0-9a-f]{24}@deployment\.invalid$/;
  private static readonly SESSION_STORAGE_KEY = APP_STORAGE_KEYS.session;
  private static readonly DEMO_ACTIVE_USER_KEY = APP_STORAGE_KEYS.demoActiveUser;
  private static readonly OPERATOR_BOOTSTRAP_SESSION_KEY =
    APP_STORAGE_KEYS.operatorBootstrapSession;
  private static readonly OPERATOR_BOOTSTRAP_TOKEN_KEY =
    APP_STORAGE_KEYS.operatorBootstrapToken;

  private readonly injector = inject(Injector);
  private readonly sessionRef = signal<AppSession | null>(this.loadStoredSession());
  private readonly authModeRef = signal<AuthMode>('selector');
  private readonly firebaseBusyRef = signal(false);
  private readonly firebaseNoticeRef = signal('');
  private firebaseAuthServicePromise: Promise<FirebaseAuthServiceInstance> | null = null;
  private firebaseSessionRegistryServicePromise:
    Promise<FirebaseSessionRegistryServiceInstance> | null = null;
  private operatorBootstrapAuthServicePromise:
    Promise<HttpOperatorBootstrapAuthServiceInstance> | null = null;

  readonly session = this.sessionRef.asReadonly();
  readonly firebaseBusy = this.firebaseBusyRef.asReadonly();
  readonly firebaseNotice = this.firebaseNoticeRef.asReadonly();
  readonly firebaseProfile = computed(() => {
    const current = this.sessionRef();
    return current?.kind === 'firebase' ? current.profile : null;
  });
  readonly activeUserId = computed(() => {
    const current = this.sessionRef();
    if (current?.kind === 'demo') {
      return current.userId.trim();
    }
    if (current?.kind === 'firebase') {
      return current.profile.id.trim();
    }
    return '';
  });
  get authMode(): AuthMode {
    return this.authModeRef();
  }

  setFirebaseRuntimeAvailable(available: boolean): void {
    this.authModeRef.set(resolveRuntimeAuthMode(
      isFirebaseLoginEnabled(),
      available
    ));
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
    if (current.kind === 'operator-bootstrap') {
      return this.getOperatorBootstrapToken() ? current : null;
    }
    if (this.isBrowserOffline()) {
      return current;
    }
    const restoredProfile = await (await this.firebaseAuthService()).restoreSessionProfile();
    if (!restoredProfile) {
      this.clearStoredSession();
      return null;
    }
      const nextSession: AppSession = {
        kind: 'firebase',
        profile: restoredProfile,
        sessionId: current.sessionId
      };
      this.persistSession(nextSession);
      void this.initializeFirebaseMessagingForSession(nextSession);
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
      sessionId: this.newOpaqueId('session'),
      supportContext: this.normalizeSupportContext(options.supportContext)
    };
    localStorage.setItem(SessionService.DEMO_ACTIVE_USER_KEY, normalizedUserId);
    this.persistSession(session);
    return session;
  }

  async startTrackedDemoSession(userId: string): Promise<AppSession | null> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const session: Extract<AppSession, { kind: 'demo' }> & { sessionId: string } = {
      kind: 'demo',
      userId: normalizedUserId,
      sessionId: this.newOpaqueId('session')
    };
    try {
      const response = await (await this.firebaseSessionRegistryService()).registerDemoLogin(
        session.sessionId,
        session.userId,
        {
          attemptId: this.newOpaqueId('attempt'),
          provider: 'demo'
        }
      );
      if (response.accepted) {
        localStorage.setItem(SessionService.DEMO_ACTIVE_USER_KEY, normalizedUserId);
        this.persistSession(session);
        return session;
      }
      this.firebaseNoticeRef.set('auth.session.limit.reached');
    } catch (error) {
      this.firebaseNoticeRef.set(
        this.httpErrorStatus(error) === 409
          ? 'auth.session.limit.reached'
          : 'auth.session.registration.failed'
      );
    }
    this.clearStoredSession();
    return null;
  }

  async startFirebaseSession(request: FirebaseAuthRequestDto = { provider: 'google' }): Promise<AppSession | null> {
    if (this.firebaseBusyRef()) {
      return null;
    }
    this.firebaseBusyRef.set(true);
    this.firebaseNoticeRef.set('');
    try {
      return await this.startFirebaseSessionInternal(request);
    } finally {
      this.firebaseBusyRef.set(false);
    }
  }

  async startAuthSession(
    request: FirebaseAuthRequestDto = { provider: 'google' }
  ): Promise<AppSession | null> {
    if (!this.isOperatorBootstrapCandidate(request)) {
      return this.startFirebaseSession(request);
    }
    if (this.firebaseBusyRef()) {
      return null;
    }
    this.firebaseBusyRef.set(true);
    this.firebaseNoticeRef.set('');
    try {
      const email = `${request.email ?? ''}`.trim();
      const password = `${request.password ?? ''}`;
      if (!email || !password) {
        this.firebaseNoticeRef.set('operator.bootstrap.auth.invalid');
        return null;
      }
      try {
        const result = await (await this.operatorBootstrapAuthService()).signIn({
          email,
          password
        });
        const session: AppSession = {
          kind: 'operator-bootstrap',
          email: result.email,
          expiresAt: result.expiresAt
        };
        if (
          Date.parse(session.expiresAt) <= Date.now()
          || !this.persistOperatorBootstrapSession(session, result.accessToken)
        ) {
          this.firebaseNoticeRef.set('operator.bootstrap.auth.response.invalid');
          return null;
        }
        return session;
      } catch (error) {
        const status = this.httpErrorStatus(error);
        if (status === 404) {
          return await this.startFirebaseSessionInternal(request);
        }
        this.firebaseNoticeRef.set(
          status === 401
            ? 'operator.bootstrap.auth.invalid'
            : status === 429
              ? 'operator.bootstrap.auth.throttled'
              : 'operator.bootstrap.auth.failed'
        );
        return null;
      }
    } finally {
      this.firebaseBusyRef.set(false);
    }
  }

  async restoreFirebaseSession(): Promise<AppSession | null> {
    if (this.firebaseBusyRef()) {
      return this.sessionRef();
    }
    const current = this.sessionRef();
    if (current?.kind === 'firebase' && this.isBrowserOffline()) {
      return current;
    }
    this.firebaseBusyRef.set(true);
    this.firebaseNoticeRef.set('');
    try {
      const profile = await (await this.firebaseAuthService()).restoreSessionProfile();
      if (!profile) {
        this.clearStoredSession();
        return null;
      }
      const session: AppSession = {
        kind: 'firebase',
        profile,
        sessionId: this.newOpaqueId('session')
      };
      if (!await this.registerFirebaseLogin(session, 'firebase')) {
        return null;
      }
      this.persistSession(session);
      void this.initializeFirebaseMessagingForSession(session);
      return session;
    } finally {
      this.firebaseBusyRef.set(false);
    }
  }

  async logout(): Promise<void> {
    const current = this.sessionRef();
    let firebaseToken: string | null = null;
    if (current?.kind === 'firebase') {
      try {
        firebaseToken = await (await this.firebaseAuthService()).getIdToken();
      } catch {
        // Local logout must still complete if Firebase cannot return a token.
      }
    }
    this.firebaseNoticeRef.set('');
    this.clearStoredSession();
    localStorage.removeItem(SessionService.DEMO_ACTIVE_USER_KEY);
    try {
      const sessionId = current?.kind === 'demo' || current?.kind === 'firebase'
        ? `${current.sessionId ?? ''}`.trim()
        : '';
      if (current?.kind === 'demo' && sessionId) {
        await (await this.firebaseSessionRegistryService()).revokeDemoSession(
          sessionId,
          current.userId
        );
      } else if (current?.kind === 'firebase' && sessionId && firebaseToken) {
        await (await this.firebaseSessionRegistryService()).revokeFirebaseSession(
          sessionId,
          current.profile.id,
          firebaseToken
        );
      }
    } catch {
      // Keep logout resilient when the registry is offline or already revoked.
    }
    if (current?.kind === 'firebase') {
      await (await this.firebaseAuthService()).signOut();
    }
  }

  getOperatorBootstrapToken(): string | null {
    const current = this.sessionRef();
    if (
      current?.kind !== 'operator-bootstrap'
      || !this.isFutureIso(current.expiresAt)
      || typeof sessionStorage === 'undefined'
    ) {
      if (current?.kind === 'operator-bootstrap') {
        this.clearOperatorBootstrapSession();
      }
      return null;
    }
    try {
      const token = `${sessionStorage.getItem(
        SessionService.OPERATOR_BOOTSTRAP_TOKEN_KEY
      ) ?? ''}`.trim();
      if (token) {
        return token;
      }
    } catch {
      // The bootstrap credential is unavailable when session storage is blocked.
    }
    this.clearOperatorBootstrapSession();
    return null;
  }

  clearOperatorBootstrapSession(noticeKey = ''): void {
    const bootstrapActive = this.sessionRef()?.kind === 'operator-bootstrap';
    this.clearOperatorBootstrapStorage();
    if (bootstrapActive) {
      this.sessionRef.set(null);
    }
    if (noticeKey) {
      this.firebaseNoticeRef.set(noticeKey);
    }
  }

  async getFirebaseIdToken(): Promise<string | null> {
    if (!isFirebaseLoginEnabled() || this.sessionRef()?.kind !== 'firebase') {
      return null;
    }
    return (await this.firebaseAuthService()).getIdToken();
  }

  currentFirebaseSessionId(): string {
    const current = this.sessionRef();
    return current?.kind === 'firebase' ? current.sessionId.trim() : '';
  }

  private async firebaseAuthService(): Promise<FirebaseAuthServiceInstance> {
    if (!this.firebaseAuthServicePromise) {
      this.firebaseAuthServicePromise = import('./firebase-auth.service')
        .then(module => this.injector.get(module.FirebaseAuthService));
    }
    return this.firebaseAuthServicePromise;
  }

  private async operatorBootstrapAuthService():
    Promise<HttpOperatorBootstrapAuthServiceInstance> {
    if (!this.operatorBootstrapAuthServicePromise) {
      this.operatorBootstrapAuthServicePromise = import(
        '../../http/services/operator-bootstrap-auth.service'
      ).then(module => this.injector.get(module.HttpOperatorBootstrapAuthService));
    }
    return this.operatorBootstrapAuthServicePromise;
  }

  private async firebaseSessionRegistryService():
    Promise<FirebaseSessionRegistryServiceInstance> {
    if (!this.firebaseSessionRegistryServicePromise) {
      this.firebaseSessionRegistryServicePromise = import(
        '../../http/services/firebase-session-registry.service'
      ).then(module => this.injector.get(module.FirebaseSessionRegistryService));
    }
    return this.firebaseSessionRegistryServicePromise;
  }

  private async startFirebaseSessionInternal(
    request: FirebaseAuthRequestDto
  ): Promise<AppSession | null> {
    const result = await (await this.firebaseAuthService()).signIn(request);
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
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SessionService.DEMO_ACTIVE_USER_KEY);
    }
    const session: AppSession = {
      kind: 'firebase',
      profile: result.profile,
      sessionId: this.newOpaqueId('session')
    };
    if (!await this.registerFirebaseLogin(session, request.provider)) {
      return null;
    }
    this.persistSession(session);
    void this.initializeFirebaseMessagingForSession(session);
    return session;
  }

  private async initializeFirebaseMessagingForSession(session: AppSession): Promise<void> {
    if (session.kind !== 'firebase'
      || environment.activitiesDataSource !== 'http'
      || !environment.firebaseMessagingEnabled
      || this.isLoopbackBrowserHost()) {
      return;
    }
    const { FirebaseMessagingService } = await import('./firebase-messaging.service');
    this.injector.get(FirebaseMessagingService).initialize();
  }

  private async registerFirebaseLogin(
    session: Extract<AppSession, { kind: 'firebase' }>,
    provider: string
  ): Promise<boolean> {
    const token = await (await this.firebaseAuthService()).getIdToken();
    if (!token) {
      this.firebaseNoticeRef.set('auth.session.registration.failed');
      await (await this.firebaseAuthService()).signOut();
      return false;
    }
    try {
      const response = await (await this.firebaseSessionRegistryService()).registerLogin(
        session.sessionId,
        token,
        {
          attemptId: this.newOpaqueId('attempt'),
          provider
        }
      );
      if (response.accepted) {
        return true;
      }
      this.firebaseNoticeRef.set('auth.session.limit.reached');
    } catch (error) {
      this.firebaseNoticeRef.set(
        this.httpErrorStatus(error) === 409
          ? 'auth.session.limit.reached'
          : 'auth.session.registration.failed'
      );
    }
    await (await this.firebaseAuthService()).signOut();
    return false;
  }

  private persistSession(session: AppSession): void {
    this.clearOperatorBootstrapStorage();
    this.sessionRef.set(session);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SessionService.SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  }

  private persistOperatorBootstrapSession(
    session: Extract<AppSession, { kind: 'operator-bootstrap' }>,
    accessToken: string
  ): boolean {
    if (typeof sessionStorage === 'undefined') {
      return false;
    }
    try {
      sessionStorage.setItem(
        SessionService.OPERATOR_BOOTSTRAP_SESSION_KEY,
        JSON.stringify(session)
      );
      sessionStorage.setItem(
        SessionService.OPERATOR_BOOTSTRAP_TOKEN_KEY,
        accessToken
      );
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SessionService.SESSION_STORAGE_KEY);
        localStorage.removeItem(SessionService.DEMO_ACTIVE_USER_KEY);
      }
      this.sessionRef.set(session);
      return true;
    } catch {
      this.clearOperatorBootstrapStorage();
      return false;
    }
  }

  private clearStoredSession(): void {
    this.sessionRef.set(null);
    this.clearOperatorBootstrapStorage();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SessionService.SESSION_STORAGE_KEY);
    }
  }

  private isLoopbackBrowserHost(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const hostname = window.location.hostname.toLowerCase();
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '[::1]'
      || hostname === '::1'
      || hostname.endsWith('.localhost');
  }

  private isBrowserOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  private loadStoredSession(): AppSession | null {
    const operatorBootstrapSession = this.loadStoredOperatorBootstrapSession();
    if (operatorBootstrapSession) {
      return operatorBootstrapSession;
    }
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
          sessionId: typeof parsed.sessionId === 'string'
            ? parsed.sessionId.trim() || undefined
            : undefined,
          supportContext: this.normalizeSupportContext(
            (parsed as { supportContext?: Partial<SupportSessionContext> }).supportContext
          )
        };
      }
      if (
        parsed.kind === 'firebase' &&
        parsed.profile &&
        typeof parsed.sessionId === 'string' &&
        parsed.sessionId.trim().length > 0 &&
        typeof parsed.profile.id === 'string' &&
        typeof parsed.profile.name === 'string' &&
        typeof parsed.profile.email === 'string' &&
        typeof parsed.profile.initials === 'string'
      ) {
        return {
          kind: 'firebase',
          sessionId: parsed.sessionId.trim(),
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

  private loadStoredOperatorBootstrapSession():
    Extract<AppSession, { kind: 'operator-bootstrap' }> | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }
    try {
      const rawSession = sessionStorage.getItem(
        SessionService.OPERATOR_BOOTSTRAP_SESSION_KEY
      );
      const token = `${sessionStorage.getItem(
        SessionService.OPERATOR_BOOTSTRAP_TOKEN_KEY
      ) ?? ''}`.trim();
      if (!rawSession || !token) {
        this.clearOperatorBootstrapStorage();
        return null;
      }
      const parsed = JSON.parse(rawSession) as Partial<
        Extract<AppSession, { kind: 'operator-bootstrap' }>
      >;
      const email = `${parsed.email ?? ''}`.trim();
      const expiresAt = `${parsed.expiresAt ?? ''}`.trim();
      if (
        parsed.kind !== 'operator-bootstrap'
        || !email
        || !this.isFutureIso(expiresAt)
      ) {
        this.clearOperatorBootstrapStorage();
        return null;
      }
      return {
        kind: 'operator-bootstrap',
        email,
        expiresAt
      };
    } catch {
      this.clearOperatorBootstrapStorage();
      return null;
    }
  }

  private clearOperatorBootstrapStorage(): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }
    try {
      sessionStorage.removeItem(SessionService.OPERATOR_BOOTSTRAP_SESSION_KEY);
      sessionStorage.removeItem(SessionService.OPERATOR_BOOTSTRAP_TOKEN_KEY);
    } catch {
      // Clearing a blocked browser storage area is best effort.
    }
  }

  private isOperatorBootstrapCandidate(request: FirebaseAuthRequestDto): boolean {
    return request.provider === 'email'
      && request.emailMode === 'sign-in'
      && SessionService.OPERATOR_BOOTSTRAP_EMAIL_PATTERN.test(
        `${request.email ?? ''}`.trim()
      );
  }

  private isFutureIso(value: string): boolean {
    const expiresAtMs = Date.parse(value);
    return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now();
  }

  private httpErrorStatus(error: unknown): number | null {
    if (!error || typeof error !== 'object' || !('status' in error)) {
      return null;
    }
    const status = Number((error as { status?: unknown }).status);
    return Number.isFinite(status) ? status : null;
  }

  private newOpaqueId(prefix: 'session' | 'attempt'): string {
    const randomUuid = typeof crypto !== 'undefined'
      && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}:${randomUuid}`;
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
