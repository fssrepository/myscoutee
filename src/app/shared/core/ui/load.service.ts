import { Injectable, computed, signal } from '@angular/core';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error' | 'timeout';

export interface LoadState {
  status: LoadStatus;
  error: string | null;
  loadedAtIso: string | null;
}

const DEFAULT_LOAD_STATE: LoadState = {
  status: 'idle',
  error: null,
  loadedAtIso: null
};

@Injectable({
  providedIn: 'root'
})
export class LoadService {
  private readonly _states = signal<Record<string, LoadState>>({});

  readonly states = this._states.asReadonly();

  selectState(contextKey: string) {
    return computed(() => this._states()[contextKey] ?? DEFAULT_LOAD_STATE);
  }

  setStatus(contextKey: string, status: LoadStatus, message?: string): LoadState {
    const current = this._states()[contextKey] ?? DEFAULT_LOAD_STATE;
    const next: LoadState = {
      status,
      error: message ?? (status === 'loading' || status === 'success' ? null : current.error),
      loadedAtIso: status === 'success' ? new Date().toISOString() : current.loadedAtIso
    };
    this._states.update(states => ({
      ...states,
      [contextKey]: next
    }));
    return next;
  }
}
