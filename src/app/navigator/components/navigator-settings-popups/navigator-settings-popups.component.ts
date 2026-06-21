import { CommonModule } from '@angular/common';
import { Component, HostListener, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AppContext } from '../../../shared/ui';
import { HelpCenterService, PrivacyPolicyService } from '../../../shared/core';
import type { HelpCenterRevision, HelpCenterSection } from '../../../shared/core/contracts';
import {
  DocumentViewerComponent,
  type DocumentViewerAction,
  type DocumentViewerActionEvent,
  type DocumentViewerActionVisibility,
  type DocumentViewerConfig,
  type DocumentViewerHeaderPalette
} from '../../../shared/ui/components/document-viewer';
import { NavigatorService, type NavigatorSettingsPopup } from '../../navigator.service';
import { NavigatorFeedbackPopupComponent } from '../navigator-feedback-popup/navigator-feedback-popup.component';
import { NavigatorReportUserPopupComponent } from '../navigator-report-user-popup/navigator-report-user-popup.component';

@Component({
  selector: 'app-navigator-settings-popups',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    DocumentViewerComponent,
    NavigatorFeedbackPopupComponent,
    NavigatorReportUserPopupComponent
  ],
  templateUrl: './navigator-settings-popups.component.html',
  styleUrl: './navigator-settings-popups.component.scss'
})
export class NavigatorSettingsPopupsComponent {
  private readonly navigatorService = inject(NavigatorService);
  private readonly helpCenter = inject(HelpCenterService);
  private readonly privacyPolicy = inject(PrivacyPolicyService);
  private readonly appCtx = inject(AppContext);

  protected readonly activePopup = this.navigatorService.settingsPopup;
  protected readonly activeUserId = this.appCtx.activeUserId;
  protected readonly privacyConsentRequired = this.navigatorService.privacyConsentRequired;
  protected settingsPrivacySaving = false;
  protected settingsPrivacySaveMessage = '';
  protected settingsPrivacySaveError = '';
  protected settingsPrivacyConsentLoadPending = false;
  private settingsPrivacyActiveRevisionConsentSaved = false;
  private settingsPrivacyConsentLoadedForKey = '';
  private settingsPrivacyConsentLoadToken = 0;
  private settingsApprovedPrivacySectionIds = new Set<string>();

  constructor() {
    effect(() => {
      if (this.activePopup() !== 'privacy') {
        return;
      }
      this.syncSettingsPrivacyConsentForRevision();
    });
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onWindowEscape(event: Event): void {
    if (!this.activePopup()) {
      return;
    }
    (event as KeyboardEvent).stopPropagation();
    this.closePopup();
  }

  protected popupTitle(popup: NavigatorSettingsPopup): string {
    switch (popup) {
      case 'feedback':
        return 'Send Feedback';
      case 'report-user':
        return 'Report User';
      default:
        return '';
    }
  }

  protected closePopup(): void {
    this.navigatorService.closeSettingsPopup();
  }

  protected completePrivacyPopup(): void {
    this.navigatorService.markActivePrivacyConsentApproved();
    this.navigatorService.closeSettingsPopup();
  }

  protected privacyDocumentConfig(): DocumentViewerConfig {
    const revision = this.helpCenter.activePrivacyRevision();
    return {
      open: this.activePopup() === 'privacy',
      shell: 'popup',
      onClose: () => this.closePopup(),
      ariaLabel: 'GDPR consent',
      closeAriaLabel: 'Close privacy popup',
      closeOnBackdrop: !this.privacyConsentRequired(),
      title: revision?.summary?.trim() || 'Privacy first',
      description: revision?.description?.trim() || '',
      versionLabel: this.helpCenter.activePrivacyVersionLabel(),
      headerPalette: this.normalizeDocumentHeaderPalette(revision?.headerColor),
      loading: !revision,
      loadingLabel: 'Loading privacy content',
      emptyState: {
        icon: 'policy',
        title: 'Privacy is not available',
        description: 'Privacy content is not available right now.'
      },
      sections: (revision?.sections ?? []).map(section => this.mapPrivacySection(section)),
      selectedSectionIds: Array.from(this.settingsApprovedPrivacySectionIds),
      actions: this.privacyDocumentActions(),
      statusMessage: this.settingsPrivacySaveError || this.settingsPrivacySaveMessage,
      statusTone: this.settingsPrivacySaveError ? 'error' : 'default'
    };
  }

  protected termsDocumentConfig(): DocumentViewerConfig {
    const revision = this.helpCenter.activeTermsRevision();
    return {
      open: this.activePopup() === 'terms',
      shell: 'popup',
      onClose: () => this.closePopup(),
      ariaLabel: 'Terms of service',
      closeAriaLabel: 'Close terms popup',
      title: revision?.summary?.trim() || 'Usage terms',
      description: revision?.description?.trim() || 'Review the terms that apply when you use MyScoutee features, accounts, events, chats, and community tools.',
      versionLabel: this.helpCenter.activeTermsVersionLabel(),
      headerPalette: this.normalizeDocumentHeaderPalette(revision?.headerColor),
      loading: !revision,
      loadingLabel: 'Loading terms content',
      emptyState: {
        icon: 'rule',
        title: 'Terms are not available',
        description: 'Terms content is not available right now.'
      },
      sections: (revision?.sections ?? []).map(section => this.mapDocumentSection(section))
    };
  }

  protected helpDocumentConfig(): DocumentViewerConfig {
    const revision = this.helpCenter.activeRevision();
    return {
      open: this.activePopup() === 'help',
      shell: 'popup',
      onClose: () => this.closePopup(),
      ariaLabel: 'Help',
      closeAriaLabel: 'Close help popup',
      title: revision?.summary?.trim() || 'Help',
      description: revision?.description?.trim() || '',
      versionLabel: this.helpCenter.activeVersionLabel(),
      headerPalette: this.helpDocumentHeaderPalette(revision?.headerColor),
      loading: !revision,
      loadingLabel: 'Loading help content',
      emptyState: {
        icon: 'help_outline',
        title: 'Help is not available',
        description: 'Help content is not available right now.'
      },
      sections: (revision?.sections ?? []).map(section => this.mapDocumentSection(section))
    };
  }

  protected onPrivacyDocumentAction(event: DocumentViewerActionEvent): void {
    if (event.id === 'settings-privacy-save') {
      void this.saveSettingsPrivacyChoices(event.selectedSectionIds);
    }
  }

  private privacyDocumentActions(): readonly DocumentViewerAction[] {
    return [{
      id: 'settings-privacy-save',
      label: this.settingsPrivacySaveButtonLabel(),
      icon: 'check_circle',
      palette: 'blue',
      disabled: !this.canRunSettingsPrivacySaveAction(),
      visible: this.settingsPrivacySaveActionVisibility(),
      progress: this.settingsPrivacySaving
        ? {
            state: 'loading',
            shape: 'button'
          }
        : null
    }];
  }

  private mapPrivacySection(section: HelpCenterSection) {
    const optional = section.optional === true;
    return {
      ...this.mapDocumentSection(section),
      tone: optional ? 'optional' as const : 'mandatory' as const,
      selected: this.settingsApprovedPrivacySectionIds.has(section.id),
      toggleable: optional
    };
  }

  private mapDocumentSection(section: HelpCenterSection) {
    return {
      id: section.id,
      icon: section.icon,
      title: section.title,
      blurb: section.blurb,
      contentHtml: section.contentHtml,
      points: section.points,
      details: section.details
    };
  }

  private settingsPrivacySaveActionVisibility(): DocumentViewerActionVisibility {
    const revision = this.helpCenter.activePrivacyRevision();
    if (!revision) {
      return false;
    }
    if (this.privacyConsentRequired()) {
      return true;
    }
    if (!this.settingsPrivacyConsentLoadPending && !this.settingsPrivacyActiveRevisionConsentSaved) {
      return true;
    }
    return this.hasOptionalPrivacySections(revision) ? 'dirty' : false;
  }

  private canRunSettingsPrivacySaveAction(): boolean {
    return !this.settingsPrivacySaving && !this.settingsPrivacyConsentLoadPending;
  }

  private settingsPrivacySaveButtonLabel(): string {
    if (this.settingsPrivacySaving) {
      return 'Saving...';
    }
    return this.privacyConsentRequired() || !this.settingsPrivacyActiveRevisionConsentSaved
      ? 'Approve privacy'
      : 'Save choices';
  }

  private async saveSettingsPrivacyChoices(selectedSectionIds: readonly string[]): Promise<void> {
    const revision = this.helpCenter.activePrivacyRevision();
    const userId = this.activeUserId().trim();
    if (!revision || !userId || !this.canRunSettingsPrivacySaveAction()) {
      return;
    }
    this.settingsPrivacySaving = true;
    this.settingsPrivacySaveMessage = '';
    this.settingsPrivacySaveError = '';
    try {
      const optionalSectionIds = this.optionalPrivacySectionIds(revision.sections);
      const approvedOptionalSectionIds = Array.from(new Set(selectedSectionIds))
        .filter(sectionId => optionalSectionIds.has(sectionId))
        .sort();
      const consent = await this.privacyPolicy.saveConsent({
        userId,
        revisionId: revision.id,
        revisionVersion: revision.version,
        approvedOptionalSectionIds,
        source: 'settings'
      });
      this.settingsPrivacyActiveRevisionConsentSaved = this.isPrivacyConsentCurrent(consent, revision);
      this.settingsApprovedPrivacySectionIds = new Set(consent.approvedOptionalSectionIds);
      this.settingsPrivacySaveMessage = 'Privacy choices saved.';
      this.completePrivacyPopup();
    } catch {
      this.settingsPrivacySaveError = 'Privacy choices could not be saved.';
    } finally {
      this.settingsPrivacySaving = false;
    }
  }

  private syncSettingsPrivacyConsentForRevision(): void {
    const revision = this.helpCenter.activePrivacyRevision();
    const userId = this.activeUserId().trim();
    const optionalSectionIds = this.optionalPrivacySectionIds(revision?.sections ?? []);
    const revisionKey = revision && userId ? `${userId}::${this.privacyPolicy.revisionKey(revision)}` : '';
    if (!revision || !revisionKey) {
      this.settingsPrivacyConsentLoadedForKey = '';
      this.settingsPrivacyConsentLoadPending = false;
      this.settingsPrivacyActiveRevisionConsentSaved = false;
      this.settingsApprovedPrivacySectionIds = this.filteredSectionIds(this.settingsApprovedPrivacySectionIds, optionalSectionIds);
      return;
    }
    if (this.settingsPrivacyConsentLoadedForKey === revisionKey) {
      return;
    }
    this.settingsPrivacyConsentLoadedForKey = revisionKey;
    const loadToken = ++this.settingsPrivacyConsentLoadToken;
    this.settingsPrivacyConsentLoadPending = true;
    this.settingsPrivacyActiveRevisionConsentSaved = false;
    this.settingsPrivacySaveError = '';
    void this.privacyPolicy.loadConsent(userId, revision.id, revision.version)
      .then(consent => {
        if (loadToken !== this.settingsPrivacyConsentLoadToken || this.settingsPrivacyConsentLoadedForKey !== revisionKey) {
          return;
        }
        this.settingsPrivacyConsentLoadPending = false;
        this.settingsPrivacyActiveRevisionConsentSaved = this.isPrivacyConsentCurrent(consent, revision);
        this.settingsApprovedPrivacySectionIds = new Set(
          (consent?.approvedOptionalSectionIds ?? []).filter(sectionId => optionalSectionIds.has(sectionId))
        );
      })
      .catch(() => {
        if (loadToken !== this.settingsPrivacyConsentLoadToken || this.settingsPrivacyConsentLoadedForKey !== revisionKey) {
          return;
        }
        this.settingsPrivacyConsentLoadPending = false;
        this.settingsPrivacyActiveRevisionConsentSaved = false;
        this.settingsApprovedPrivacySectionIds = new Set();
        this.settingsPrivacySaveError = 'Privacy choices could not be loaded.';
      });
  }

  private hasOptionalPrivacySections(revision: HelpCenterRevision): boolean {
    return revision.sections.some(section => section.optional === true);
  }

  private optionalPrivacySectionIds(sections: readonly HelpCenterSection[]): Set<string> {
    return new Set(sections.filter(section => section.optional === true).map(section => section.id));
  }

  private filteredSectionIds(source: ReadonlySet<string>, allowedIds: ReadonlySet<string>): Set<string> {
    return new Set(Array.from(source).filter(sectionId => allowedIds.has(sectionId)));
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

  private normalizeDocumentHeaderPalette(
    value: string | null | undefined,
    fallback: DocumentViewerHeaderPalette = 'amber'
  ): DocumentViewerHeaderPalette {
    const normalized = `${value ?? ''}`.trim();
    switch (normalized) {
      case 'amber':
      case 'blue':
      case 'green':
      case 'rose':
      case 'violet':
      case 'slate':
      case 'teal':
        return normalized;
      default:
        return fallback;
    }
  }

  private helpDocumentHeaderPalette(value: string | null | undefined): DocumentViewerHeaderPalette {
    const normalized = this.normalizeDocumentHeaderPalette(value, 'teal');
    return normalized === 'amber' ? 'teal' : normalized;
  }
}
