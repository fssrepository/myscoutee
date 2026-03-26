import { Injectable } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import type { UserByIdQueryResponse } from '../interfaces/user.interface';

interface CachedTicketPagePayload {
  items: readonly AppTypes.ActivityListRow[];
  total: number;
  updatedAtIso: string;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineCacheService {
  private static readonly STORAGE_PREFIX = 'myscoutee.offline.v1';

  readUser(userId: string): UserByIdQueryResponse | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const parsed = this.readJson<UserByIdQueryResponse>(this.userStorageKey(normalizedUserId));
    return parsed ? this.clone(parsed) : null;
  }

  writeUser(userId: string, response: UserByIdQueryResponse): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || !response.user) {
      return;
    }
    this.writeJson(this.userStorageKey(normalizedUserId), this.clone(response));
  }

  readTicketPage(userId: string, order: 'upcoming' | 'past'): CachedTicketPagePayload | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const parsed = this.readJson<CachedTicketPagePayload>(this.ticketStorageKey(normalizedUserId, order));
    return parsed ? this.clone(parsed) : null;
  }

  writeTicketPage(
    userId: string,
    order: 'upcoming' | 'past',
    payload: { items: readonly AppTypes.ActivityListRow[]; total: number }
  ): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this.writeJson(this.ticketStorageKey(normalizedUserId, order), {
      items: this.clone(payload.items),
      total: Math.max(0, Math.trunc(Number(payload.total) || 0)),
      updatedAtIso: new Date().toISOString()
    } satisfies CachedTicketPagePayload);
  }

  private userStorageKey(userId: string): string {
    return `${OfflineCacheService.STORAGE_PREFIX}:user:${userId}`;
  }

  private ticketStorageKey(userId: string, order: 'upcoming' | 'past'): string {
    return `${OfflineCacheService.STORAGE_PREFIX}:tickets:${userId}:${order}`;
  }

  private readJson<T>(key: string): T | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private writeJson(key: string, value: unknown): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage quota failures and keep runtime state resilient.
    }
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
