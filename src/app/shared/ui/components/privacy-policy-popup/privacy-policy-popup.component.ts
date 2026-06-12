import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, computed, effect, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';

import { APP_STATIC_DATA } from '../../../app-static-data';
import { I18nService, PrivacyPolicyService } from '../../../core';
import type { HelpCenterRevision, HelpCenterSection, PrivacyConsentSource } from '../../../core/base/models';
import { LazyBgImageDirective } from '../../directives';
import { ProgressIndicatorComponent } from '../progress-indicator';

export type PrivacyPolicyShell = 'page' | 'popup';

@Component({
  selector: 'app-privacy-policy-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatRippleModule, LazyBgImageDirective, ProgressIndicatorComponent],
  templateUrl: './privacy-policy-popup.component.html',
  styleUrl: './privacy-policy-popup.component.scss'
})
export class PrivacyPolicyPopupComponent implements OnInit, OnChanges {
  private readonly privacyPolicy = inject(PrivacyPolicyService);
  private readonly i18n = inject(I18nService);

  @Input() open = true;
  @Input() lazy = true;
  @Input() shell: PrivacyPolicyShell = 'page';
  @Input() loading = false;
  @Input() viewOnly = true;
  @Input() approvalRequired = false;
  @Input() source: PrivacyConsentSource = 'entry';
  @Input() allowReject = true;
  @Input() activeUserId = '';

  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly acceptRequested = new EventEmitter<void>();
  @Output() readonly rejectRequested = new EventEmitter<void>();

  protected readonly activeRevision = this.privacyPolicy.activeRevision;
  protected readonly versionLabel = this.privacyPolicy.activeVersionLabel;
  protected readonly serviceLoading = this.privacyPolicy.loading;
  protected readonly sections = computed<HelpCenterSection[]>(() => this.activeRevision()?.sections ?? []);
  protected readonly defaultPrivacyDescription = APP_STATIC_DATA.defaultPrivacyCenterDescription;
  protected openSectionId = '';
  protected approvedSectionIds = new Set<string>();
  protected savingChoices = false;
  protected choiceSaveMessage = '';
  protected choiceSaveError = '';
  protected consentLoadPending = false;
  protected activeRevisionConsentSaved = false;
  private loadedApprovedSectionIds = new Set<string>();
  private optionalApprovalsLoadedForRevision = '';
  private consentLoadedForKey = '';
  private consentLoadToken = 0;

  constructor() {
    effect(() => {
      const sections = this.sections();
      const revision = this.activeRevision();
      this.syncOpenSection(sections);
      this.syncApprovalsForRevision(sections, revision);
    });
  }

  ngOnInit(): void {
    if (this.open) {
      void this.prepareOpen();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['open'] || changes['lazy']) && this.open) {
      void this.prepareOpen();
    }
    if (changes['activeUserId'] || changes['source']) {
      this.syncApprovalsForRevision(this.sections(), this.activeRevision());
    }
  }

  protected effectiveLoading(): boolean {
    return this.loading || this.serviceLoading();
  }

  protected isPopupShell(): boolean {
    return this.shell === 'popup';
  }

  protected canManageChoices(): boolean {
    return this.isPopupShell();
  }

  protected requestClose(): void {
    this.closeRequested.emit();
  }

  protected async requestAccept(): Promise<void> {
    if (!this.canAccept()) {
      return;
    }
    this.savingChoices = true;
    this.choiceSaveMessage = '';
    this.choiceSaveError = '';
    try {
      await this.saveApprovalState();
      this.acceptRequested.emit();
    } catch {
      this.choiceSaveError = this.uiText('Privacy choices could not be saved.');
    } finally {
      this.savingChoices = false;
    }
  }

  protected requestReject(): void {
    this.rejectRequested.emit();
  }

  protected toggleSection(sectionId: string, event?: Event): void {
    event?.stopPropagation();
    this.openSectionId = this.openSectionId === sectionId ? '' : sectionId;
  }

  protected toggleSectionApproval(section: HelpCenterSection, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    event?.stopImmediatePropagation();
    if (!this.canManageChoices() || !this.isSectionOptional(section)) {
      return;
    }
    const next = new Set(this.approvedSectionIds);
    if (next.has(section.id)) {
      next.delete(section.id);
    } else {
      next.add(section.id);
    }
    this.approvedSectionIds = next;
    this.choiceSaveMessage = '';
    this.choiceSaveError = '';
  }

  protected stopNestedEvent(event?: Event): void {
    event?.stopPropagation();
    event?.stopImmediatePropagation();
  }

  protected isSectionOptional(section: HelpCenterSection): boolean {
    return section.optional === true;
  }

  protected isSectionApproved(sectionId: string): boolean {
    return this.approvedSectionIds.has(sectionId);
  }

  protected approvalLabel(sectionId: string): string {
    return this.uiText(
      this.isSectionApproved(sectionId)
        ? 'Optional privacy section approved'
        : 'Approve optional privacy section'
    );
  }

  protected onSectionKeydown(sectionId: string, event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.toggleSection(sectionId, event);
  }

  protected canAccept(): boolean {
    return !this.viewOnly
      && !this.effectiveLoading()
      && Boolean(this.activeRevision())
      && this.sections().length > 0
      && !this.savingChoices;
  }

  protected shouldShowPrivacySaveAction(): boolean {
    if (!this.canManageChoices() || !this.viewOnly || !this.activeRevision()) {
      return false;
    }
    if (this.approvalRequired) {
      return true;
    }
    if (this.source === 'settings' && !this.consentLoadPending && !this.activeRevisionConsentSaved) {
      return true;
    }
    return this.hasOptionalSections() && this.hasPrivacyChoiceChanges();
  }

  protected canSavePrivacyChoices(): boolean {
    return this.shouldShowPrivacySaveAction()
      && !this.effectiveLoading()
      && !this.savingChoices
      && (!this.consentLoadPending || this.approvalRequired);
  }

  protected privacySaveButtonLabel(): string {
    if (this.savingChoices) {
      return this.uiText('Saving...');
    }
    return this.uiText(this.approvalRequired || !this.activeRevisionConsentSaved ? 'Approve privacy' : 'Save choices');
  }

  protected activeSummaryLabel(): string {
    return this.activeRevision()?.summary || this.uiText('Privacy first');
  }

  protected activeDescriptionLabel(): string {
    return this.activeRevision()?.description || this.uiText(this.defaultPrivacyDescription);
  }

  protected headerColorClass(): string {
    return `privacy-policy-popup-header-${this.normalizeHeaderColor(this.activeRevision()?.headerColor)}`;
  }

  protected uiText(value: string): string {
    return this.i18n.translate(value);
  }

  protected async savePrivacyChoices(): Promise<void> {
    if (!this.canSavePrivacyChoices()) {
      return;
    }
    this.savingChoices = true;
    this.choiceSaveMessage = '';
    this.choiceSaveError = '';
    try {
      await this.saveApprovalState();
      this.loadedApprovedSectionIds = new Set(this.approvedOptionalSectionIds());
      this.activeRevisionConsentSaved = this.source === 'settings' || this.activeRevisionConsentSaved;
      this.choiceSaveMessage = this.uiText('Privacy choices saved.');
      if (this.approvalRequired || this.source === 'settings') {
        this.acceptRequested.emit();
      } else {
        this.requestClose();
      }
    } catch {
      this.choiceSaveError = this.uiText('Privacy choices could not be saved.');
    } finally {
      this.savingChoices = false;
    }
  }

  private async prepareOpen(): Promise<void> {
    await this.privacyPolicy.prepareOpen({ lazy: this.lazy });
    this.syncApprovalsForRevision(this.sections(), this.activeRevision());
  }

  private syncApprovalsForRevision(
    sections: readonly HelpCenterSection[],
    revision: HelpCenterRevision | null
  ): void {
    const optionalSectionIds = this.optionalSectionIds(sections);
    if (this.source === 'settings') {
      this.syncSettingsConsentForRevision(optionalSectionIds, revision);
      return;
    }
    this.syncEntryOptionalApprovals(optionalSectionIds, revision);
  }

  private syncEntryOptionalApprovals(
    optionalSectionIds: ReadonlySet<string>,
    revision: HelpCenterRevision | null
  ): void {
    const revisionKey = revision ? this.privacyPolicy.revisionKey(revision) : '';
    if (revision && revisionKey && this.optionalApprovalsLoadedForRevision !== revisionKey) {
      const approvedSectionIds = this.privacyPolicy.loadEntryOptionalApprovals(revision);
      this.loadedApprovedSectionIds = new Set(approvedSectionIds);
      this.approvedSectionIds = approvedSectionIds;
      this.optionalApprovalsLoadedForRevision = revisionKey;
      return;
    }
    this.loadedApprovedSectionIds = this.filteredSectionIds(this.loadedApprovedSectionIds, optionalSectionIds);
    this.approvedSectionIds = this.filteredSectionIds(this.approvedSectionIds, optionalSectionIds);
  }

  private syncSettingsConsentForRevision(
    optionalSectionIds: ReadonlySet<string>,
    revision: HelpCenterRevision | null
  ): void {
    const userId = this.activeUserId.trim();
    const revisionKey = revision && userId ? `${userId}::${this.privacyPolicy.revisionKey(revision)}` : '';
    if (!revisionKey || !revision) {
      this.consentLoadedForKey = '';
      this.consentLoadPending = false;
      this.activeRevisionConsentSaved = false;
      this.loadedApprovedSectionIds = new Set();
      this.approvedSectionIds = this.filteredSectionIds(this.approvedSectionIds, optionalSectionIds);
      return;
    }
    if (this.consentLoadedForKey === revisionKey) {
      return;
    }
    this.consentLoadedForKey = revisionKey;
    const loadToken = ++this.consentLoadToken;
    this.consentLoadPending = true;
    this.activeRevisionConsentSaved = false;
    this.choiceSaveError = '';
    void this.privacyPolicy.loadConsent(userId, revision.id, revision.version)
      .then(consent => {
        if (loadToken !== this.consentLoadToken || this.consentLoadedForKey !== revisionKey) {
          return;
        }
        this.consentLoadPending = false;
        this.activeRevisionConsentSaved = this.isPrivacyConsentCurrent(consent, revision);
        const approvedIds = new Set(
          (consent?.approvedOptionalSectionIds ?? []).filter(sectionId => optionalSectionIds.has(sectionId))
        );
        this.loadedApprovedSectionIds = new Set(approvedIds);
        this.approvedSectionIds = approvedIds;
      })
      .catch(() => {
        if (loadToken !== this.consentLoadToken || this.consentLoadedForKey !== revisionKey) {
          return;
        }
        this.consentLoadPending = false;
        this.activeRevisionConsentSaved = false;
        this.loadedApprovedSectionIds = new Set();
        this.approvedSectionIds = new Set();
        this.choiceSaveError = this.uiText('Privacy choices could not be loaded.');
      });
  }

  private async saveApprovalState(): Promise<void> {
    const revision = this.activeRevision();
    if (!revision) {
      return;
    }
    const approvedSectionIds = this.approvedOptionalSectionIds();
    if (this.source === 'settings') {
      const userId = this.activeUserId.trim();
      if (!userId) {
        return;
      }
      const consent = await this.privacyPolicy.saveConsent({
        userId,
        revisionId: revision.id,
        revisionVersion: revision.version,
        approvedOptionalSectionIds: approvedSectionIds,
        source: 'settings'
      });
      this.activeRevisionConsentSaved = this.isPrivacyConsentCurrent(consent, revision);
      this.loadedApprovedSectionIds = new Set(consent.approvedOptionalSectionIds);
      this.approvedSectionIds = new Set(consent.approvedOptionalSectionIds);
      return;
    }
    this.privacyPolicy.saveEntryOptionalApprovals(revision, approvedSectionIds);
  }

  private approvedOptionalSectionIds(): string[] {
    const optionalSectionIds = this.optionalSectionIds(this.sections());
    return Array.from(this.approvedSectionIds)
      .filter(sectionId => optionalSectionIds.has(sectionId))
      .sort();
  }

  private hasOptionalSections(): boolean {
    return this.sections().some(section => this.isSectionOptional(section));
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

  private optionalSectionIds(sections: readonly HelpCenterSection[]): Set<string> {
    return new Set(
      sections.filter(section => this.isSectionOptional(section)).map(section => section.id)
    );
  }

  private filteredSectionIds(source: ReadonlySet<string>, allowedIds: ReadonlySet<string>): Set<string> {
    return new Set(Array.from(source).filter(sectionId => allowedIds.has(sectionId)));
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

  private syncOpenSection(sections: readonly HelpCenterSection[]): void {
    if (sections.length === 0) {
      this.openSectionId = '';
      return;
    }
    if (!this.openSectionId || !sections.some(section => section.id === this.openSectionId)) {
      this.openSectionId = sections[0].id;
    }
  }

  private normalizeHeaderColor(value: string | null | undefined): string {
    const normalized = `${value ?? ''}`.trim();
    switch (normalized) {
      case 'blue':
      case 'green':
      case 'rose':
      case 'violet':
      case 'slate':
        return normalized;
      default:
        return 'amber';
    }
  }
}
