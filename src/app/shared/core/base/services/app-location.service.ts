import {
  Injectable,
  Injector,
  effect,
  inject,
  signal
} from '@angular/core';
import {
  HttpErrorResponse
} from '@angular/common/http';
import {
  Router
} from '@angular/router';

import {
  environment
} from '../../../../../environments/environment';
import type { LocationCoordinates } from '../../contracts/user.interface';
import type { UserDto } from '../../contracts/user.interface';
import {
  APP_SETUP_CONFIG,
  resolveRouteConfig
} from '../config';
import {
  SessionService
} from './session.service';
import {
  DialogStore
} from '../../../ui/context/stores/dialog.store';
import {
  APP_STORAGE_KEYS,
  appLocationStorageKey
} from '../../common/storage-scope';
import { GroupWorkspaceContextService } from './group-workspace-context.service';
import { UserProfileStore } from '../../../ui/context/stores/user-profile.store';

type HttpUsersServiceInstance = import('../../http/services/users.service').HttpUsersService;

@Injectable({
  providedIn: 'root'
})
export class AppLocationService {
  private static readonly ACCESS_RESTRICTED_TITLE = 'Please register';
  private static readonly ACCESS_RESTRICTED_MESSAGE = 'Login is currently unavailable from your country or region for security reasons. Please come back later.';
  private static readonly LOCATION_SYNC_DISTANCE_METERS = 5_000;

  private readonly userProfileStore = inject(UserProfileStore);
  private readonly workspace = inject(GroupWorkspaceContextService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  private readonly dialogStore = inject(DialogStore);
  private httpUsersServicePromise: Promise<HttpUsersServiceInstance> | null = null;
  private readonly syncingUserIds = new Set<string>();
  private readonly blockedUserIds = new Set<string>();
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

  // Reuse the existing scoped browser location cache; only the profile load acknowledges this pending value.
  stageLoginCoordinates(accountId: string, coordinates: LocationCoordinates): void {
    const normalized = this.normalizeCoordinates(coordinates);
    if (accountId.trim() && normalized) {
      this.pendingLoginByAccount.set(accountId, normalized);
      this.storeCoordinates(`${accountId}:pending-login`, normalized);
    }
  }

  pendingLoginCoordinates(accountId: string): LocationCoordinates | null {
    return accountId.trim() ? this.pendingLoginByAccount.get(accountId) ?? this.readStoredCoordinates(`${accountId}:pending-login`) : null;
  }

  confirmLoginCoordinates(accountId: string, sent: LocationCoordinates): void {
    if (!this.sameCoordinates(sent, this.pendingLoginCoordinates(accountId))) return;
    this.pendingLoginByAccount.delete(accountId);
    try { localStorage.removeItem(this.storageKey(`${accountId}:pending-login`)); } catch { /* Retry is safe. */ }
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    effect(() => {
      const activeUserId = this.userProfileStore.activeUserId().trim();
      if (!this.trackingEnabled() || !activeUserId) {
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
    if (!activeUser?.id?.trim() || activeUser.admin === true) {
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
    if (!this.trackingEnabled() || !userId || !user || user.admin === true || user.profileStatus === 'onboarding'
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

  async requestCurrentCoordinates(): Promise<LocationCoordinates | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return null;
    }

    return new Promise<LocationCoordinates | null>(resolve => {
      // The native timeout excludes time spent waiting for permission.
      navigator.geolocation.getCurrentPosition(
        position => {
          const latitude = Number(position.coords.latitude);
          const longitude = Number(position.coords.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            resolve(null);
            return;
          }
          resolve({ latitude, longitude });
        },
        () => resolve(null),
        {
          enableHighAccuracy: false,
          timeout: APP_SETUP_CONFIG.locationRequestTimeoutMs,
          maximumAge: 0
        }
      );
    });
  }

  async saveCurrentCoordinates(coordinates: LocationCoordinates): Promise<boolean> {
    const userId = this.userProfileStore.activeUserId().trim();
    const user = this.resolveTrackedUser(userId);
    const normalized = this.normalizeCoordinates(coordinates);
    if (!user || user.admin === true || !normalized
      || !this.isActiveMemberSession(userId)) return false;
    this.primePersistedCoordinates(userId, user.locationCoordinates);
    await this.persistCoordinates(userId, user, normalized);
    if (this.userProfileStore.activeUserId().trim() !== userId) return false;
    this.storeCoordinates(userId, normalized);
    this.ensureCoordinateWatch(userId);
    return true;
  }

  private ensureCoordinateWatch(userId: string): void {
    if (!this.trackingEnabled() || typeof navigator === 'undefined' || !navigator.geolocation) {
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
    if (this.trackingEnabled() && this.watchedPermission?.state === 'granted'
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
    if (!this.trackingEnabled() || this.userProfileStore.activeUserId().trim() !== userId) return;
    const activeUser = this.resolveTrackedUser(userId);
    if (!activeUser?.id?.trim()) {
      return;
    }

    this.primePersistedCoordinates(userId, activeUser.locationCoordinates);
    this.storeCoordinates(userId, coordinates);
    this.queueLocationSyncForActiveUser(userId, activeUser, coordinates);
  }

  private readStoredCoordinates(userId: string): LocationCoordinates | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const raw = localStorage.getItem(this.storageKey(userId));
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<LocationCoordinates>;
      return this.normalizeCoordinates(parsed);
    } catch {
      return null;
    }
  }

  private storeCoordinates(userId: string, coordinates: LocationCoordinates): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(
        this.storageKey(userId),
        JSON.stringify(coordinates)
      );
    } catch {
      // Ignore local cache failures and keep geolocation best-effort.
    }
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
    } catch (error) {
      if (this.isIneligibleRegionError(error)) {
        if (!this.blockedUserIds.has(userId)) {
          this.blockedUserIds.add(userId);
          this.dialogStore.openInfo(this.resolveIneligibleRegionMessage(error), {
            title: AppLocationService.ACCESS_RESTRICTED_TITLE,
            confirmLabel: 'OK',
            allowBackdropClose: false,
            allowEscapeClose: false,
            onConfirm: async () => {
              await this.sessionService.logout();
              await this.router.navigateByUrl(this.router.url.split('?')[0].startsWith('/admin') ? '/admin' : '/entry');
            }
          });
        }
      }
    } finally {
      this.syncingUserIds.delete(userId);
      if (this.pendingCoordinatesByUserId.has(userId)) {
        void this.flushPendingLocationSync(userId, this.resolveTrackedUser(userId) ?? fallbackUser);
      }
    }
  }

  private async persistCoordinates(userId: string, user: UserDto, coordinates: LocationCoordinates): Promise<void> {
    const users = this.isLocalUserRouteEnabled()
      ? this.injector.get((await import('../../local/source/services/users.service')).LocalUsersService)
      : await this.httpUsersService();
    const savedUser = await users.saveUserProfile({ ...user, locationCoordinates: coordinates });
    if (savedUser?.id?.trim()) {
      this.lastPersistedCoordinatesByUserId.set(
        userId, this.normalizeCoordinates(savedUser.locationCoordinates) ?? coordinates
      );
      this.userProfileStore.setUserProfile(savedUser);
    } else {
      this.lastPersistedCoordinatesByUserId.set(userId, coordinates);
    }
  }

  private isIneligibleRegionError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 403 || error.status === 422);
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
      this.httpUsersServicePromise = import('../../http/services/users.service')
        .then(module => this.injector.get(module.HttpUsersService));
    }
    return this.httpUsersServicePromise;
  }

  private resolveIneligibleRegionMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = typeof error.error?.message === 'string' ? error.error.message.trim() : '';
      if (backendMessage) {
        return backendMessage;
      }
      const topLevelMessage = typeof error.message === 'string' ? error.message.trim() : '';
      if (topLevelMessage) {
        return topLevelMessage;
      }
    }
    return AppLocationService.ACCESS_RESTRICTED_MESSAGE;
  }

  private storageKey(userId: string): string {
    return appLocationStorageKey(userId);
  }
}
