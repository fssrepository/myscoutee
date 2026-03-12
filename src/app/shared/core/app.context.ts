import { Injectable, computed, signal } from '@angular/core';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error' | 'timeout';
export type ActivityCounterKey = 'game' | 'chat' | 'invitations' | 'events' | 'hosting';

export interface ActivityCounters {
  game: number;
  chat: number;
  invitations: number;
  events: number;
  hosting: number;
}

export interface LoadState {
  status: LoadStatus;
  error: string | null;
  loadedAtIso: string | null;
}

export const DEFAULT_LOAD_STATE: LoadState = {
  status: 'idle',
  error: null,
  loadedAtIso: null
};

const ACTIVITY_COUNTER_KEYS: ActivityCounterKey[] = ['game', 'chat', 'invitations', 'events', 'hosting'];

@Injectable({
  providedIn: 'root'
})
export class AppContext {
  private readonly _loadingState = signal<Record<string, LoadState>>({});
  private readonly _counterOverridesByUserId = signal<Record<string, Partial<ActivityCounters>>>({});

  readonly loadingState = this._loadingState.asReadonly();
  readonly counterOverridesByUserId = this._counterOverridesByUserId.asReadonly();

  selectLoadingState(contextKey: string) {
    return computed(() => this._loadingState()[contextKey] ?? DEFAULT_LOAD_STATE);
  }

  getLoadingState(contextKey: string): LoadState {
    return this._loadingState()[contextKey] ?? DEFAULT_LOAD_STATE;
  }

  setLoadingState(contextKey: string, next: LoadState): void {
    this._loadingState.update(state => ({
      ...state,
      [contextKey]: next
    }));
  }

  setStatus(contextKey: string, status: LoadStatus, message?: string): LoadState {
    const current = this.getLoadingState(contextKey);
    const next: LoadState = {
      status,
      error: message ?? (status === 'loading' || status === 'success' ? null : current.error),
      loadedAtIso: status === 'success' ? new Date().toISOString() : current.loadedAtIso
    };
    this.setLoadingState(contextKey, next);
    return next;
  }

  getUserCounterOverride(userId: string, key: ActivityCounterKey): number | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const value = this._counterOverridesByUserId()[normalizedUserId]?.[key];
    if (!Number.isFinite(value)) {
      return null;
    }
    return this.normalizeCounterValue(value as number);
  }

  getUserCounterOverrides(userId: string): Partial<ActivityCounters> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return {};
    }
    const overrides = this._counterOverridesByUserId()[normalizedUserId];
    if (!overrides) {
      return {};
    }
    return { ...overrides };
  }

  setUserCounterOverride(userId: string, key: ActivityCounterKey, value: number): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const normalizedValue = this.normalizeCounterValue(value);
    this._counterOverridesByUserId.update(state => ({
      ...state,
      [normalizedUserId]: {
        ...(state[normalizedUserId] ?? {}),
        [key]: normalizedValue
      }
    }));
  }

  patchUserCounterOverrides(userId: string, patch: Partial<ActivityCounters>): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const normalizedPatch: Partial<ActivityCounters> = {};
    for (const key of ACTIVITY_COUNTER_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) {
        continue;
      }
      const value = patch[key];
      if (!Number.isFinite(value)) {
        continue;
      }
      normalizedPatch[key] = this.normalizeCounterValue(value as number);
    }
    if (Object.keys(normalizedPatch).length === 0) {
      return;
    }
    this._counterOverridesByUserId.update(state => ({
      ...state,
      [normalizedUserId]: {
        ...(state[normalizedUserId] ?? {}),
        ...normalizedPatch
      }
    }));
  }

  clearUserCounterOverrides(userId: string, keys?: ActivityCounterKey[]): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this._counterOverridesByUserId.update(state => {
      const current = state[normalizedUserId];
      if (!current) {
        return state;
      }
      if (!keys || keys.length === 0) {
        const { [normalizedUserId]: _removed, ...rest } = state;
        return rest;
      }
      const next = { ...current };
      for (const key of keys) {
        delete next[key];
      }
      if (Object.keys(next).length === 0) {
        const { [normalizedUserId]: _removed, ...rest } = state;
        return rest;
      }
      return {
        ...state,
        [normalizedUserId]: next
      };
    });
  }

  resolveUserCounter(userId: string, key: ActivityCounterKey, fallbackValue: number): number {
    const override = this.getUserCounterOverride(userId, key);
    if (override !== null) {
      return override;
    }
    return this.normalizeCounterValue(fallbackValue);
  }

  private normalizeCounterValue(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }
}
