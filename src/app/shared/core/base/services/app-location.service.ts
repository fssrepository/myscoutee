import { Injectable, effect, inject } from '@angular/core';

import { AppContext } from '../context';
import type { LocationCoordinates } from '../interfaces/location.interface';

@Injectable({
  providedIn: 'root'
})
export class AppLocationService {
  private static readonly STORAGE_PREFIX = 'myscoutee.location';

  private readonly appCtx = inject(AppContext);
  private readonly requestedUsers = new Set<string>();
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    effect(() => {
      const activeUserId = this.appCtx.activeUserId().trim();
      const activeUser = this.appCtx.activeUserProfile();
      if (!activeUserId) {
        return;
      }

      const stored = this.readStoredCoordinates(activeUserId);
      if (stored && activeUser && !this.sameCoordinates(activeUser.locationCoordinates, stored)) {
        this.appCtx.setUserProfile({
          ...activeUser,
          locationCoordinates: stored
        });
      }

      if (this.requestedUsers.has(activeUserId)) {
        return;
      }
      this.requestedUsers.add(activeUserId);
      this.requestCoordinates(activeUserId);
    });
  }

  private requestCoordinates(userId: string): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        const coordinates: LocationCoordinates = {
          latitude: Number(position.coords.latitude),
          longitude: Number(position.coords.longitude)
        };
        if (!Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) {
          return;
        }
        this.storeCoordinates(userId, coordinates);
        const activeUser = this.appCtx.activeUserProfile();
        if (activeUser?.id?.trim() !== userId) {
          return;
        }
        this.appCtx.setUserProfile({
          ...activeUser,
          locationCoordinates: coordinates
        });
      },
      () => undefined,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5 * 60 * 1000
      }
    );
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
}
