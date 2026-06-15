import { Injectable, computed, inject, signal } from '@angular/core';

import type {
  HelpCenterRevision,
  HelpCenterSection,
  HelpCenterState,
  PrivacyConsentRecord,
  PrivacyConsentSaveRequest
} from '../../contracts';
import { APP_STORAGE_KEYS } from '../../common/storage-scope';
import { HelpCenterService } from './help-center.service';

export interface PrivacyPolicyOpenOptions {
  lazy?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PrivacyPolicyService {
  private static readonly OPTIONAL_PRIVACY_APPROVAL_KEY = APP_STORAGE_KEYS.optionalPrivacyApprovals;

  private readonly helpCenter = inject(HelpCenterService);
  private readonly loadingRef = signal(false);

  readonly loading = this.loadingRef.asReadonly();
  readonly state = this.helpCenter.privacyState;
  readonly activeRevision = computed<HelpCenterRevision | null>(() => this.helpCenter.activePrivacyRevision());
  readonly hasActiveRevision = computed(() => Boolean(this.activeRevision()));
  readonly activeVersionLabel = this.helpCenter.activePrivacyVersionLabel;

  async prepareOpen(options: PrivacyPolicyOpenOptions = {}): Promise<HelpCenterRevision | null> {
    const lazy = options.lazy !== false;
    const current = this.activeRevision();
    if (current || !lazy) {
      return current;
    }
    this.loadingRef.set(true);
    try {
      await this.helpCenter.preload('privacy');
      return this.activeRevision();
    } finally {
      this.loadingRef.set(false);
    }
  }

  applyState(state: HelpCenterState): void {
    this.helpCenter.applyState('privacy', state);
  }

  async loadConsent(userId: string, revisionId: string, revisionVersion?: number): Promise<PrivacyConsentRecord | null> {
    return this.helpCenter.loadPrivacyConsent(userId, revisionId, revisionVersion);
  }

  async saveConsent(request: PrivacyConsentSaveRequest): Promise<PrivacyConsentRecord> {
    return this.helpCenter.savePrivacyConsent(request);
  }

  loadEntryOptionalApprovals(revision: HelpCenterRevision): Set<string> {
    if (typeof localStorage === 'undefined') {
      return new Set();
    }
    try {
      const raw = localStorage.getItem(PrivacyPolicyService.OPTIONAL_PRIVACY_APPROVAL_KEY);
      const parsed = raw ? JSON.parse(raw) as { revisionKey?: unknown; approvedSectionIds?: unknown } : null;
      if (!parsed || parsed.revisionKey !== this.revisionKey(revision) || !Array.isArray(parsed.approvedSectionIds)) {
        return new Set();
      }
      const optionalSectionIds = this.optionalSectionIds(revision.sections);
      return new Set(
        parsed.approvedSectionIds
          .map(sectionId => `${sectionId ?? ''}`.trim())
          .filter(sectionId => optionalSectionIds.has(sectionId))
      );
    } catch {
      return new Set();
    }
  }

  saveEntryOptionalApprovals(revision: HelpCenterRevision, approvedSectionIds: readonly string[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const optionalSectionIds = this.optionalSectionIds(revision.sections);
    const normalizedIds = Array.from(new Set(
      approvedSectionIds
        .map(sectionId => `${sectionId ?? ''}`.trim())
        .filter(sectionId => optionalSectionIds.has(sectionId))
    )).sort();
    localStorage.setItem(PrivacyPolicyService.OPTIONAL_PRIVACY_APPROVAL_KEY, JSON.stringify({
      revisionKey: this.revisionKey(revision),
      approvedSectionIds: normalizedIds
    }));
  }

  revisionKey(revision: HelpCenterRevision): string {
    return `${revision.id}:v${revision.version}`;
  }

  private optionalSectionIds(sections: readonly HelpCenterSection[]): Set<string> {
    return new Set(
      sections
        .filter(section => section.optional === true)
        .map(section => section.id)
    );
  }
}
