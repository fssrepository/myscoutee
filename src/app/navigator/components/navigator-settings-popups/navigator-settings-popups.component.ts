import { CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NavigatorService, type NavigatorSettingsPopup } from '../../navigator.service';
import { NavigatorFeedbackPopupComponent } from '../navigator-feedback-popup/navigator-feedback-popup.component';
import { NavigatorHelpPopupComponent } from '../navigator-help-popup/navigator-help-popup.component';
import { NavigatorPrivacyPopupComponent } from '../navigator-privacy-popup/navigator-privacy-popup.component';

@Component({
  selector: 'app-navigator-settings-popups',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    NavigatorHelpPopupComponent,
    NavigatorFeedbackPopupComponent,
    NavigatorPrivacyPopupComponent
  ],
  templateUrl: './navigator-settings-popups.component.html',
  styleUrl: './navigator-settings-popups.component.scss'
})
export class NavigatorSettingsPopupsComponent {
  private readonly navigatorService = inject(NavigatorService);

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
      default:
        return '';
    }
  }

  protected closePopup(): void {
    this.navigatorService.closeSettingsPopup();
  }
}
