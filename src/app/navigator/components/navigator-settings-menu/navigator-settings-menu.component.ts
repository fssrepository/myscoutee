
import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
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

  protected openPopup(popup: NavigatorSettingsPopup, event: Event): void {
    event.stopPropagation();
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

  protected closeMenu(event: Event): void {
    event.stopPropagation();
    this.navigatorService.closeSettingsMenu();
  }
}
