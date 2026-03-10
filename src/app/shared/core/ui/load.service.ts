import { Injectable, inject } from '@angular/core';

import { AppContext, type LoadState, type LoadStatus } from '../app.context';

export type { LoadState, LoadStatus } from '../app.context';

@Injectable({
  providedIn: 'root'
})
export class LoadService {
  private readonly appContext = inject(AppContext);

  selectState(contextKey: string) {
    return this.appContext.selectLoadingState(contextKey);
  }

  setStatus(contextKey: string, status: LoadStatus, message?: string): LoadState {
    const current = this.appContext.getLoadingState(contextKey);
    const next: LoadState = {
      status,
      error: message ?? (status === 'loading' || status === 'success' ? null : current.error),
      loadedAtIso: status === 'success' ? new Date().toISOString() : current.loadedAtIso
    };
    this.appContext.setLoadingState(contextKey, next);
    return next;
  }
}
