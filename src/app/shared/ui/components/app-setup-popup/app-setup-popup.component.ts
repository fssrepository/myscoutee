import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AppSetupStore } from '../../context/stores/app-setup.store';
import { DialogStore } from '../../context/stores/dialog.store';
import { PopupPresenceStore } from '../../context/stores/popup-presence.store';
import { PopupComponent, type PopupModel } from '../core/popup';
import { AppMenuComponent, type AppMenuItem, type AppMenuModel, type AppMenuItemSelectEvent } from '../core/menu';
import { I18nPipe } from '../../pipes';
import { APP_SETUP_CONFIG } from '../../../core/base/config';
import { I18nService } from '../../../core/base/services/i18n.service';

@Component({
  selector: 'app-setup-popup',
  imports: [PopupComponent, AppMenuComponent, I18nPipe, MatIconModule],
  templateUrl: './app-setup-popup.component.html',
  styleUrl: './app-setup-popup.component.scss'
})
export class AppSetupPopupComponent {
  readonly store = inject(AppSetupStore);
  private readonly dialogs = inject(DialogStore);
  private readonly presence = inject(PopupPresenceStore);
  private readonly i18n = inject(I18nService);
  readonly helpOpen = signal(false);
  readonly actionModel: AppMenuModel = { actionSizing: 'content' };
  readonly model = computed<PopupModel>(() => ({
    title: 'app.setup.title', size: 'small', height: 'auto',
    mobilePresentation: 'compact', headerTone: 'accent', headerPalette: 'violet',
    showClose: true, closeOnBackdrop: false, backdropTone: 'dim',
    headerActions: [{ id: 'help', icon: 'help_outline', palette: 'blue',
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
      showToggleIndicator: true, disabled: this.store.actionPending() },
    { id: 'notifications', kind: 'toggle', layout: 'pill', icon: 'notifications',
      label: 'app.setup.notifications',
      palette: 'violet',
      togglePalette: this.store.notificationsSelected() && this.store.messaging.notificationPermission() === 'granted' ? 'green' : this.store.messaging.notificationPermission() === 'denied' ? 'red' : this.store.notificationsSelected() ? 'blue' : 'slate',
      checked: this.store.notificationsSelected(),
      showToggleIndicator: true, disabled: this.store.actionPending()
        || this.store.notificationConfigurationPending() || !this.store.messaging.notificationsConfigured }
  ]);
  readonly installActions = computed<AppMenuItem[]>(() => [
    ...((this.store.pwa.installAvailable() || this.store.pwa.installActionPending()) ? [{ id: 'install', icon: 'install_desktop',
      layout: 'action' as const, label: 'install.app', palette: 'violet' as const,
      disabled: this.store.actionPending() || this.store.pwa.installActionPending(),
      progress: { state: this.store.pwa.installBusy() ? 'loading' as const : null } }] : [])
  ]);
  readonly showPermissionAction = computed(() => this.store.actionPending()
    || this.store.locationMissing()
    || this.toggles().some(item => !item.disabled));
  readonly permissionActionPending = computed(() => this.store.busy() || this.store.notificationConfigurationPending());
  readonly permissionActions = computed<AppMenuItem[]>(() => [
    { id: 'allow', icon: this.permissionActionPending() ? 'hourglass_empty' : this.store.saveSucceeded() ? 'check_circle' : 'check',
      label: this.permissionActionPending() ? 'entry.permissions.checking' : 'app.setup.update',
      layout: 'action', palette: this.store.error() ? 'danger' : this.store.saveSucceeded() ? 'green' : 'blue',
      disabled: this.store.allowDisabled(),
      progress: this.permissionActionPending() || this.store.error()
        ? { state: this.permissionActionPending() ? 'loading' : 'error', shape: 'button', perimeter: 100,
            durationMs: APP_SETUP_CONFIG.locationRequestTimeoutMs }
        : this.store.saveSucceeded() ? { state: 'success', durationMs: 1000 } : null }
  ]);

  constructor() {
    effect(() => {
      if (!this.store.isOpen()) this.helpOpen.set(false);
      if (this.store.pwa.installPromptVisible() && !this.store.isOpen()
        && !this.dialogs.dialog() && !this.presence.visible()) this.store.open();
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
    if (event.id === 'allow') void this.store.allow();
  }
}
