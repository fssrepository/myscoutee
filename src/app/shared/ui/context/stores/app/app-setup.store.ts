import { markLandingDebug } from '../../../../core/common/landing-debug';
import { Injectable, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { AppLocationService } from '../../../../core/base/services/accounts/app-location.service';
import { FirebaseMessagingService } from '../../../../core/base/services/notifications/firebase-messaging.service';
import { I18nService } from '../../../../core/base/services/localization/i18n.service';
import { PwaService } from '../../../../core/base/services/platform/pwa.service';
import { UserProfileStore } from '../profile/user-profile.store';
import type { LocationCoordinates } from '../../../../core/contracts/accounts/user.interface';
import { APP_SETUP_CONFIG } from '../../../../core/base/config';

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
  readonly locationAvailable = computed(() => this.location.browserCoordinates() !== null);
  readonly locationPermission = signal<PermissionState | null>(null);
  readonly locationPermissionPending = signal(false);
  readonly nativePending = signal(false);
  readonly busy = signal(false);
  readonly notificationConfigurationPending = signal(false);
  readonly actionPending = computed(() => this.nativePending() || this.busy());
  readonly error = signal('');
  readonly saveSucceeded = signal(false);
  readonly activeControl = signal<'location' | 'notifications' | null>(null);
  readonly launcherDismissed = signal(false);
  readonly guideRequested = signal(false);
  readonly privacyRequested = signal(false);
  readonly privacyMissing = signal(true);
  readonly dragPosition = signal({ x: 0, y: 0 });
  // Count only device choices that this browser currently offers.
  readonly locationSetupMissing = computed(() => !this.locationAvailable() || !this.location.trackingEnabled());
  readonly missingCount = computed(() => Number(this.locationSetupMissing())
    + Number(this.messaging.notificationsConfigured && !this.messaging.deviceNotificationsEnabled())
    + Number(!this.pwa.installed() && (this.pwa.installAvailable() || this.pwa.installActionPending()))
    + Number(this.privacyMissing()));
  readonly launcherVisible = computed(() => !this.isOpen() && this.missingCount() > 0 && !this.launcherDismissed());
  readonly permissionDenied = computed(() => this.locationPermission() === 'denied'
    || this.messaging.notificationPermission() === 'denied');
  readonly launcherIcon = computed(() => this.permissionDenied() ? 'shield' : 'install_mobile');
  readonly launcherPalette = computed(() => this.permissionDenied() ? 'orange' as const : 'violet' as const);

  explainMissingSetup(): boolean {
    if (!this.locationSetupMissing()) return false;
    this.launcherDismissed.set(false);
    this.guideRequested.set(true);
    return true;
  }
  private saveFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  readonly allowDisabled = computed(() => this.actionPending() || this.notificationConfigurationPending() || this.locationPermissionPending());
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
    void this.allow('location');
  }

  toggleNotifications(): void {
    if (this.actionPending() || this.notificationConfigurationPending() || !this.messaging.notificationsConfigured) return;
    this.clearSaveFeedback();
    this.notificationsEdited.set(true);
    this.notificationsSelected.update(value => !value);
    void this.allow('notifications');
  }

  open(): void {
    markLandingDebug('setup.open');
    if (this.isOpen()) return;
    this.generation++;
    this.clearSaveFeedback();
    this.error.set('');
    this.locationEdited.set(false);
    this.locationSelected.set(this.locationAvailable() && this.location.trackingEnabled());
    this.notificationsEdited.set(false);
    this.notificationsSelected.set(this.messaging.deviceNotificationsEnabled());
    // Show the popup immediately; only the controls that need async state wait.
    const generation = this.generation;
    this.notificationConfigurationPending.set(true);
    this.locationPermissionPending.set(true);
    this.isOpen.set(true);
    void this.location.loadSavedCoordinates().then(() => {
      if (generation === this.generation && !this.locationEdited()) {
        this.locationSelected.set(this.locationAvailable() && this.location.trackingEnabled());
      }
    });
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
    this.locationSelected.set(this.locationAvailable() && this.location.trackingEnabled());
    return new Promise(resolve => { this.completeLogin = resolve; });
  }

  async refreshPermissions(): Promise<void> {
    this.messaging.refreshNotificationPermission();

    const generation = this.generation;
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (generation !== this.generation) return;
      if (this.permission) this.permission.onchange = null;
      this.permission = permission;
      const update = () => {
        markLandingDebug('location.' + permission.state);
        this.locationPermission.set(permission.state);
        this.locationGranted.set(permission.state === 'granted');
        if (this.locationRequestPending && permission.state === 'granted') {
          this.startLocationAcquisitionTimer();
        }

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
    markLandingDebug('setup.close');
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

  openPrivacy(): void {
    if (this.actionPending()) return;
    this.privacyRequested.set(true);
  }

  async allow(control?: 'location' | 'notifications'): Promise<void> {
    markLandingDebug('setup.save');
    if (!this.isOpen() || this.actionPending()
      || (control !== 'notifications' && this.locationPermissionPending())
      || (control !== 'location' && this.notificationConfigurationPending())) return;
    this.clearSaveFeedback();
    this.activeControl.set(control ?? null);
    const updateLocation = control !== 'notifications';
    const updateNotifications = control !== 'location';
    if (updateLocation && (this.loginRequested() || (!control && (!this.loggedIn() || this.checkLocation))) && !this.locationSelected()) {
      this.error.set(this.i18n.translate('entry.permissions.location.required'));
      return;
    }
    this.nativePending.set(true);
    this.error.set('');
    const generation = this.generation;
    try {
      // Notifications need the original button gesture. Geolocation follows
      // only after that native decision settles. An enabled choice must succeed.
      if (updateNotifications && this.notificationsSelected()) {
        markLandingDebug('notifications.request');
        const decision = await this.messaging.requestEntryPermission();
        markLandingDebug('notifications.' + decision);
        if (generation !== this.generation) return;
        if (decision !== 'granted') {
          this.error.set(this.i18n.translate('entry.permissions.notifications.blocked'));
          return;
        }
      }
      if (generation !== this.generation) return;
      const needsLocation = updateLocation && this.locationSelected()
        && (!!this.checkLocation || !this.locationAvailable() || (this.loggedIn() && this.locationMissing()));
      if (!needsLocation) {
        if (updateLocation) this.location.setTrackingEnabled(this.locationSelected());
        this.nativePending.set(false);
        this.busy.set(true);
        if (updateNotifications && this.notificationsSelected() !== this.messaging.deviceNotificationsEnabled()) {
          await this.messaging.setDeviceNotificationsEnabled(this.notificationsSelected());
        }
        if (generation === this.generation) {
          this.showSaveFeedback(updateLocation);
        }
        return;
      }
      const savedCoordinates = !this.checkLocation ? this.location.browserCoordinates() : null;
      if (!savedCoordinates) {
        this.locationRequestPending = true;
        this.locationRequestAbort = new AbortController();
        if (this.locationPermission() === 'granted') this.startLocationAcquisitionTimer();
      }
      const coordinates = savedCoordinates
        ?? await this.location.requestCurrentCoordinates(this.locationRequestAbort!.signal);
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
      if (updateLocation) this.location.setTrackingEnabled(this.locationSelected());
      // Registration follows native decisions, never a second permission prompt.
      if (updateNotifications && this.notificationsSelected() !== this.messaging.deviceNotificationsEnabled()) {
        await this.messaging.setDeviceNotificationsEnabled(this.notificationsSelected());
      }
      if (generation === this.generation) {
        this.showSaveFeedback(updateLocation);
      }
    } catch (error) {
      markLandingDebug('setup.failed');
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
    if (this.permission) this.permission.onchange = null;
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

  private showSaveFeedback(allowLogin = true): void {
    this.clearSaveFeedback();
    if (this.completeLogin && (allowLogin || (this.locationAvailable() && !this.checkLocation))) {
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
    this.isOpen.set(false);
    this.pwa.dismissInstallPrompt();
    const complete = this.completeLogin;
    this.completeLogin = null;
    this.loginRequested.set(false);
    this.checkLocation = null;
    complete?.(allowed);
  }
}
