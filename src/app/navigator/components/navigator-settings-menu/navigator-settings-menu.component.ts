
import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { HelpCenterService } from '../../../shared/core';
import { NavigatorService, type NavigatorSettingsPopup } from '../../navigator.service';

@Component({
  selector: 'app-navigator-settings-menu',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './navigator-settings-menu.component.html',
  styleUrl: './navigator-settings-menu.component.scss'
})
export class NavigatorSettingsMenuComponent {
  private readonly navigatorService = inject(NavigatorService);
  private readonly helpCenter = inject(HelpCenterService);
  private readonly router = inject(Router);
  protected readonly helpVersionLabel = this.helpCenter.activeVersionLabel;
  protected readonly hasActiveHelpRevision = this.helpCenter.hasActiveRevision;
  protected readonly privacyVersionLabel = this.helpCenter.activePrivacyVersionLabel;
  protected readonly hasActivePrivacyRevision = this.helpCenter.hasActivePrivacyRevision;

  constructor() {
    void this.helpCenter.preloadAll();
  }

  protected openPopup(popup: NavigatorSettingsPopup, event: Event): void {
    event.stopPropagation();
    if (popup === 'help' && !this.hasActiveHelpRevision()) {
      return;
    }
    if (popup === 'privacy' && !this.hasActivePrivacyRevision()) {
      return;
    }
    this.navigatorService.openSettingsPopup(popup);
  }

  protected openDeleteAccountConfirm(event: Event): void {
    event.stopPropagation();
    this.navigatorService.closeSettingsMenu();
    this.navigatorService.openDeleteAccountConfirm();
  }

  protected openLogoutConfirm(event: Event): void {
    event.stopPropagation();
    this.navigatorService.closeSettingsMenu();
    this.navigatorService.openLogoutConfirm();
  }

  protected isAdminMode(): boolean {
    return (this.router.url || '').split('?')[0].startsWith('/admin');
  }

  protected closeMenu(event: Event): void {
    event.stopPropagation();
    this.navigatorService.closeSettingsMenu();
  }
}
