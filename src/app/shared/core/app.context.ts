import { Injectable, computed, signal } from '@angular/core';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error' | 'timeout';

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

@Injectable({
  providedIn: 'root'
})
export class AppContext {
  private readonly _loadingState = signal<Record<string, LoadState>>({});

  readonly loadingState = this._loadingState.asReadonly();

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
}
