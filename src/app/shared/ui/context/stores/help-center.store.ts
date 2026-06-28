import { Injectable, computed, signal } from '@angular/core';

import type { HelpCenterStateDto } from '../../../core/contracts';
import { cloneHelpCenterRevision, cloneHelpCenterState } from './app-context-store.utils';

@Injectable({
  providedIn: 'root'
})
export class HelpCenterStore {
  private readonly _privacyState = signal<HelpCenterStateDto | null>(null);

  readonly privacyState = this._privacyState.asReadonly();
  readonly activePrivacyRevision = computed(() => {
    const revision = this._privacyState()?.activeRevision ?? null;
    return revision ? cloneHelpCenterRevision(revision) : null;
  });

  setPrivacyState(state: HelpCenterStateDto | null): void {
    this._privacyState.set(state ? cloneHelpCenterState(state) : null);
  }
}
