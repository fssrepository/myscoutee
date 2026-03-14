import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { NavigatorBindings, NavigatorService, type NavigatorSettingsPopup } from '../../navigator.service';
import { NavigatorSettingsItemComponent } from '../navigator-settings-item/navigator-settings-item.component';

@Component({
  selector: 'app-navigator-settings-menu',
  standalone: true,
  imports: [CommonModule, NavigatorSettingsItemComponent],
  templateUrl: './navigator-settings-menu.component.html',
  styleUrl: './navigator-settings-menu.component.scss'
})
export class NavigatorSettingsMenuComponent {
  private readonly navigatorService = inject(NavigatorService);

  protected readonly bindings = computed<NavigatorBindings | null>(() => this.navigatorService.bindings());

  protected openPopup(popup: NavigatorSettingsPopup, event: Event): void {
    event.stopPropagation();
    this.navigatorService.openSettingsPopup(popup);
  }

  protected openDeleteAccountConfirm(event: Event): void {
    event.stopPropagation();
    this.navigatorService.closeSettingsMenu();
    this.bindings()?.openDeleteAccountConfirm();
  }

  protected openLogoutConfirm(event: Event): void {
    event.stopPropagation();
    this.navigatorService.closeSettingsMenu();
    this.bindings()?.openLogoutConfirm();
  }

  protected closeMenu(event: Event): void {
    event.stopPropagation();
    this.navigatorService.closeSettingsMenu();
  }
}
