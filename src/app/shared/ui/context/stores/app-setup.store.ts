import { Injectable, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { AppLocationService } from '../../../core/base/services/app-location.service';
import { FirebaseMessagingService } from '../../../core/base/services/firebase-messaging.service';
import { I18nService } from '../../../core/base/services/i18n.service';
import { PwaService } from '../../../core/base/services/pwa.service';
import { UserProfileStore } from './user-profile.store';
import type { LocationCoordinates } from '../../../core/contracts/user.interface';

@Injectable({ providedIn: 'root' })
export class AppSetupStore implements OnDestroy {
  readonly pwa = inject(PwaService);
  readonly messaging = inject(FirebaseMessagingService);
  private readonly location = inject(AppLocationService);
  private readonly i18n = inject(I18nService);
  private readonly profile = inject(UserProfileStore);
  readonly loggedIn = computed(() => !!this.profile.activeUserId());
  readonly locationMissing = this.profile.activeUserLocationMissing;
  readonly locationChangeDetected = this.location.locationChangeDetected;
  readonly isOpen = signal(false);
  readonly locationSelected = signal(false);
  readonly notificationsSelected = signal(false);
  private readonly notificationsEdited = signal(false);
  readonly locationGranted = signal(false);
  readonly locationPermission = signal<PermissionState | null>(null);
  readonly nativePending = signal(false);
  readonly busy = signal(false);
  readonly notificationConfigurationPending = signal(false);
  readonly actionPending = computed(() => this.nativePending() || this.busy());
  readonly error = signal('');
  readonly saveSucceeded = signal(false);
  private saveFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  readonly allowDisabled = computed(() => this.busy() || this.notificationConfigurationPending());
  private locationRequestPending = false;
  private opening = false;
  private generation = 0;
  private permission: PermissionStatus | null = null;
  private completeLogin: ((allowed: boolean) => void) | null = null;
  private checkLocation: ((coordinates: LocationCoordinates) => Promise<boolean>) | null = null;

  constructor() {
    effect(() => {
      const enabled = this.messaging.deviceNotificationsEnabled();
      if (this.isOpen() && !this.actionPending()
        && (!this.notificationsEdited() || !this.messaging.notificationsConfigured)) {
        this.notificationsSelected.set(enabled);
      }
    });
  }

  toggleNotifications(): void {
    if (this.notificationConfigurationPending() || !this.messaging.notificationsConfigured) return;
    this.clearSaveFeedback();
    this.notificationsEdited.set(true);
    this.notificationsSelected.update(value => !value);
  }

  open(): void {
    if (this.isOpen() || this.opening) return;
    this.opening = true;
    this.generation++;
    this.clearSaveFeedback();
    this.error.set('');
    this.locationGranted.set(false);
    this.locationPermission.set(null);
    this.locationSelected.set(false);
    this.messaging.refreshNotificationPermission();
    this.notificationsEdited.set(false);
    this.notificationsSelected.set(this.messaging.deviceNotificationsEnabled());
    // Resolve the deployment flag before the click, preserving the click's
    // native permission gesture and avoiding token work for an inactive setup.
    const generation = this.generation;
    this.notificationConfigurationPending.set(true);
    void Promise.all([
      this.messaging.prepareNotificationConfiguration().catch(() => undefined),
      this.refreshPermissions()
    ]).then(() => {
      if (generation !== this.generation) return;
      this.notificationConfigurationPending.set(false);
      this.notificationsSelected.set(this.messaging.deviceNotificationsEnabled());
      this.opening = false;
      this.isOpen.set(true);
    });
  }

  requestForLogin(checkLocation: ((coordinates: LocationCoordinates) => Promise<boolean>) | null = null): Promise<boolean> {
    // Repeated Login clicks share one open workflow instead of stacking dialogs.
    if (this.completeLogin) return Promise.resolve(false);
    this.open();
    this.checkLocation = checkLocation;
    return new Promise(resolve => { this.completeLogin = resolve; });
  }

  async refreshPermissions(): Promise<void> {
    this.messaging.refreshNotificationPermission();

    const generation = this.generation;
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if ((!this.isOpen() && !this.opening) || generation !== this.generation) return;
      if (this.permission) this.permission.onchange = null;
      this.permission = permission;
      const update = () => {
        this.locationPermission.set(permission.state);
        this.locationGranted.set(permission.state === 'granted');
        if (this.locationRequestPending && permission.state === 'granted') this.busy.set(true);
        if (permission.state === 'granted') this.locationSelected.set(true);
      };
      permission.onchange = update;
      update();
    } catch {
      this.locationGranted.set(false);
    }
  }

  close(): void {
    this.locationRequestPending = false;
    this.nativePending.set(false);
    this.busy.set(false);
    this.finish(false);
  }

  install(): void {
    // Installation is optional and does not approve browser permissions.
    // The native dialog consumes its own event; the Allow action stays separate.
    void this.pwa.promptInstall();
  }

  async allow(): Promise<void> {
    if (!this.isOpen() || this.nativePending() || this.allowDisabled()) return;
    this.clearSaveFeedback();
    if (!this.loggedIn() && !this.locationSelected()) {
      this.error.set(this.i18n.translate('entry.permissions.location.required'));
      return;
    }
    this.nativePending.set(true);
    this.error.set('');
    const generation = this.generation;
    try {
      // Notifications need the original button gesture. Geolocation follows
      // only after that native decision settles. Notification denial is optional.
      if (this.notificationsSelected()) {
        const decision = await this.messaging.requestEntryPermission();
        if (generation !== this.generation) return;
        if (decision) this.notificationsSelected.set(decision === 'granted');
        if (decision === 'denied' && this.loggedIn() && !this.checkLocation) {
          this.error.set(this.i18n.translate('entry.permissions.notifications.blocked'));
          return;
        }
      }
      if (generation !== this.generation) return;
      const observedCoordinates = this.loggedIn() ? this.location.pendingCoordinatesForActiveUser() : null;
      const needsLocation = !!this.checkLocation || (this.loggedIn()
        ? this.locationSelected() && (!this.locationGranted() || this.locationMissing() || !!observedCoordinates)
        : !this.locationGranted());
      if (!needsLocation) {
        this.nativePending.set(false);
        this.busy.set(true);
        if (this.notificationsSelected() !== this.messaging.deviceNotificationsEnabled()) {
          await this.messaging.setDeviceNotificationsEnabled(this.notificationsSelected());
        }
        if (generation === this.generation) {
          if (this.completeLogin) this.finish(true);
          else {
            this.notificationsEdited.set(false);
            this.showSaveFeedback();
          }
        }
        return;
      }
      this.locationRequestPending = true;
      this.busy.set(this.locationPermission() === 'granted');
      const coordinates = this.locationGranted() && observedCoordinates
        ? observedCoordinates
        : await this.location.requestCurrentCoordinates();
      if (generation !== this.generation) return;
      if (!coordinates) {
        await this.refreshPermissions();
        if (generation !== this.generation) return;
        throw new Error(this.i18n.translate(this.locationPermission() === 'denied'
          ? 'entry.permissions.location.blocked'
          : 'entry.permissions.location.unavailable'));
      }
      this.locationGranted.set(true);
      this.locationPermission.set('granted');
      this.locationSelected.set(true);
      this.nativePending.set(false);
      if (this.checkLocation || this.notificationsSelected()) this.busy.set(true);
      if (this.checkLocation && !await this.checkLocation(coordinates)) return;
      if (this.loggedIn()) {
        this.busy.set(true);
        if (!await this.location.saveCurrentCoordinates(coordinates)) {
          throw new Error(this.i18n.translate('entry.permissions.location.unavailable'));
        }
      }
      if (generation !== this.generation) return;
      // Registration follows native decisions, never a second permission prompt.
      if (this.notificationsSelected() !== this.messaging.deviceNotificationsEnabled()) {
        await this.messaging.setDeviceNotificationsEnabled(this.notificationsSelected());
      }
      if (generation === this.generation) {
        if (this.completeLogin) this.finish(true);
        else {
          this.notificationsEdited.set(false);
          this.showSaveFeedback();
        }
      }
    } catch (error) {
      if (generation === this.generation) {
        this.notificationsSelected.set(this.messaging.deviceNotificationsEnabled());
        this.notificationsEdited.set(false);
        this.error.set(error instanceof Error ? error.message : this.i18n.translate('entry.permissions.checking'));
      }
    } finally {
      if (generation === this.generation || !this.isOpen()) {
        this.locationRequestPending = false;
        this.nativePending.set(false);
        this.busy.set(false);
      }
    }
  }

  ngOnDestroy(): void {
    this.clearSaveFeedback();
  }

  private showSaveFeedback(): void {
    this.clearSaveFeedback();
    this.saveSucceeded.set(true);
    this.saveFeedbackTimer = setTimeout(() => {
      this.saveFeedbackTimer = null;
      this.saveSucceeded.set(false);
    }, 1000);
  }

  private clearSaveFeedback(): void {
    if (this.saveFeedbackTimer !== null) clearTimeout(this.saveFeedbackTimer);
    this.saveFeedbackTimer = null;
    this.saveSucceeded.set(false);
  }

  private finish(allowed: boolean): void {
    this.clearSaveFeedback();
    this.generation++;
    this.opening = false;
    if (this.permission) this.permission.onchange = null;
    this.permission = null;
    this.isOpen.set(false);
    this.pwa.dismissInstallPrompt();
    const complete = this.completeLogin;
    this.completeLogin = null;
    this.checkLocation = null;
    complete?.(allowed);
  }
}
