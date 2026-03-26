import { Injectable } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import type { EventFeedbackPersistedState } from '../models/event.model';
import type { UserByIdQueryResponse, UserDto } from '../interfaces/user.interface';

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
    this.rememberKnownUserId(normalizedUserId);
  }

  readKnownUsers(): UserDto[] {
    const userIds = this.readJson<string[]>(this.knownUsersStorageKey()) ?? [];
    const seen = new Set<string>();
    const users: UserDto[] = [];
    for (const rawUserId of userIds) {
      const normalizedUserId = `${rawUserId ?? ''}`.trim();
      if (!normalizedUserId || seen.has(normalizedUserId)) {
        continue;
      }
      seen.add(normalizedUserId);
      const cached = this.readUser(normalizedUserId);
      if (!cached?.user) {
        continue;
      }
      users.push(this.clone(cached.user));
    }
    return users;
  }

  readEventFeedbackStates(userId: string): EventFeedbackPersistedState[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const parsed = this.readJson<EventFeedbackPersistedState[]>(this.eventFeedbackStorageKey(normalizedUserId));
    if (!Array.isArray(parsed)) {
      return [];
    }
    return this.clone(parsed);
  }

  writeEventFeedbackStates(userId: string, states: readonly EventFeedbackPersistedState[]): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this.writeJson(
      this.eventFeedbackStorageKey(normalizedUserId),
      this.clone(states.map(state => ({
        ...state,
        answersByCardId: { ...(state.answersByCardId ?? {}) }
      } satisfies EventFeedbackPersistedState)))
    );
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

  private knownUsersStorageKey(): string {
    return `${OfflineCacheService.STORAGE_PREFIX}:users:index`;
  }

  private eventFeedbackStorageKey(userId: string): string {
    return `${OfflineCacheService.STORAGE_PREFIX}:event-feedback:${userId}`;
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

  private rememberKnownUserId(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const current = this.readJson<string[]>(this.knownUsersStorageKey()) ?? [];
    if (current.includes(normalizedUserId)) {
      return;
    }
    this.writeJson(this.knownUsersStorageKey(), [...current, normalizedUserId]);
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
