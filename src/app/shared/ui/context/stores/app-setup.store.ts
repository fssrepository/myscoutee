import { Injectable, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { AppLocationService } from '../../../core/base/services/app-location.service';
import { FirebaseMessagingService } from '../../../core/base/services/firebase-messaging.service';
import { I18nService } from '../../../core/base/services/i18n.service';
import { PwaService } from '../../../core/base/services/pwa.service';
import { UserProfileStore } from './user-profile.store';
import type { LocationCoordinates } from '../../../core/contracts/user.interface';
import { APP_SETUP_CONFIG } from '../../../core/base/config';

@Injectable({ providedIn: 'root' })
export class AppSetupStore implements OnDestroy {
  readonly pwa = inject(PwaService);
  readonly messaging = inject(FirebaseMessagingService);
  private readonly location = inject(AppLocationService);
  private readonly i18n = inject(I18nService);
  private readonly profile = inject(UserProfileStore);
  readonly loggedIn = computed(() => !!this.profile.activeUserId());
  readonly locationMissing = this.profile.activeUserLocationMissing;
  readonly isOpen = signal(false);
  readonly loginRequested = signal(false);
  readonly locationSelected = signal(false);
  readonly notificationsSelected = signal(false);
  private readonly locationEdited = signal(false);
  private readonly notificationsEdited = signal(false);
  readonly locationGranted = signal(false);
  readonly locationPermission = signal<PermissionState | null>(null);
  readonly locationPermissionPending = signal(false);
  readonly nativePending = signal(false);
  readonly busy = signal(false);
  readonly notificationConfigurationPending = signal(false);
  readonly actionPending = computed(() => this.nativePending() || this.busy());
  readonly error = signal('');
  readonly saveSucceeded = signal(false);
  private saveFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  readonly allowDisabled = computed(() => this.busy() || this.notificationConfigurationPending() || this.locationPermissionPending()
    || (this.isOpen() && (!this.loggedIn() || !!this.checkLocation) && !this.locationSelected()));
  private locationRequestPending = false;
  private locationRequestAbort: AbortController | null = null;
  private locationRequestTimer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private permission: PermissionStatus | null = null;
  private completeLogin: ((allowed: boolean) => void) | null = null;
  private checkLocation: ((coordinates: LocationCoordinates) => Promise<boolean>) | null = null;

  constructor() {
    effect(() => {
      const enabled = this.messaging.deviceNotificationsEnabled();
      if (this.isOpen() && !this.actionPending()
        && !this.notificationsEdited()) {
        this.notificationsSelected.set(enabled);
      }
    });
  }

  toggleLocation(): void {
    if (this.actionPending() || this.locationPermissionPending()) return;
    this.clearSaveFeedback();
    this.locationEdited.set(true);
    this.locationSelected.update(value => !value);
  }

  toggleNotifications(): void {
    if (this.notificationConfigurationPending() || !this.messaging.notificationsConfigured) return;
    this.clearSaveFeedback();
    this.notificationsEdited.set(true);
    this.notificationsSelected.update(value => !value);
  }

  open(): void {
    if (this.isOpen()) return;
    this.generation++;
    this.clearSaveFeedback();
    this.error.set('');
    this.locationGranted.set(false);
    this.locationPermission.set(null);
    this.locationEdited.set(false);
    this.locationSelected.set(false);
    this.notificationsEdited.set(false);
    this.notificationsSelected.set(this.messaging.deviceNotificationsEnabled());
    // Show the popup immediately; only the controls that need async state wait.
    const generation = this.generation;
    this.notificationConfigurationPending.set(true);
    this.locationPermissionPending.set(true);
    this.isOpen.set(true);
    void this.refreshPermissions();
    void this.messaging.prepareNotificationConfiguration().catch(() => undefined).then(() => {
      if (generation !== this.generation) return;
      this.notificationConfigurationPending.set(false);
      if (!this.notificationsEdited()) this.notificationsSelected.set(this.messaging.deviceNotificationsEnabled());
    });
  }

  requestForLogin(checkLocation: ((coordinates: LocationCoordinates) => Promise<boolean>) | null = null): Promise<boolean> {
    // Repeated Login clicks share one open workflow instead of stacking dialogs.
    if (this.completeLogin) return Promise.resolve(false);
    this.open();
    this.checkLocation = checkLocation;
    this.loginRequested.set(true);
    return new Promise(resolve => { this.completeLogin = resolve; });
  }

  async refreshPermissions(): Promise<void> {
    this.messaging.refreshNotificationPermission();

    const generation = this.generation;
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (!this.isOpen() || generation !== this.generation) return;
      if (this.permission) this.permission.onchange = null;
      this.permission = permission;
      const update = () => {
        this.locationPermission.set(permission.state);
        this.locationGranted.set(permission.state === 'granted');
        if (this.locationRequestPending && permission.state === 'granted') {
          this.startLocationAcquisitionTimer();
        }
        if (!this.locationEdited()) this.locationSelected.set(permission.state === 'granted' && this.location.trackingEnabled());
      };
      permission.onchange = update;
      update();
    } catch {
      if (generation === this.generation) this.locationGranted.set(false);
    } finally {
      if (generation === this.generation) this.locationPermissionPending.set(false);
    }
  }

  close(): void {
    this.stopLocationRequest();
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
    if ((!this.loggedIn() || this.checkLocation) && !this.locationSelected()) {
      this.error.set(this.i18n.translate('entry.permissions.location.required'));
      return;
    }
    this.nativePending.set(true);
    this.error.set('');
    const generation = this.generation;
    try {
      // Notifications need the original button gesture. Geolocation follows
      // only after that native decision settles. An enabled choice must succeed.
      if (this.notificationsSelected()) {
        const decision = await this.messaging.requestEntryPermission();
        if (generation !== this.generation) return;
        if (decision !== 'granted') {
          this.error.set(this.i18n.translate('entry.permissions.notifications.blocked'));
          return;
        }
      }
      if (generation !== this.generation) return;
      const needsLocation = !!this.checkLocation || (this.loggedIn()
        ? this.locationSelected() && (!this.locationGranted() || this.locationMissing())
        : !this.locationGranted());
      if (!needsLocation) {
        this.location.setTrackingEnabled(this.locationSelected());
        this.nativePending.set(false);
        this.busy.set(true);
        if (this.notificationsSelected() !== this.messaging.deviceNotificationsEnabled()) {
          await this.messaging.setDeviceNotificationsEnabled(this.notificationsSelected());
        }
        if (generation === this.generation) {
          this.showSaveFeedback();
        }
        return;
      }
      this.locationRequestPending = true;
      this.locationRequestAbort = new AbortController();
      if (this.locationPermission() === 'granted') this.startLocationAcquisitionTimer();
      const coordinates = await this.location.requestCurrentCoordinates(this.locationRequestAbort.signal);
      if (generation !== this.generation) return;
      this.stopLocationRequest();
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
      if (this.loggedIn() && !this.checkLocation) {
        this.busy.set(true);
        if (!await this.location.saveCurrentCoordinates(coordinates)) {
          throw new Error(this.i18n.translate('entry.permissions.location.unavailable'));
        }
      }
      if (generation !== this.generation) return;
      this.location.setTrackingEnabled(this.locationSelected());
      // Registration follows native decisions, never a second permission prompt.
      if (this.notificationsSelected() !== this.messaging.deviceNotificationsEnabled()) {
        await this.messaging.setDeviceNotificationsEnabled(this.notificationsSelected());
      }
      if (generation === this.generation) {
        this.showSaveFeedback();
      }
    } catch (error) {
      if (generation === this.generation) {
        this.error.set(error instanceof Error ? error.message : this.i18n.translate('entry.permissions.checking'));
      }
    } finally {
      if (generation === this.generation || !this.isOpen()) {
        this.stopLocationRequest();
        this.nativePending.set(false);
        this.busy.set(false);
      }
    }
  }

  ngOnDestroy(): void {
    this.stopLocationRequest();
    this.clearSaveFeedback();
  }

  private startLocationAcquisitionTimer(): void {
    if (!this.locationRequestAbort || this.locationRequestTimer !== null) return;
    const request = this.locationRequestAbort;
    this.busy.set(true);
    this.locationRequestTimer = setTimeout(() => request.abort(), APP_SETUP_CONFIG.locationRequestTimeoutMs);
  }

  private stopLocationRequest(): void {
    this.locationRequestPending = false;
    if (this.locationRequestTimer !== null) clearTimeout(this.locationRequestTimer);
    this.locationRequestTimer = null;
    this.locationRequestAbort?.abort();
    this.locationRequestAbort = null;
  }

  private showSaveFeedback(): void {
    this.clearSaveFeedback();
    if (this.completeLogin) {
      this.finish(true);
      return;
    }
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
    this.locationPermissionPending.set(false);
    this.notificationConfigurationPending.set(false);
    if (this.permission) this.permission.onchange = null;
    this.permission = null;
    this.isOpen.set(false);
    this.pwa.dismissInstallPrompt();
    const complete = this.completeLogin;
    this.completeLogin = null;
    this.loginRequested.set(false);
    this.checkLocation = null;
    complete?.(allowed);
  }
}
