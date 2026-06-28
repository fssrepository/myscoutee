import { Injectable, computed, inject, signal } from '@angular/core';

import type {
  EntryConsentStateDto,
  HelpCenterRevisionDto,
  HelpCenterSectionDto,
  HelpCenterStateDto,
  PrivacyConsentDto,
  PrivacyConsentSaveRequestDto
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
  private static readonly ENTRY_CONSENT_KEY = APP_STORAGE_KEYS.entryConsent;
  private static readonly OPTIONAL_PRIVACY_APPROVAL_KEY = APP_STORAGE_KEYS.optionalPrivacyApprovals;

  private readonly helpCenter = inject(HelpCenterService);
  private readonly loadingRef = signal(false);

  readonly loading = this.loadingRef.asReadonly();
  readonly state = this.helpCenter.privacyState;
  readonly activeRevision = computed<HelpCenterRevisionDto | null>(() => this.helpCenter.activePrivacyRevision());
  readonly hasActiveRevision = computed(() => Boolean(this.activeRevision()));
  readonly activeVersionLabel = this.helpCenter.activePrivacyVersionLabel;

  async prepareOpen(options: PrivacyPolicyOpenOptions = {}): Promise<HelpCenterRevisionDto | null> {
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

  applyState(state: HelpCenterStateDto): void {
    this.helpCenter.applyState('privacy', state);
  }

  async loadConsent(userId: string, revisionId: string, revisionVersion?: number): Promise<PrivacyConsentDto | null> {
    return this.helpCenter.loadPrivacyConsent(userId, revisionId, revisionVersion);
  }

  async saveConsent(request: PrivacyConsentSaveRequestDto): Promise<PrivacyConsentDto> {
    return this.helpCenter.savePrivacyConsent(request);
  }

  async syncAnonymousEntryConsent(userId: string, revision: HelpCenterRevisionDto): Promise<boolean> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || !this.loadAnonymousEntryConsent(revision)) {
      return false;
    }
    await this.saveConsent({
      userId: normalizedUserId,
      revisionId: revision.id,
      revisionVersion: revision.version,
      approvedOptionalSectionIds: Array.from(this.loadEntryOptionalApprovals(revision)).sort(),
      source: 'entry'
    });
    return true;
  }

  loadEntryOptionalApprovals(revision: HelpCenterRevisionDto): Set<string> {
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

  saveEntryOptionalApprovals(revision: HelpCenterRevisionDto, approvedSectionIds: readonly string[]): void {
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

  revisionKey(revision: HelpCenterRevisionDto): string {
    return `${revision.id}:v${revision.version}`;
  }

  private loadAnonymousEntryConsent(revision: HelpCenterRevisionDto): EntryConsentStateDto | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(PrivacyPolicyService.ENTRY_CONSENT_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<EntryConsentStateDto>;
      if (
        parsed.version !== this.entryConsentVersion(revision) ||
        parsed.accepted !== true ||
        typeof parsed.acceptedAtIso !== 'string' ||
        parsed.acceptedAtIso.trim().length === 0
      ) {
        return null;
      }
      return {
        version: parsed.version,
        accepted: true,
        acceptedAtIso: parsed.acceptedAtIso
      };
    } catch {
      return null;
    }
  }

  private entryConsentVersion(revision: HelpCenterRevisionDto): string {
    return `privacy:${this.revisionKey(revision)}`;
  }

  private optionalSectionIds(sections: readonly HelpCenterSectionDto[]): Set<string> {
    return new Set(
      sections
        .filter(section => section.optional === true)
        .map(section => section.id)
    );
  }
}
