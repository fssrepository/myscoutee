import { Injectable } from '@angular/core';

import type * as AssetContracts from '../../contracts/asset.interface';
import type { UserByIdQueryResponse } from '../../contracts/user.interface';
import { offlineCacheTicketsStorageKey, offlineCacheUserStorageKey } from '../../common/storage-scope';
import { isPublicMediaUrl } from '../../common/public-media';

interface CachedTicketPagePayload {
  items: readonly AssetContracts.AssetTicketDTO[];
  total: number;
  updatedAtIso: string;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineCacheService {
  private readonly revokedUsers = new Set<string>();

  activateUser(userId: string): void {
    this.revokedUsers.delete(userId.trim());
  }

  async clearUser(userId: string): Promise<void> {
    const id = userId.trim();
    if (!id) return;
    // Synchronous revocation also prevents a late poll from repopulating data.
    this.revokedUsers.add(id);
    if (typeof localStorage !== 'undefined') {
      for (const key of [this.userStorageKey(id), this.ticketStorageKey(id, 'upcoming'), this.ticketStorageKey(id, 'past')]) {
        localStorage.removeItem(key);
      }
    }
    if (typeof caches === 'undefined') return;
    for (const name of (await caches.keys()).filter(name => name.startsWith('myscoutee-runtime-'))) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      await Promise.all(requests.filter(request => {
        const path = new URL(request.url).pathname;
        return path.startsWith('/api/auth/me')
          || (name.includes('-media-') && !path.startsWith('/assets/') && !isPublicMediaUrl(new URL(request.url)));
      }).map(request => cache.delete(request)));
    }
  }

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
    if (!normalizedUserId || this.revokedUsers.has(normalizedUserId) || !response.user) {
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
    payload: { items: readonly AssetContracts.AssetTicketDTO[]; total: number }
  ): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || this.revokedUsers.has(normalizedUserId)) {
      return;
    }
    this.writeJson(this.ticketStorageKey(normalizedUserId, order), {
      items: this.clone(payload.items),
      total: Math.max(0, Math.trunc(Number(payload.total) || 0)),
      updatedAtIso: new Date().toISOString()
    } satisfies CachedTicketPagePayload);
  }

  private userStorageKey(userId: string): string {
    return offlineCacheUserStorageKey(userId);
  }

  private ticketStorageKey(userId: string, order: 'upcoming' | 'past'): string {
    return offlineCacheTicketsStorageKey(userId, order);
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
