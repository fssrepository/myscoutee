import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, computed, effect, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppContext, HelpCenterService } from '../../../shared/core';
import type { HelpCenterRevision, HelpCenterSection } from '../../../shared/core/base/models';
import { NavigatorService } from '../../navigator.service';

@Component({
  selector: 'app-navigator-privacy-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './navigator-privacy-popup.component.html',
  styleUrl: './navigator-privacy-popup.component.scss'
})
export class NavigatorPrivacyPopupComponent {
  private readonly helpCenter = inject(HelpCenterService);
  private readonly appCtx = inject(AppContext);
  private readonly navigatorService = inject(NavigatorService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly activeRevision = this.helpCenter.activePrivacyRevision;
  protected readonly activeUserId = this.appCtx.activeUserId;
  protected readonly sections = computed<HelpCenterSection[]>(() => this.activeRevision()?.sections ?? []);
  protected readonly defaultPrivacyDescription = APP_STATIC_DATA.defaultPrivacyCenterDescription;
  protected openAccordionSectionId = '';
  protected approvedSectionIds = new Set<string>();
  protected loading = false;
  protected savingConsent = false;
  protected consentSaveMessage = '';
  protected consentSaveError = '';
  protected consentLoadPending = false;
  protected activeRevisionConsentSaved = false;
  private loadedApprovedSectionIds = new Set<string>();
  private consentLoadedForKey = '';
  private consentLoadToken = 0;

  constructor() {
    this.loading = this.helpCenter.privacyState() === null;
    if (this.loading) {
      void this.loadPrivacy();
    }
    effect(() => {
      const sections = this.sections();
      const revision = this.activeRevision();
      const userId = this.activeUserId().trim();
      this.syncConsentForRevision(sections, revision, userId);
      if (sections.length === 0) {
        this.openAccordionSectionId = '';
        return;
      }
      if (!this.openAccordionSectionId || !sections.some(section => section.id === this.openAccordionSectionId)) {
        this.openAccordionSectionId = sections[0].id;
      }
    });
  }

  protected toggleAccordionSection(sectionId: string, event?: Event): void {
    event?.stopPropagation();
    this.openAccordionSectionId = this.openAccordionSectionId === sectionId ? '' : sectionId;
  }

  protected toggleSectionApproval(section: HelpCenterSection, event?: Event): void {
    event?.preventDefault();
    this.stopNestedAccordionEvent(event);
    if (!this.isSectionOptional(section)) {
      return;
    }
    const next = new Set(this.approvedSectionIds);
    if (next.has(section.id)) {
      next.delete(section.id);
    } else {
      next.add(section.id);
    }
    this.approvedSectionIds = next;
    this.consentSaveMessage = '';
    this.consentSaveError = '';
  }

  protected stopNestedAccordionEvent(event?: Event): void {
    event?.stopPropagation();
    event?.stopImmediatePropagation();
  }

  protected isSectionApproved(sectionId: string): boolean {
    return this.approvedSectionIds.has(sectionId);
  }

  protected isSectionOptional(section: HelpCenterSection): boolean {
    return section.optional === true;
  }

  protected hasOptionalSections(): boolean {
    return this.sections().some(section => this.isSectionOptional(section));
  }

  protected shouldShowPrivacySaveAction(): boolean {
    if (!this.activeRevision() || !this.activeUserId().trim()) {
      return false;
    }
    if (this.hasOptionalSections() && this.hasPrivacyChoiceChanges()) {
      return true;
    }
    if (this.activeRevisionConsentSaved) {
      return false;
    }
    if (this.navigatorService.privacyConsentRequired()) {
      return true;
    }
    return !this.consentLoadPending;
  }

  protected canSavePrivacyChoices(): boolean {
    return this.shouldShowPrivacySaveAction()
      && !this.loading
      && (!this.consentLoadPending || this.navigatorService.privacyConsentRequired())
      && !this.savingConsent;
  }

  protected privacySaveButtonLabel(): string {
    if (this.savingConsent) {
      return 'Saving...';
    }
    if (this.navigatorService.privacyConsentRequired() || !this.activeRevisionConsentSaved) {
      return 'Approve privacy';
    }
    return 'Save choices';
  }

  protected async savePrivacyChoices(): Promise<void> {
    const revision = this.activeRevision();
    const userId = this.activeUserId().trim();
    if (!revision || !userId || this.savingConsent) {
      return;
    }
    this.savingConsent = true;
    const revisionKey = this.privacyConsentKey(userId, revision);
    this.consentLoadToken += 1;
    this.consentLoadPending = false;
    this.consentSaveMessage = '';
    this.consentSaveError = '';
    try {
      const consent = await this.helpCenter.savePrivacyConsent({
        userId,
        revisionId: revision.id,
        revisionVersion: revision.version,
        approvedOptionalSectionIds: this.approvedOptionalSectionIds(),
        source: 'settings'
      });
      this.approvedSectionIds = new Set(consent.approvedOptionalSectionIds);
      this.loadedApprovedSectionIds = new Set(consent.approvedOptionalSectionIds);
      this.consentLoadedForKey = revisionKey;
      this.activeRevisionConsentSaved = this.isPrivacyConsentCurrent(consent, revision);
      if (!this.activeRevisionConsentSaved) {
        this.consentSaveError = 'Privacy approval could not be saved.';
        return;
      }
      this.navigatorService.markActivePrivacyConsentApproved();
      this.navigatorService.closeSettingsPopup();
    } catch {
      this.activeRevisionConsentSaved = false;
      this.consentSaveError = 'Privacy approval could not be saved.';
    } finally {
      this.savingConsent = false;
      this.repaint();
    }
  }

  protected onAccordionKeydown(sectionId: string, event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.toggleAccordionSection(sectionId, event);
  }

  private async loadPrivacy(): Promise<void> {
    try {
      await this.helpCenter.preload('privacy');
    } finally {
      this.loading = false;
      this.repaint();
    }
  }

  private syncConsentForRevision(
    sections: readonly HelpCenterSection[],
    revision: HelpCenterRevision | null,
    userId: string
  ): void {
    const optionalSectionIds = this.optionalSectionIds(sections);
    const revisionKey = revision && userId ? this.privacyConsentKey(userId, revision) : '';
    if (!revisionKey) {
      this.consentLoadedForKey = '';
      this.consentLoadPending = false;
      this.activeRevisionConsentSaved = false;
      this.loadedApprovedSectionIds = new Set();
      this.approvedSectionIds = this.filteredApprovedSectionIds(optionalSectionIds);
      return;
    }
    if (!revision) {
      return;
    }
    if (this.consentLoadedForKey === revisionKey) {
      this.approvedSectionIds = new Set(
        Array.from(this.loadedApprovedSectionIds).filter(sectionId => optionalSectionIds.has(sectionId))
      );
      return;
    }
    this.consentLoadedForKey = revisionKey;
    const loadToken = ++this.consentLoadToken;
    const revisionId = revision.id;
    this.consentLoadPending = true;
    this.activeRevisionConsentSaved = false;
    this.consentSaveMessage = '';
    this.consentSaveError = '';
    void this.helpCenter.loadPrivacyConsent(userId, revisionId, revision.version)
      .then(consent => {
        if (loadToken !== this.consentLoadToken || this.consentLoadedForKey !== revisionKey) {
          return;
        }
        this.consentLoadPending = false;
        this.activeRevisionConsentSaved = this.isPrivacyConsentCurrent(consent, revision);
        if (this.activeRevisionConsentSaved) {
          this.navigatorService.markActivePrivacyConsentApproved();
        }
        const approvedIds = new Set(
          (consent?.approvedOptionalSectionIds ?? []).filter(sectionId => optionalSectionIds.has(sectionId))
        );
        this.loadedApprovedSectionIds = new Set(approvedIds);
        this.approvedSectionIds = approvedIds;
        this.repaint();
      })
      .catch(() => {
        if (loadToken !== this.consentLoadToken || this.consentLoadedForKey !== revisionKey) {
          return;
        }
        this.consentLoadPending = false;
        this.activeRevisionConsentSaved = false;
        this.loadedApprovedSectionIds = new Set();
        this.approvedSectionIds = new Set();
        this.consentSaveError = 'Privacy choices could not be loaded.';
        this.repaint();
      });
  }

  private approvedOptionalSectionIds(): string[] {
    const optionalSectionIds = this.optionalSectionIds(this.sections());
    return Array.from(this.approvedSectionIds)
      .filter(sectionId => optionalSectionIds.has(sectionId))
      .sort();
  }

  private optionalSectionIds(sections: readonly HelpCenterSection[]): Set<string> {
    return new Set(
      sections.filter(section => this.isSectionOptional(section)).map(section => section.id)
    );
  }

  private filteredApprovedSectionIds(optionalSectionIds: ReadonlySet<string>): Set<string> {
    return new Set(
      Array.from(this.approvedSectionIds).filter(sectionId => optionalSectionIds.has(sectionId))
    );
  }

  private hasPrivacyChoiceChanges(): boolean {
    const optionalSectionIds = this.optionalSectionIds(this.sections());
    const currentIds = this.sortedFilteredIds(this.approvedSectionIds, optionalSectionIds);
    const loadedIds = this.sortedFilteredIds(this.loadedApprovedSectionIds, optionalSectionIds);
    if (currentIds.length !== loadedIds.length) {
      return true;
    }
    return currentIds.some((sectionId, index) => sectionId !== loadedIds[index]);
  }

  private sortedFilteredIds(source: ReadonlySet<string>, allowedIds: ReadonlySet<string>): string[] {
    return Array.from(source)
      .filter(sectionId => allowedIds.has(sectionId))
      .sort();
  }

  private isPrivacyConsentCurrent(
    consent: { revisionId?: string | null; revisionVersion?: number | null } | null,
    revision: HelpCenterRevision
  ): boolean {
    if (!consent) {
      return false;
    }
    const consentRevisionId = `${consent.revisionId ?? ''}`.trim();
    const consentVersion = Math.trunc(Number(consent.revisionVersion) || 0);
    const currentVersion = Math.trunc(Number(revision.version) || 0);
    return consentRevisionId === revision.id && consentVersion >= currentVersion && currentVersion > 0;
  }

  private privacyConsentKey(userId: string, revision: HelpCenterRevision): string {
    return `${userId.trim()}::${revision.id}:v${revision.version}`;
  }

  private repaint(): void {
    try {
      this.cdr.detectChanges();
    } catch {
      // The popup may have closed before an async consent request resolves.
    }
  }
}
