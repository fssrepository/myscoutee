import { LandingGuideSurfaceDirective } from '../../../../entry/components/entry-landing/landing-guide-surface.directive';
import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AppSetupStore } from '../../context/stores/app/app-setup.store';
import {
  PopupComponent,
  type PopupModel,
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuModel,
  type AppMenuItemSelectEvent,
  I18nPipe
} from '@fssrepository/myscoutee-components';

import { APP_SETUP_CONFIG } from '../../../core/base/config';
import { I18nService } from '../../../core/base/services/localization/i18n.service';

@Component({
  selector: 'app-setup-popup',
  imports: [LandingGuideSurfaceDirective,PopupComponent, AppMenuComponent, I18nPipe, MatIconModule],
  templateUrl: './app-setup-popup.component.html',
  styleUrl: './app-setup-popup.component.scss'
})
export class AppSetupPopupComponent {
  readonly store = inject(AppSetupStore);
  private readonly i18n = inject(I18nService);
  readonly helpOpen = signal(false);
  readonly actionModel: AppMenuModel = { actionSizing: 'content' };
  readonly browserActions: AppMenuItem[] = [{ id: 'open-browser', icon: 'open_in_browser',
    layout: 'pill', label: 'app.setup.open.browser', palette: 'ink' }];
  readonly privacyActions = computed<AppMenuItem[]>(() => [{ id: 'privacy', icon: 'policy',
    layout: 'pill', label: 'privacy', palette: this.store.privacyMissing() ? 'blue' : 'green',
    counter: this.store.privacyMissing() ? 1 : null, counterTone: 'alert', disabled: this.store.actionPending() }]);
  readonly installedActions: AppMenuItem[] = [{ id: 'install', icon: 'install_desktop',
    layout: 'pill', label: 'install.app', palette: 'green', disabled: true }];
  readonly model = computed<PopupModel>(() => ({
    errorMessage: this.store.error(),
    title: 'app.setup.title', size: 'small', height: 'auto',
    mobilePresentation: 'compact', headerTone: 'accent', headerPalette: 'violet',
    showClose: true, closeOnBackdrop: false, backdropTone: 'dim',
    headerActions: [{ id: 'help', icon: 'question_mark', palette: 'blue',
      ariaLabel: this.i18n.translate('app.setup.help.title') }],
    onAction: () => this.helpOpen.set(true)
  }));
  readonly helpModel: PopupModel = {
    title: 'app.setup.help.title', size: 'default', height: 'auto',
    headerTone: 'accent', headerPalette: 'blue', showClose: true,
    backdropTone: 'dim'
  };
  readonly helpSections = [
    { id: 'location', icon: 'location_on', tone: 'blue' },
    { id: 'notifications', icon: 'notifications', tone: 'violet' },
    { id: 'install', icon: 'install_mobile', tone: 'green' },
    { id: 'blocked', icon: 'block', tone: 'rose' },
    { id: 'android', icon: 'android', tone: 'teal' },
    { id: 'ios', icon: 'phone_iphone', tone: 'orange' }
  ] as const;
  readonly toggles = computed<AppMenuItem[]>(() => [
    { id: 'location', kind: 'toggle', layout: 'pill', icon: 'location_on',
      label: 'app.setup.location',
      palette: 'blue',
      togglePalette: this.store.locationPermission() === 'granted' ? 'green' : this.store.locationPermission() === 'denied' ? 'red' : this.store.locationSelected() ? 'blue' : 'slate',
      checked: this.store.locationSelected(),
      showToggleIndicator: true,
      progress: this.controlProgress('location'),
      disabled: this.store.actionPending() || this.store.locationPermissionPending() },
    { id: 'notifications', kind: 'toggle', layout: 'pill', icon: 'notifications',
      label: 'app.setup.notifications',
      palette: 'violet',
      togglePalette: this.store.notificationsSelected() && this.store.messaging.notificationPermission() === 'granted' ? 'green' : this.store.messaging.notificationPermission() === 'denied' ? 'red' : this.store.notificationsSelected() ? 'blue' : 'slate',
      checked: this.store.notificationsSelected(),
      showToggleIndicator: true,
      progress: this.controlProgress('notifications'),
      disabled: this.store.actionPending()
        || this.store.notificationConfigurationPending() || !this.store.messaging.notificationsConfigured }
  ]);
  readonly installActions = computed<AppMenuItem[]>(() => [
    { id: 'install', icon: 'install_desktop',
      layout: 'pill' as const, label: 'install.app', palette: 'violet' as const,
      disabled: !this.store.pwa.installAvailable() || this.store.actionPending() || this.store.pwa.installActionPending(),
      progress: { state: this.store.pwa.installBusy() ? 'loading' as const : null } }
  ]);
  private controlProgress(control: 'location' | 'notifications'): AppMenuItem['progress'] {
    const active = this.store.activeControl() === control;
    if (active && this.store.busy()) {
      return { state: 'loading', shape: 'button', perimeter: 100,
        ...(this.store.busy() ? { durationMs: APP_SETUP_CONFIG.locationRequestTimeoutMs } : {}) };
    }
    if (active && this.store.error()) return { state: 'error', shape: 'button' };
    return active && this.store.saveSucceeded() ? { state: 'success', shape: 'button', durationMs: 1000 } : null;
  }

  constructor() {
    effect(() => {
      if (!this.store.isOpen()) this.helpOpen.set(false);
    });
  }

  @HostListener('window:focus')
  refreshPermissions(): void {
    if (this.store.isOpen()) void this.store.refreshPermissions();
  }

  toggle(event: AppMenuItemSelectEvent): void {
    if (this.store.actionPending()) return;
    if (event.id === 'location') {
      this.store.toggleLocation();
    } else if (event.id === 'notifications') {
      this.store.toggleNotifications();
    }
  }

  action(event: AppMenuItemSelectEvent): void {
    if (event.id === 'install') this.store.install();
    else if (event.id === 'open-browser') this.store.pwa.openInBrowser();
    else if (event.id === 'privacy') this.store.openPrivacy();
  }
}
