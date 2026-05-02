
import { CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NavigatorService, type NavigatorSettingsPopup } from '../../navigator.service';
import { HelpCenterService } from '../../../shared/core';
import type { HelpCenterRevision } from '../../../shared/core/base/models';
import { NavigatorFeedbackPopupComponent } from '../navigator-feedback-popup/navigator-feedback-popup.component';
import { NavigatorHelpPopupComponent } from '../navigator-help-popup/navigator-help-popup.component';
import { NavigatorPrivacyPopupComponent } from '../navigator-privacy-popup/navigator-privacy-popup.component';
import { NavigatorReportUserPopupComponent } from '../navigator-report-user-popup/navigator-report-user-popup.component';

@Component({
  selector: 'app-navigator-settings-popups',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    NavigatorHelpPopupComponent,
    NavigatorFeedbackPopupComponent,
    NavigatorPrivacyPopupComponent,
    NavigatorReportUserPopupComponent
],
  templateUrl: './navigator-settings-popups.component.html',
  styleUrl: './navigator-settings-popups.component.scss'
})
export class NavigatorSettingsPopupsComponent {
  private readonly navigatorService = inject(NavigatorService);
  private readonly helpCenter = inject(HelpCenterService);

  protected readonly activePopup = this.navigatorService.settingsPopup;

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
      case 'help':
        return 'Help';
      case 'feedback':
        return 'Send Feedback';
      case 'privacy':
        return 'Privacy';
      case 'report-user':
        return 'Report User';
      default:
        return '';
    }
  }

  protected popupVersionLabel(popup: NavigatorSettingsPopup): string {
    if (popup === 'help') {
      return this.helpCenter.activeVersionLabel();
    }
    if (popup === 'privacy') {
      return this.helpCenter.activePrivacyVersionLabel();
    }
    return '';
  }

  protected popupHeaderTitle(popup: NavigatorSettingsPopup): string {
    const revision = this.popupRevision(popup);
    return revision?.summary?.trim() || this.popupTitle(popup);
  }

  protected popupHeaderDescription(popup: NavigatorSettingsPopup): string {
    return this.popupRevision(popup)?.description?.trim() ?? '';
  }

  protected popupHeaderClass(popup: NavigatorSettingsPopup): string {
    const color = this.normalizeHeaderColor(this.popupRevision(popup)?.headerColor);
    return popup === 'help' || popup === 'privacy'
      ? `navigator-settings-content-header navigator-settings-header-${color}`
      : '';
  }

  private popupRevision(popup: NavigatorSettingsPopup): HelpCenterRevision | null {
    if (popup === 'help') {
      return this.helpCenter.activeRevision();
    }
    if (popup === 'privacy') {
      return this.helpCenter.activePrivacyRevision();
    }
    return null;
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

  protected closePopup(): void {
    this.navigatorService.closeSettingsPopup();
  }
}
