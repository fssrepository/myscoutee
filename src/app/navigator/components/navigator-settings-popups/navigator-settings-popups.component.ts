import { CommonModule } from '@angular/common';
import { Component, HostListener, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AppUtils } from '../../../shared/app-utils';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppContext } from '../../../shared/ui';
import { HelpCenterService, PrivacyPolicyService } from '../../../shared/core';
import type { HelpCenterRevisionDto, HelpCenterSectionDto } from '../../../shared/core/contracts';
import {
  DocumentViewerComponent,
  type DocumentViewerAction,
  type DocumentViewerActionEvent,
  type DocumentViewerActionVisibility,
  type DocumentViewerConfig
} from '../../../shared/ui/components/document-viewer';
import { HelpCenterRevisionDocumentViewerConfigConverter } from '../../../shared/ui/converters';
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
  protected readonly activeUserId = this.appCtx.userProfileStore.activeUserId;
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
    return HelpCenterRevisionDocumentViewerConfigConverter.convert({
      revision,
      open: this.activePopup() === 'privacy',
      shell: 'popup',
      onClose: () => this.closePopup(),
      ariaLabel: 'GDPR consent',
      closeAriaLabel: 'Close privacy popup',
      closeOnBackdrop: !this.privacyConsentRequired(),
      titleFallback: 'Privacy first',
      versionLabel: this.helpCenter.activePrivacyVersionLabel(),
      loading: !revision,
      loadingLabel: 'Loading privacy content',
      emptyState: {
        icon: 'policy',
        title: 'Privacy is not available',
        description: 'Privacy content is not available right now.'
      },
      sectionMode: 'privacy',
      selectedSectionIds: this.settingsApprovedPrivacySectionIds,
      actions: this.privacyDocumentActions(),
      statusMessage: this.settingsPrivacySaveError || this.settingsPrivacySaveMessage,
      statusTone: this.settingsPrivacySaveError ? 'error' : 'default'
    });
  }

  protected termsDocumentConfig(): DocumentViewerConfig {
    const revision = this.helpCenter.activeTermsRevision();
    return HelpCenterRevisionDocumentViewerConfigConverter.convert({
      revision,
      open: this.activePopup() === 'terms',
      shell: 'popup',
      onClose: () => this.closePopup(),
      ariaLabel: 'Terms of service',
      closeAriaLabel: 'Close terms popup',
      titleFallback: 'Usage terms',
      descriptionFallback: 'Review the terms that apply when you use MyScoutee features, accounts, events, chats, and community tools.',
      versionLabel: this.helpCenter.activeTermsVersionLabel(),
      loading: !revision,
      loadingLabel: 'Loading terms content',
      emptyState: {
        icon: 'rule',
        title: 'Terms are not available',
        description: 'Terms content is not available right now.'
      }
    });
  }

  protected helpDocumentConfig(): DocumentViewerConfig {
    const revision = this.helpCenter.activeRevision();
    const headerPalette = AppUtils.enumValue(
      revision?.headerColor,
      APP_STATIC_DATA.documentViewerHeaderPalettes,
      'teal'
    );
    return HelpCenterRevisionDocumentViewerConfigConverter.convert({
      revision,
      open: this.activePopup() === 'help',
      shell: 'popup',
      onClose: () => this.closePopup(),
      ariaLabel: 'Help',
      closeAriaLabel: 'Close help popup',
      titleFallback: 'Help',
      versionLabel: this.helpCenter.activeVersionLabel(),
      headerPalette: headerPalette === 'amber' ? 'teal' : headerPalette,
      loading: !revision,
      loadingLabel: 'Loading help content',
      emptyState: {
        icon: 'help_outline',
        title: 'Help is not available',
        description: 'Help content is not available right now.'
      },
    });
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

  private hasOptionalPrivacySections(revision: HelpCenterRevisionDto): boolean {
    return revision.sections.some(section => section.optional === true);
  }

  private optionalPrivacySectionIds(sections: readonly HelpCenterSectionDto[]): Set<string> {
    return new Set(sections.filter(section => section.optional === true).map(section => section.id));
  }

  private filteredSectionIds(source: ReadonlySet<string>, allowedIds: ReadonlySet<string>): Set<string> {
    return new Set(Array.from(source).filter(sectionId => allowedIds.has(sectionId)));
  }

  private isPrivacyConsentCurrent(
    consent: { revisionId?: string | null; revisionVersion?: number | null } | null,
    revision: HelpCenterRevisionDto
  ): boolean {
    if (!consent) {
      return false;
    }
    const consentRevisionId = `${consent.revisionId ?? ''}`.trim();
    const consentVersion = Math.trunc(Number(consent.revisionVersion) || 0);
    const currentVersion = Math.trunc(Number(revision.version) || 0);
    return consentRevisionId === revision.id && consentVersion >= currentVersion && currentVersion > 0;
  }

}
