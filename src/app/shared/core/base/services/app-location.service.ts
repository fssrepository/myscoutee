import { Injectable, effect, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import { HttpUsersService } from '../../http';
import { AppContext } from '../context';
import type { LocationCoordinates } from '../interfaces/location.interface';
import type { UserDto } from '../interfaces/user.interface';
import { UsersService } from './users.service';
import { SessionService } from './session.service';
import { ConfirmationDialogService } from '../../../ui/services/confirmation-dialog.service';

@Injectable({
  providedIn: 'root'
})
export class AppLocationService {
  private static readonly STORAGE_PREFIX = 'myscoutee.location';
  private static readonly ACCESS_RESTRICTED_TITLE = 'Login Unavailable';
  private static readonly ACCESS_RESTRICTED_MESSAGE = 'Login is currently unavailable from your country or region for security reasons. Please come back later.';
  private static readonly LOCATION_SYNC_DISTANCE_METERS = 5000;

  private readonly appCtx = inject(AppContext);
  private readonly router = inject(Router);
  private readonly httpUsersService = inject(HttpUsersService);
  private readonly usersService = inject(UsersService);
  private readonly sessionService = inject(SessionService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly syncingUserIds = new Set<string>();
  private readonly blockedUserIds = new Set<string>();
  private readonly pendingCoordinatesByUserId = new Map<string, LocationCoordinates>();
  private readonly lastPersistedCoordinatesByUserId = new Map<string, LocationCoordinates>();
  private geolocationWatchId: number | null = null;
  private geolocationWatchUserId = '';
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    effect(() => {
      const activeUserId = this.appCtx.activeUserId().trim();
      if (!activeUserId) {
        this.stopCoordinateWatch();
        return;
      }

      const activeUser = this.resolveTrackedUser(activeUserId);
      if (!activeUser) {
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

    const activeUser = this.appCtx.activeUserProfile();
    if (activeUser?.id?.trim() === normalizedUserId) {
      return activeUser;
    }

    const cachedUser = this.appCtx.getUserProfile(normalizedUserId);
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
    this.appCtx.setUserProfile(bootstrapUser);
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
      profileStatus: 'public',
      activities: {
        game: 0,
        chat: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        tickets: 0,
        feedback: 0
      }
    };
  }

  private runLocationSyncFlow(userId: string, activeUser: UserDto): void {
    if (!activeUser?.id?.trim()) {
      return;
    }

    this.primePersistedCoordinates(userId, activeUser.locationCoordinates);

    const stored = this.readStoredCoordinates(userId);
    if (stored && !this.sameCoordinates(activeUser.locationCoordinates, stored)) {
      this.appCtx.setUserProfile({
        ...activeUser,
        locationCoordinates: stored
      });
    }

    const effectiveCoordinates = stored ?? activeUser.locationCoordinates;
    if (effectiveCoordinates) {
      this.queueLocationSyncForActiveUser(userId, activeUser, effectiveCoordinates);
    }

    this.ensureCoordinateWatch(userId);
  }

  private ensureCoordinateWatch(userId: string): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

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
      () => undefined,
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
    this.storeCoordinates(userId, coordinates);

    const activeUser = this.resolveTrackedUser(userId);
    if (!activeUser?.id?.trim()) {
      return;
    }

    this.appCtx.setUserProfile({
      ...activeUser,
      locationCoordinates: coordinates
    });
    this.queueLocationSyncForActiveUser(userId, activeUser, coordinates);
  }

  private readStoredCoordinates(userId: string): LocationCoordinates | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const raw = localStorage.getItem(`${AppLocationService.STORAGE_PREFIX}:${userId}`);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<LocationCoordinates>;
      if (!Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) {
        return null;
      }
      return {
        latitude: Number(parsed.latitude),
        longitude: Number(parsed.longitude)
      };
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
        `${AppLocationService.STORAGE_PREFIX}:${userId}`,
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
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
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
    if (this.lastPersistedCoordinatesByUserId.has(userId)) {
      return;
    }
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
    if (this.usersService.demoModeEnabled || !activeUser?.id?.trim() || !normalizedCoordinates) {
      return;
    }

    this.pendingCoordinatesByUserId.set(userId, normalizedCoordinates);
    if (this.syncingUserIds.has(userId)) {
      return;
    }

    void this.flushPendingLocationSync(userId, activeUser);
  }

  private async flushPendingLocationSync(
    userId: string,
    fallbackUser: UserDto
  ): Promise<void> {
    if (this.usersService.demoModeEnabled || !fallbackUser?.id?.trim() || this.syncingUserIds.has(userId)) {
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
      const savedUser = await this.httpUsersService.saveUserProfile({
        ...currentUser,
        locationCoordinates: normalizedCoordinates
      });
      if (savedUser?.id?.trim()) {
        this.appCtx.setUserProfile(savedUser);
        this.lastPersistedCoordinatesByUserId.set(
          userId,
          this.normalizeCoordinates(savedUser.locationCoordinates) ?? normalizedCoordinates
        );
      } else {
        this.lastPersistedCoordinatesByUserId.set(userId, normalizedCoordinates);
      }
    } catch (error) {
      if (this.isIneligibleRegionError(error)) {
        if (!this.blockedUserIds.has(userId)) {
          this.blockedUserIds.add(userId);
          this.confirmationDialogService.openInfo(this.resolveIneligibleRegionMessage(error), {
            title: AppLocationService.ACCESS_RESTRICTED_TITLE,
            confirmLabel: 'OK',
            allowBackdropClose: false,
            allowEscapeClose: false,
            onConfirm: async () => {
              await this.sessionService.logout();
              await this.router.navigateByUrl('/entry');
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

  private isIneligibleRegionError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 403 || error.status === 422);
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
}
