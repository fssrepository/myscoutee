import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, effect, inject } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';

import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { HelpCenterService } from '../../../shared/core';
import type { HelpCenterRevision, HelpCenterSection } from '../../../shared/core/base/models';

@Component({
  selector: 'app-entry-consent-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatRippleModule],
  templateUrl: './entry-consent-popup.component.html',
  styleUrl: './entry-consent-popup.component.scss'
})
export class EntryConsentPopupComponent {
  private static readonly OPTIONAL_PRIVACY_APPROVAL_KEY = 'myscoutee-privacy-optional-approvals';

  private readonly helpCenter = inject(HelpCenterService);

  @Input() open = false;
  @Input() viewOnly = false;
  @Input() loading = false;
  @Input() approvalRequired = false;

  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly acceptRequested = new EventEmitter<void>();
  @Output() readonly rejectRequested = new EventEmitter<void>();

  protected readonly activeRevision = this.helpCenter.activePrivacyRevision;
  protected readonly versionLabel = this.helpCenter.activePrivacyVersionLabel;
  protected readonly sections = computed<HelpCenterSection[]>(() => this.activeRevision()?.sections ?? []);
  protected readonly defaultPrivacyDescription = APP_STATIC_DATA.defaultPrivacyCenterDescription;
  protected openAccordionSectionId = '';
  protected approvedSectionIds = new Set<string>();
  protected savingChoices = false;
  protected choiceSaveMessage = '';
  protected choiceSaveError = '';
  private optionalApprovalsLoadedForRevision = '';

  constructor() {
    effect(() => {
      const sections = this.sections();
      const revision = this.activeRevision();
      this.syncOptionalApprovalsForRevision(sections, revision);
      if (sections.length === 0) {
        this.openAccordionSectionId = '';
        return;
      }
      if (!this.openAccordionSectionId || !sections.some(section => section.id === this.openAccordionSectionId)) {
        this.openAccordionSectionId = sections[0].id;
      }
    });
  }

  protected requestClose(): void {
    this.closeRequested.emit();
  }

  protected async requestAccept(): Promise<void> {
    if (!this.canAccept()) {
      return;
    }
    await this.saveApprovalState();
    this.acceptRequested.emit();
  }

  protected requestReject(): void {
    this.rejectRequested.emit();
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
    this.choiceSaveMessage = '';
    this.choiceSaveError = '';
  }

  protected stopNestedAccordionEvent(event?: Event): void {
    event?.stopPropagation();
    event?.stopImmediatePropagation();
  }

  protected isSectionApproved(sectionId: string): boolean {
    return this.approvedSectionIds.has(sectionId);
  }

  protected canAccept(): boolean {
    const sections = this.sections();
    return !this.viewOnly
      && !this.loading
      && Boolean(this.activeRevision())
      && sections.length > 0;
  }

  protected hasOptionalSections(): boolean {
    return this.sections().some(section => this.isSectionOptional(section));
  }

  protected shouldShowPrivacySaveAction(): boolean {
    return this.viewOnly && (this.approvalRequired || this.hasOptionalSections());
  }

  protected canSavePrivacyChoices(): boolean {
    return Boolean(this.activeRevision())
      && this.shouldShowPrivacySaveAction()
      && !this.loading
      && !this.savingChoices;
  }

  protected privacySaveButtonLabel(): string {
    if (this.savingChoices) {
      return 'Saving...';
    }
    return this.approvalRequired ? 'Approve privacy' : 'Save choices';
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
      this.choiceSaveMessage = 'Privacy choices saved.';
      if (this.approvalRequired) {
        this.acceptRequested.emit();
      } else if (this.viewOnly) {
        this.requestClose();
      }
    } catch {
      this.choiceSaveError = 'Privacy choices could not be saved.';
    } finally {
      this.savingChoices = false;
    }
  }

  protected isSectionOptional(section: HelpCenterSection): boolean {
    return section.optional === true;
  }

  protected headerColorClass(): string {
    return `entry-consent-header-${this.normalizeHeaderColor(this.activeRevision()?.headerColor)}`;
  }

  protected onAccordionKeydown(sectionId: string, event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.toggleAccordionSection(sectionId, event);
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

  private syncOptionalApprovalsForRevision(
    sections: readonly HelpCenterSection[],
    revision: HelpCenterRevision | null
  ): void {
    const optionalSectionIds = new Set(
      sections.filter(section => this.isSectionOptional(section)).map(section => section.id)
    );
    const revisionKey = revision ? this.privacyRevisionKey(revision) : '';
    if (revision && revisionKey && this.optionalApprovalsLoadedForRevision !== revisionKey) {
      this.approvedSectionIds = this.loadOptionalApprovalState(revision, optionalSectionIds);
      this.optionalApprovalsLoadedForRevision = revisionKey;
      return;
    }
    this.approvedSectionIds = new Set(
      Array.from(this.approvedSectionIds).filter(sectionId => optionalSectionIds.has(sectionId))
    );
  }

  private async saveApprovalState(): Promise<void> {
    const revision = this.activeRevision();
    if (!revision) {
      return;
    }
    const approvedSectionIds = this.approvedOptionalSectionIds();
    this.saveOptionalApprovalState(revision, approvedSectionIds);
  }

  private saveOptionalApprovalState(revision: HelpCenterRevision, approvedSectionIds: string[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(EntryConsentPopupComponent.OPTIONAL_PRIVACY_APPROVAL_KEY, JSON.stringify({
      revisionKey: this.privacyRevisionKey(revision),
      approvedSectionIds
    }));
  }

  private approvedOptionalSectionIds(): string[] {
    const optionalSectionIds = new Set(
      this.sections().filter(section => this.isSectionOptional(section)).map(section => section.id)
    );
    return Array.from(this.approvedSectionIds)
      .filter(sectionId => optionalSectionIds.has(sectionId))
      .sort();
  }

  private loadOptionalApprovalState(
    revision: HelpCenterRevision,
    optionalSectionIds: ReadonlySet<string>
  ): Set<string> {
    if (typeof localStorage === 'undefined') {
      return new Set();
    }
    try {
      const raw = localStorage.getItem(EntryConsentPopupComponent.OPTIONAL_PRIVACY_APPROVAL_KEY);
      const parsed = raw ? JSON.parse(raw) as { revisionKey?: unknown; approvedSectionIds?: unknown } : null;
      if (!parsed || parsed.revisionKey !== this.privacyRevisionKey(revision) || !Array.isArray(parsed.approvedSectionIds)) {
        return new Set();
      }
      return new Set(
        parsed.approvedSectionIds
          .map(sectionId => `${sectionId ?? ''}`.trim())
          .filter(sectionId => optionalSectionIds.has(sectionId))
      );
    } catch {
      return new Set();
    }
  }

  private privacyRevisionKey(revision: HelpCenterRevision): string {
    return `${revision.id}:v${revision.version}`;
  }
}
