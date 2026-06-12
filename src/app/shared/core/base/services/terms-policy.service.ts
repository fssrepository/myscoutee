import { Injectable, computed, inject, signal } from '@angular/core';

import type {
  HelpCenterRevision,
  HelpCenterState
} from '../models';
import { HelpCenterService } from './help-center.service';

export interface TermsPolicyOpenOptions {
  lazy?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TermsPolicyService {
  private readonly helpCenter = inject(HelpCenterService);
  private readonly loadingRef = signal(false);

  readonly loading = this.loadingRef.asReadonly();
  readonly state = this.helpCenter.termsState;
  readonly activeRevision = computed<HelpCenterRevision | null>(() => this.helpCenter.activeTermsRevision());
  readonly hasActiveRevision = computed(() => Boolean(this.activeRevision()));
  readonly activeVersionLabel = this.helpCenter.activeTermsVersionLabel;

  async prepareOpen(options: TermsPolicyOpenOptions = {}): Promise<HelpCenterRevision | null> {
    const lazy = options.lazy !== false;
    const current = this.activeRevision();
    if (current || !lazy) {
      return current;
    }
    this.loadingRef.set(true);
    try {
      await this.helpCenter.preload('terms');
      return this.activeRevision();
    } finally {
      this.loadingRef.set(false);
    }
  }

  applyState(state: HelpCenterState): void {
    this.helpCenter.applyState('terms', state);
  }
}
