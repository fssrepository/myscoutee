import { Injectable, computed, signal } from '@angular/core';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error' | 'timeout';
export type ConnectivityState = 'online' | 'offline';

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

function detectInitialConnectivityState(): ConnectivityState {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'offline';
  }
  return 'online';
}

@Injectable({
  providedIn: 'root'
})
export class AppRuntimeStore {
  private readonly _loadingState = signal<Record<string, LoadState>>({});
  private readonly _connectivityState = signal<ConnectivityState>(detectInitialConnectivityState());

  readonly loadingState = this._loadingState.asReadonly();
  readonly connectivityState = this._connectivityState.asReadonly();
  readonly isOnline = computed(() => this._connectivityState() === 'online');

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

  resetLoadingState(contextKey: string): void {
    this.setLoadingState(contextKey, { ...DEFAULT_LOAD_STATE });
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

  setConnectivityState(state: ConnectivityState): void {
    this._connectivityState.set(state);
  }

  setOnlineState(isOnline: boolean): void {
    this._connectivityState.set(isOnline ? 'online' : 'offline');
  }
}
