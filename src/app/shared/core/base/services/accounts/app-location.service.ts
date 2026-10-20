import {
  Injectable,
  Injector,
  effect,
  inject,
  signal
} from '@angular/core';

import {
  environment
} from '../../../../../../environments/environment';
import type { LocationCoordinates } from '../../../contracts/accounts/user.interface';
import type { UserDto } from '../../../contracts/accounts/user.interface';
import {
  APP_SETUP_CONFIG,
  resolveRouteConfig
} from '../../config';
import {
  SessionService
} from './session.service';
import {
  APP_STORAGE_KEYS,
  appLocationStorageKey,
  scopedStorageKey
} from '../../../common/storage-scope';
import { GroupWorkspaceContextService } from '../groups/group-workspace-context.service';
import { UserProfileStore } from '../../../../ui/context/stores/profile/user-profile.store';

type HttpUsersServiceInstance = import('../../../http/services/accounts/users.service').HttpUsersService;

@Injectable({
  providedIn: 'root'
})
export class AppLocationService {
  private static readonly LOCATION_SYNC_DISTANCE_METERS = 5_000;

  private readonly userProfileStore = inject(UserProfileStore);
  private readonly workspace = inject(GroupWorkspaceContextService);
  private readonly injector = inject(Injector);
  private readonly sessionService = inject(SessionService);
  private httpUsersServicePromise: Promise<HttpUsersServiceInstance> | null = null;
  private readonly syncingUserIds = new Set<string>();
  private readonly pendingCoordinatesByUserId = new Map<string, LocationCoordinates>();
  private readonly lastPersistedCoordinatesByUserId = new Map<string, LocationCoordinates>();
  private readonly primedLocationUserIds = new Set<string>();
  private geolocationWatchId: number | null = null;
  private geolocationWatchUserId = '';
  private initialized = false;
  private watchedPermissionUserId = '';
  private watchedPermission: PermissionStatus | null = null;
  private permissionListener: (() => void) | null = null;
  private readonly pendingLoginByAccount = new Map<string, LocationCoordinates>();
  private readonly locationCacheWrites = new Map<string, Promise<void>>();
  private locationCacheKeyPromise: Promise<CryptoKey> | null = null;
  private legacyLocationCacheCleared = false;

  readonly trackingEnabled = signal(this.readTrackingEnabled());

  private readTrackingEnabled(): boolean {
    try { return localStorage.getItem(APP_STORAGE_KEYS.locationTrackingEnabled) !== 'false'; }
    catch { return true; }
  }

  setTrackingEnabled(enabled: boolean): void {
    this.trackingEnabled.set(enabled);
    try { localStorage.setItem(APP_STORAGE_KEYS.locationTrackingEnabled, String(enabled)); } catch { /* Storage may be unavailable. */ }
    if (!enabled) {
      this.releasePermissionWatch();
      this.stopCoordinateWatch();
      this.pendingCoordinatesByUserId.clear();
    } else {
      const userId = this.userProfileStore.activeUserId().trim();
      const user = this.resolveTrackedUser(userId);
      if (userId && user && user.profileStatus !== 'onboarding' && this.normalizeCoordinates(user.locationCoordinates)) this.ensureCoordinateWatch(userId);
    }
  }

  // Only a successful profile load acknowledges this account-scoped pending sample.
  async stageLoginCoordinates(accountId: string, coordinates: LocationCoordinates): Promise<void> {
    const normalized = this.normalizeCoordinates(coordinates);
    if (accountId.trim() && normalized) {
      this.pendingLoginByAccount.set(accountId, normalized);
      await this.storeCoordinates(`${accountId}:pending-login`, normalized);
    }
  }

  async pendingLoginCoordinates(accountId: string): Promise<LocationCoordinates | null> {
    return accountId.trim() ? this.pendingLoginByAccount.get(accountId) ?? await this.readStoredCoordinates(`${accountId}:pending-login`) : null;
  }

  async confirmLoginCoordinates(accountId: string, sent: LocationCoordinates): Promise<void> {
    const pending = await this.pendingLoginCoordinates(accountId);
    if (!this.sameCoordinates(sent, this.pendingLoginByAccount.get(accountId) ?? pending)) return;
    await this.locationCacheWrites.get(this.storageKey(`${accountId}:pending-login`));
    if (!this.sameCoordinates(sent, this.pendingLoginByAccount.get(accountId) ?? pending)) return;
    this.pendingLoginByAccount.delete(accountId);
    try { localStorage.removeItem(this.storageKey(`${accountId}:pending-login`)); } catch { /* Retry is safe. */ }
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.clearLegacyLocationCache();

    effect(() => {
      const activeUserId = this.userProfileStore.activeUserId().trim();
      if (!this.trackingEnabled() || !activeUserId || this.sessionService.currentSession()?.kind !== 'firebase') {
        this.releasePermissionWatch();
        this.stopCoordinateWatch();
        return;
      }

      const activeUser = this.resolveTrackedUser(activeUserId);
      if (!activeUser) {
        return;
      }
      if (activeUser.admin === true) {
        this.stopCoordinateWatch();
        return;
      }
      this.runLocationSyncFlow(activeUserId, activeUser);
    });
  }

  private resolveTrackedUser(userId: string): UserDto | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }

    const activeUser = this.userProfileStore.activeUserProfile();
    if (activeUser?.id?.trim() === normalizedUserId) {
      return activeUser;
    }

    const cachedUser = this.userProfileStore.getUserProfile(normalizedUserId);
    if (cachedUser) {
      return cachedUser;
    }

    const session = this.sessionService.currentSession();
    if (session?.kind !== 'firebase' || session.profile.id.trim() !== normalizedUserId) {
      return null;
    }

    const bootstrapUser = this.buildFirebaseBootstrapUser(
      session.profile.id,
      session.profile.name,
      session.profile.initials,
      session.profile.imageUrl
    );
    this.userProfileStore.setUserProfile(bootstrapUser);
    return bootstrapUser;
  }

  private buildFirebaseBootstrapUser(userId: string, name: string, initials: string, imageUrl?: string): UserDto {
    return {
      id: userId.trim(),
      name: name.trim() || 'Firebase User',
      age: 0,
      birthday: '',
      city: '',
      height: '',
      physique: '',
      languages: [],
      horoscope: '',
      initials: initials.trim() || 'U',
      gender: 'woman',
      statusText: '',
      hostTier: '',
      traitLabel: '',
      completion: 0,
      headline: '',
      about: '',
      images: imageUrl?.trim() ? [imageUrl.trim()] : [],
      profileStatus: 'onboarding',
      activities: {
        game: 0,
        chats: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        cars: 0,
        accommodation: 0,
        supplies: 0,
        tickets: 0,
        contacts: 0,
        feedback: 0
      }
    };
  }

  private runLocationSyncFlow(userId: string, activeUser: UserDto): void {
    if (!activeUser?.id?.trim() || activeUser.admin === true
      || this.sessionService.currentSession()?.kind !== 'firebase') {
      return;
    }
    if (activeUser.profileStatus === 'onboarding' || !this.normalizeCoordinates(activeUser.locationCoordinates)) {
      this.stopCoordinateWatch();
      return;
    }

    this.primePersistedCoordinates(userId, activeUser.locationCoordinates);
    // Keep the server profile as the initial value. New coordinates arrive
    // through the background watch, without blocking profile loading.
    this.ensureCoordinateWatch(userId);
  }

  async syncGrantedLocationForActiveUser(): Promise<void> {
    const userId = this.userProfileStore.activeUserId().trim();
    const user = this.resolveTrackedUser(userId);
    if (this.sessionService.currentSession()?.kind !== 'firebase'
      || !this.trackingEnabled() || !userId || !user || user.admin === true || user.profileStatus === 'onboarding'
      || !this.normalizeCoordinates(user.locationCoordinates)
      || !this.isActiveMemberSession(userId) || typeof navigator === 'undefined' || !navigator.permissions) {
      return;
    }
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (permission.state !== 'granted') return;
      const coordinates = await this.requestCurrentCoordinates();
      if (coordinates && this.userProfileStore.activeUserId().trim() === userId
        && this.isActiveMemberSession(userId)) {
        this.primePersistedCoordinates(userId, user.locationCoordinates);
        this.handleStreamedCoordinates(userId, coordinates);
        this.ensureCoordinateWatch(userId);
      }
    } catch {
      // Settings remain usable while background location synchronization retries.
    }
  }

  async requestCurrentCoordinates(signal?: AbortSignal): Promise<LocationCoordinates | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return null;
    }

    return new Promise<LocationCoordinates | null>(resolve => {
      let watchId: number | undefined;
      let settled = false;
      const finish = (coordinates: LocationCoordinates | null) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', abort);
        if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
        resolve(coordinates);
      };
      const abort = () => finish(null);
      const success = (position: GeolocationPosition) => {
        const latitude = Number(position.coords.latitude);
        const longitude = Number(position.coords.longitude);
        finish(Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null);
      };
      if (signal?.aborted) { finish(null); return; }
      if (signal) {
        // Setup owns the deadline, starting only at permission grant. A
        // cancellable one-shot watch avoids Android's earlier native timeout.
        signal.addEventListener('abort', abort, { once: true });
        watchId = navigator.geolocation.watchPosition(success, () => finish(null), {
          enableHighAccuracy: false, maximumAge: 0
        });
        if (settled) navigator.geolocation.clearWatch(watchId);
      } else {
        navigator.geolocation.getCurrentPosition(success, () => finish(null), {
          enableHighAccuracy: false, timeout: APP_SETUP_CONFIG.locationRequestTimeoutMs, maximumAge: 0
        });
      }
    });
  }

  async saveCurrentCoordinates(coordinates: LocationCoordinates): Promise<boolean> {
    const userId = this.userProfileStore.activeUserId().trim();
    const user = this.resolveTrackedUser(userId);
    const normalized = this.normalizeCoordinates(coordinates);
    if (!user || user.admin === true || !normalized
      || !this.isActiveMemberSession(userId)) return false;
    this.primePersistedCoordinates(userId, user.locationCoordinates);
    if (!await this.persistCoordinates(userId, user, normalized)) return false;
    if (this.userProfileStore.activeUserId().trim() !== userId) return false;
    this.ensureCoordinateWatch(userId);
    return true;
  }

  private ensureCoordinateWatch(userId: string): void {
    if (this.sessionService.currentSession()?.kind !== 'firebase'
      || !this.trackingEnabled() || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    if (this.geolocationWatchId !== null && this.geolocationWatchUserId === userId) {
      return;
    }

    // Startup and background tracking must never open a native permission
    // prompt. The explicit Firebase Login confirmation owns permission requests.
    if (!navigator.permissions) {
      return;
    }
    if (this.watchedPermissionUserId === userId) return;
    this.releasePermissionWatch();
    this.watchedPermissionUserId = userId;
    void navigator.permissions.query({ name: 'geolocation' }).then(permission => {
      if (this.watchedPermissionUserId !== userId || this.userProfileStore.activeUserId().trim() !== userId) return;
      this.watchedPermission = permission;
      this.permissionListener = () => this.onLocationPermissionChanged();
      permission.addEventListener('change', this.permissionListener);
      this.onLocationPermissionChanged();
    }).catch(() => undefined);
  }

  private onLocationPermissionChanged(): void {
    const userId = this.watchedPermissionUserId;
    const user = this.resolveTrackedUser(userId);
    if (this.sessionService.currentSession()?.kind === 'firebase'
      && this.trackingEnabled() && this.watchedPermission?.state === 'granted'
      && user?.profileStatus !== 'onboarding' && this.normalizeCoordinates(user?.locationCoordinates)
      && this.userProfileStore.activeUserId().trim() === userId) this.startCoordinateWatch(userId);
    else this.stopCoordinateWatch();
  }

  private releasePermissionWatch(): void {
    if (this.permissionListener) this.watchedPermission?.removeEventListener('change', this.permissionListener);
    this.permissionListener = null;
    this.watchedPermission = null;
    this.watchedPermissionUserId = '';
  }

  private startCoordinateWatch(userId: string): void {
    if (this.geolocationWatchId !== null && this.geolocationWatchUserId === userId) {
      return;
    }

    this.stopCoordinateWatch();
    this.geolocationWatchUserId = userId;
    this.geolocationWatchId = navigator.geolocation.watchPosition(
      position => {
        const coordinates = this.normalizeCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        if (!coordinates) {
          return;
        }
        this.handleStreamedCoordinates(userId, coordinates);
      },
      error => { if (error.code === 1) this.stopCoordinateWatch(); },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60 * 1000
      }
    );
  }

  private stopCoordinateWatch(): void {
    if (typeof navigator !== 'undefined' && navigator.geolocation && this.geolocationWatchId !== null) {
      navigator.geolocation.clearWatch(this.geolocationWatchId);
    }
    this.geolocationWatchId = null;
    this.geolocationWatchUserId = '';
  }

  private handleStreamedCoordinates(userId: string, coordinates: LocationCoordinates): void {
    if (this.sessionService.currentSession()?.kind !== 'firebase'
      || !this.trackingEnabled() || this.userProfileStore.activeUserId().trim() !== userId) return;
    const activeUser = this.resolveTrackedUser(userId);
    if (!activeUser?.id?.trim()) {
      return;
    }

    this.primePersistedCoordinates(userId, activeUser.locationCoordinates);
    this.queueLocationSyncForActiveUser(userId, activeUser, coordinates);
  }

  private async readStoredCoordinates(userId: string): Promise<LocationCoordinates | null> {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      this.clearLegacyLocationCache();
      const storageKey = this.storageKey(userId);
      await this.locationCacheWrites.get(storageKey);
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return null;
      }
      const stored = JSON.parse(raw) as { version?: number; iv?: number[]; ciphertext?: number[] };
      if (stored.version !== 1 || !Array.isArray(stored.iv) || stored.iv.length !== 12
        || !Array.isArray(stored.ciphertext) || stored.ciphertext.length < 16) return null;
      const plaintext = await crypto.subtle.decrypt({
        name: 'AES-GCM', iv: Uint8Array.from(stored.iv), additionalData: new TextEncoder().encode(storageKey)
      }, await this.locationCacheKey(), Uint8Array.from(stored.ciphertext));
      return this.normalizeCoordinates(JSON.parse(new TextDecoder().decode(plaintext)));
    } catch {
      return null;
    }
  }

  private async storeCoordinates(userId: string, coordinates: LocationCoordinates): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return;
    }
    this.clearLegacyLocationCache();
    const storageKey = this.storageKey(userId);
    const write = (this.locationCacheWrites.get(storageKey) ?? Promise.resolve()).then(async () => {
      const key = await this.locationCacheKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({
        name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(storageKey)
      }, key, new TextEncoder().encode(JSON.stringify(coordinates)));
      localStorage.setItem(storageKey, JSON.stringify({
        version: 1, iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ciphertext))
      }));
    }).catch(() => {
      // Keep the in-memory sample usable; never fall back to plaintext storage.
    });
    this.locationCacheWrites.set(storageKey, write);
    await write;
    if (this.locationCacheWrites.get(storageKey) === write) this.locationCacheWrites.delete(storageKey);
  }

  private async locationCacheKey(): Promise<CryptoKey> {
    if (!this.locationCacheKeyPromise) {
      this.locationCacheKeyPromise = (async () => {
        const { AppMemoryDb } = await import('../../../common/app.db');
        const db = this.injector.get(AppMemoryDb);
        const keyId = 'location.cache-key.v2';
        const existing = await db.readIndexedDbTableEntry<CryptoKey>(keyId);
        if (existing) return existing;
        const generated = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        return db.updateIndexedDbTableEntry<CryptoKey>(keyId, current => current ?? generated);
      })().catch(error => {
        this.locationCacheKeyPromise = null;
        throw error;
      });
    }
    return this.locationCacheKeyPromise;
  }

  private clearLegacyLocationCache(): void {
    if (this.legacyLocationCacheCleared) return;
    try {
      const prefix = scopedStorageKey('location.v1:');
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(prefix)) localStorage.removeItem(key);
      }
      this.legacyLocationCacheCleared = true;
    } catch { /* Storage may be unavailable. */ }
  }

  private sameCoordinates(
    current: LocationCoordinates | undefined,
    next: LocationCoordinates | null
  ): boolean {
    if (!current || !next) {
      return false;
    }
    return current.latitude === next.latitude && current.longitude === next.longitude;
  }

  private normalizeCoordinates(
    coordinates: Partial<LocationCoordinates> | LocationCoordinates | null | undefined
  ): LocationCoordinates | null {
    const latitude = Number(coordinates?.latitude);
    const longitude = Number(coordinates?.longitude);
    if (typeof coordinates?.latitude !== 'number' || typeof coordinates?.longitude !== 'number'
      || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return null;
    }
    return {
      latitude,
      longitude
    };
  }

  private primePersistedCoordinates(
    userId: string,
    coordinates: LocationCoordinates | null | undefined
  ): void {
    if (this.primedLocationUserIds.has(userId)) {
      return;
    }
    // An absent server coordinate is also a baseline. Never promote a later
    // optimistic profile update to a successful server save after a failed request.
    this.primedLocationUserIds.add(userId);
    const normalized = this.normalizeCoordinates(coordinates);
    if (!normalized) {
      return;
    }
    this.lastPersistedCoordinatesByUserId.set(userId, normalized);
  }

  private shouldPersistCoordinates(userId: string, coordinates: LocationCoordinates): boolean {
    const lastPersisted = this.lastPersistedCoordinatesByUserId.get(userId);
    if (!lastPersisted) {
      return true;
    }
    return this.distanceMeters(lastPersisted, coordinates) >= AppLocationService.LOCATION_SYNC_DISTANCE_METERS;
  }

  private distanceMeters(left: LocationCoordinates, right: LocationCoordinates): number {
    const earthRadiusMeters = 6_371_000;
    const latitudeDelta = this.toRadians(right.latitude - left.latitude);
    const longitudeDelta = this.toRadians(right.longitude - left.longitude);
    const leftLatitude = this.toRadians(left.latitude);
    const rightLatitude = this.toRadians(right.latitude);
    const a = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMeters * c;
  }

  private toRadians(value: number): number {
    return value * (Math.PI / 180);
  }

  private queueLocationSyncForActiveUser(
    userId: string,
    activeUser: UserDto,
    coordinates: LocationCoordinates
  ): void {
    const normalizedCoordinates = this.normalizeCoordinates(coordinates);
    if (
      !this.isActiveMemberSession(userId)
      || !activeUser?.id?.trim()
      || activeUser.admin === true
      || !normalizedCoordinates
    ) {
      return;
    }

    this.pendingCoordinatesByUserId.set(userId, normalizedCoordinates);
    if (this.syncingUserIds.has(userId)) {
      return;
    }

    void this.flushPendingLocationSync(userId, activeUser);
  }

  private isActiveMemberSession(userId: string): boolean {
    const normalizedUserId = userId.trim();
    const session = this.sessionService.currentSession();
    return Boolean(
      normalizedUserId
      && (session?.kind === 'firebase'
        || (session?.kind === 'demo' && session.userId.trim() === this.workspace.accountId(normalizedUserId)))
      && this.userProfileStore.activeUserId().trim() === normalizedUserId
    );
  }

  private async flushPendingLocationSync(
    userId: string,
    fallbackUser: UserDto
  ): Promise<void> {
    if (!fallbackUser?.id?.trim() || fallbackUser.admin === true || this.syncingUserIds.has(userId)) {
      return;
    }

    const normalizedCoordinates = this.pendingCoordinatesByUserId.get(userId);
    if (!normalizedCoordinates) {
      return;
    }

    if (!this.shouldPersistCoordinates(userId, normalizedCoordinates)) {
      this.pendingCoordinatesByUserId.delete(userId);
      return;
    }

    this.pendingCoordinatesByUserId.delete(userId);
    this.syncingUserIds.add(userId);
    try {
      const currentUser = this.resolveTrackedUser(userId) ?? fallbackUser;
      if (currentUser.admin === true) {
        return;
      }
      await this.persistCoordinates(userId, currentUser, normalizedCoordinates);
    } catch {
      // A rejected background sample does not revoke an existing admission.
      // Keep the saved profile, browser cache and distance baseline unchanged.
    } finally {
      // Release the location-write marker only; authentication/session state is untouched.
      this.syncingUserIds.delete(userId);
      if (this.pendingCoordinatesByUserId.has(userId)) {
        void this.flushPendingLocationSync(userId, this.resolveTrackedUser(userId) ?? fallbackUser);
      }
    }
  }

  private async persistCoordinates(userId: string, user: UserDto, coordinates: LocationCoordinates): Promise<boolean> {
    const users = this.isLocalUserRouteEnabled()
      ? this.injector.get((await import('../../../local/source/services/accounts/users.service')).LocalUsersService)
      : await this.httpUsersService();
    const savedUser = await users.saveUserProfile({ ...user, locationCoordinates: coordinates });
    if (savedUser?.id?.trim()) {
      await this.storeCoordinates(userId, this.normalizeCoordinates(savedUser.locationCoordinates) ?? coordinates);
      this.lastPersistedCoordinatesByUserId.set(
        userId, this.normalizeCoordinates(savedUser.locationCoordinates) ?? coordinates
      );
      this.userProfileStore.setUserProfile(savedUser);
      return true;
    }
    return false;
  }

  private isLocalUserRouteEnabled(): boolean {
    const routeConfig = resolveRouteConfig('/auth/me');
    if (routeConfig.mode) {
      return routeConfig.mode === 'local';
    }
    if (routeConfig.http) {
      return false;
    }
    return environment.activitiesDataSource !== 'http';
  }

  private async httpUsersService(): Promise<HttpUsersServiceInstance> {
    if (!this.httpUsersServicePromise) {
      this.httpUsersServicePromise = import('../../../http/services/accounts/users.service')
        .then(module => this.injector.get(module.HttpUsersService));
    }
    return this.httpUsersServicePromise;
  }

  private storageKey(userId: string): string {
    return appLocationStorageKey(userId);
  }
}
