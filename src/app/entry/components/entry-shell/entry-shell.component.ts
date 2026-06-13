import { ChangeDetectorRef, Component, EventEmitter, HostListener, Injector, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';

import {
  AppPopupContext,
  LandingContentService,
  PrivacyPolicyService,
  UsersService,
  type UserLocationEligibilityResponseDto
} from '../../../shared/core';
import type * as AppTypes from '../../../shared/core/base/models';
import type {
  EntryConsentAuditRecordDto,
  EntryConsentStateDto,
  FirebaseAuthProfileDto,
  FirebaseAuthRequestDto,
  LocationCoordinates
} from '../../../shared/core/contracts/user.interface';
import { APP_STORAGE_KEYS } from '../../../shared/core/common/storage-scope';
import { ConfirmationDialogComponent } from '../../../shared/ui/components/confirmation-dialog/confirmation-dialog.component';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { I18nService } from '../../../shared/core';
import { SeedStaticContentService } from '../../../shared/core/local/seed';
import type { InfoCardData } from '../../../shared/ui';
import { PrivacyPolicyPopupComponent } from '../../../shared/ui/components/privacy-policy-popup';
import { TermsPolicyComponent } from '../../../shared/ui/components/terms-policy';
import { EntryFirebaseAuthPopupComponent } from '../entry-firebase-auth-popup/entry-firebase-auth-popup.component';
import { EntryLandingComponent } from '../entry-landing/entry-landing.component';

export interface EntryDemoUserSelectionEvent {
  userId: string;
  complete: () => void;
  fail: () => void;
}

@Component({
  selector: 'app-entry-shell',
  standalone: true,
  imports: [
    EntryLandingComponent,
    PrivacyPolicyPopupComponent,
    TermsPolicyComponent,
    EntryFirebaseAuthPopupComponent,
    ConfirmationDialogComponent
  ],
  templateUrl: './entry-shell.component.html',
  styleUrl: './entry-shell.component.scss'
})
export class EntryShellComponent implements OnChanges, OnDestroy {
  private static readonly ENTRY_CONSENT_KEY = APP_STORAGE_KEYS.entryConsent;
  private static readonly ENTRY_CONSENT_AUDIT_KEY = APP_STORAGE_KEYS.entryConsentAudit;
  private static readonly ENTRY_CONSENT_AUDIT_MAX = 30;
  private static readonly LOCATION_REQUEST_TIMEOUT_MS = 4500;
  private static readonly LOCATION_REQUEST_MAXIMUM_AGE_MS = 0;

  private readonly injector = inject(Injector);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly privacyPolicy = inject(PrivacyPolicyService);
  private readonly landingContent = inject(LandingContentService);
  private readonly staticContentSeed = inject(SeedStaticContentService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly i18n = inject(I18nService);
  private usersServiceRef: UsersService | null = null;
  private loginEligibilityBusy = false;
  private entryContentLoadPromise: Promise<void> | null = null;

  @Input({ required: true }) authMode: AppTypes.AuthMode = 'selector';
  @Input() firebaseAuthProfile: FirebaseAuthProfileDto | null = null;
  @Input() firebaseAuthIsBusy = false;
  @Input() firebaseAuthMessage = '';
  @Input() isMobileView = false;

  @Output() readonly demoUserSelected = new EventEmitter<EntryDemoUserSelectionEvent>();
  @Output() readonly firebaseAuthRequested = new EventEmitter<FirebaseAuthRequestDto>();
  @Output() readonly firebaseSessionContinueRequested = new EventEmitter<void>();
  @Output() readonly entryConsentStateChanged = new EventEmitter<boolean>();

  protected showEntryConsentPopup = false;
  protected showEntryTermsPopup = false;
  protected entryConsentViewOnly = false;
  protected entryPrivacyLoading = true;
  protected landingArticlesLoading = true;
  protected landingIdeaCards: InfoCardData[] = [];
  protected entryAuthUnavailable = false;
  protected entryAuthUnavailableLabel = 'Unavailable in your country';
  protected entryAuthLocationRequired = false;
  protected entryAuthLocationRequiredLabel = 'Allow location';
  protected entryNetworkUnavailable = false;
  protected entryNetworkUnavailableLabel = 'No network';
  protected showFirebaseAuthPopup = false;
  private landingContentRequestToken = 0;
  private landingLoginAvailability: UserLocationEligibilityResponseDto | null = null;
  private locationEligibilityResolvedFromCoordinates = false;
  private grantedLocationEligibilityPromise: Promise<void> | null = null;
  private grantedLocationEligibilityRequestToken = 0;
  private browserLocationAutoRequestAttempted = false;
  private geolocationPermissionStatus: PermissionStatus | null = null;
  private geolocationPermissionState: PermissionState | null = null;
  private readonly geolocationPermissionChangeHandler = (): void => {
    this.ngZone.run(() => {
      this.geolocationPermissionState = this.geolocationPermissionStatus?.state ?? null;
      if (this.geolocationPermissionState === 'granted') {
        this.browserLocationAutoRequestAttempted = false;
      }
      this.syncEntryAuthGateState();
    });
  };

  constructor() {
    this.initializeEntryFlow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['authMode']) {
      this.syncEntryAuthGateState();
    }
    if (changes['firebaseAuthProfile'] && this.firebaseAuthProfile) {
      this.showFirebaseAuthPopup = false;
    }
  }

  ngOnDestroy(): void {
    this.landingContentRequestToken += 1;
    this.grantedLocationEligibilityRequestToken += 1;
    this.unbindGeolocationPermissionStatus();
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onGlobalEscape(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    if (this.showFirebaseAuthPopup) {
      keyboardEvent.stopPropagation();
      this.closeFirebaseAuthPopup();
    }
  }

  protected get hasEntryConsent(): boolean {
    return !this.entryPrivacyLoading && this.loadEntryConsentState() !== null;
  }

  protected async openEntryDemo(): Promise<void> {
    if (this.entryNetworkUnavailable) {
      return;
    }
    if (!this.ensureEntryConsent()) {
      return;
    }
    this.openDemoUserSelectorPopup();
  }

  protected async openEntryFirebaseAuth(): Promise<void> {
    if (this.entryNetworkUnavailable) {
      return;
    }
    if (this.isLoginBlockedByLandingBundle()) {
      this.openBundledLoginUnavailableInfo();
      return;
    }
    if (this.isLoginLocationRequiredByLandingBundle()) {
      const allowed = await this.ensureHttpLoginAccessAllowed();
      if (!allowed) {
        return;
      }
    }
    if (!this.ensureEntryConsent()) {
      return;
    }
    if (this.authMode !== 'firebase') {
      this.openDemoUserSelectorPopup();
      return;
    }
    if (this.loginEligibilityBusy) {
      return;
    }
    if (this.firebaseAuthProfile) {
      this.firebaseSessionContinueRequested.emit();
      return;
    }
    this.showFirebaseAuthPopup = true;
  }

  protected closeFirebaseAuthPopup(): void {
    this.showFirebaseAuthPopup = false;
  }

  protected onRequestFirebaseAuth(request: FirebaseAuthRequestDto): void {
    if (this.firebaseAuthIsBusy) {
      return;
    }
    this.firebaseAuthRequested.emit(request);
  }

  protected openEntryConsentPopup(viewOnly = false): void {
    if (this.entryNetworkUnavailable) {
      return;
    }
    if (this.privacyPolicy.state() === null) {
      this.entryPrivacyLoading = true;
      void this.loadEntryContent();
    }
    this.entryConsentViewOnly = viewOnly;
    this.showEntryConsentPopup = true;
  }

  protected closeEntryConsentPopup(): void {
    if (this.entryPrivacyLoading) {
      return;
    }
    this.showEntryConsentPopup = false;
    this.entryConsentViewOnly = false;
  }

  protected openEntryTermsPopup(): void {
    this.showEntryTermsPopup = true;
  }

  protected closeEntryTermsPopup(): void {
    this.showEntryTermsPopup = false;
  }

  protected acceptEntryConsent(): void {
    const version = this.entryConsentVersion();
    if (this.entryPrivacyLoading || !version) {
      return;
    }
    const nowIso = new Date().toISOString();
    const consent: EntryConsentStateDto = {
      version,
      accepted: true,
      acceptedAtIso: nowIso
    };
    localStorage.setItem(EntryShellComponent.ENTRY_CONSENT_KEY, JSON.stringify(consent));
    this.appendEntryConsentAudit('accepted', nowIso);
    this.showEntryConsentPopup = false;
    this.entryConsentViewOnly = false;
    this.entryConsentStateChanged.emit(true);
  }

  protected rejectEntryConsent(): void {
    const nowIso = new Date().toISOString();
    localStorage.removeItem(EntryShellComponent.ENTRY_CONSENT_KEY);
    this.appendEntryConsentAudit('rejected', nowIso);
    this.showEntryConsentPopup = false;
    this.entryConsentViewOnly = false;
    this.entryConsentStateChanged.emit(false);
  }

  private initializeEntryFlow(): void {
    this.entryConsentViewOnly = false;
    this.entryPrivacyLoading = this.privacyPolicy.state() === null;
    this.showEntryConsentPopup = !this.entryPrivacyLoading && this.shouldPromptEntryConsent();
    this.landingArticlesLoading = true;
    this.syncLandingLoginAvailability(null, 'reset');
    this.showFirebaseAuthPopup = false;
    void this.loadEntryContent();
  }

  private get usersService(): UsersService {
    if (!this.usersServiceRef) {
      this.usersServiceRef = this.injector.get(UsersService);
    }
    return this.usersServiceRef;
  }

  private ensureEntryConsent(): boolean {
    if (this.entryNetworkUnavailable) {
      return false;
    }
    if (this.hasEntryConsent) {
      return true;
    }
    this.entryConsentViewOnly = false;
    this.showEntryConsentPopup = true;
    if (this.privacyPolicy.state() === null) {
      this.entryPrivacyLoading = true;
      void this.loadEntryContent();
      return false;
    }
    if (this.entryPrivacyLoading) {
      return false;
    }
    return false;
  }

  private async ensureHttpLoginAccessAllowed(): Promise<boolean> {
    this.loginEligibilityBusy = true;
    try {
      const gateState = this.landingLoginAvailability;
      if (this.locationEligibilityResolvedFromCoordinates && gateState?.eligible === true) {
        return true;
      }
      if (this.locationEligibilityResolvedFromCoordinates && gateState && gateState.eligible === false) {
        this.confirmationDialogService.openInfo(
          this.loginUnavailableMessage(gateState),
          {
            title: 'Please register',
            confirmLabel: 'OK'
          }
        );
        return false;
      }

      return await this.requestLocationAccessFromDialog();
    } catch {
      this.confirmationDialogService.openInfo(
        'We could not complete the region-based check right now. Please try again later.',
        {
          title: 'Check Unavailable',
          confirmLabel: 'OK'
        }
      );
      return false;
    } finally {
      this.loginEligibilityBusy = false;
    }
  }

  private openDemoUserSelectorPopup(): void {
    this.popupCtx.openDemoBootstrapSelector({
      mode: 'member',
      onSelect: userId => new Promise<boolean>(resolve => {
        this.ngZone.run(() => {
          this.demoUserSelected.emit({
            userId,
            complete: () => resolve(true),
            fail: () => resolve(false)
          });
        });
      })
    });
  }

  private async requestCurrentLocation(): Promise<LocationCoordinates | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return null;
    }

    return new Promise<LocationCoordinates | null>(resolve => {
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const finish = (coordinates: LocationCoordinates | null): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        resolve(coordinates);
      };

      timeoutId = setTimeout(
        () => finish(null),
        EntryShellComponent.LOCATION_REQUEST_TIMEOUT_MS + 500
      );

      navigator.geolocation.getCurrentPosition(
        position => {
          const latitude = Number(position.coords.latitude);
          const longitude = Number(position.coords.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            finish(null);
            return;
          }
          finish({ latitude, longitude });
        },
        () => finish(null),
        {
          enableHighAccuracy: false,
          timeout: EntryShellComponent.LOCATION_REQUEST_TIMEOUT_MS,
          maximumAge: EntryShellComponent.LOCATION_REQUEST_MAXIMUM_AGE_MS
        }
      );
    });
  }

  private requestLocationAccessFromDialog(): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      let settled = false;
      const settle = (allowed: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        setTimeout(() => resolve(allowed), 0);
      };

      this.confirmationDialogService.open({
        title: this.uiText('Location Required For Login'),
        message: this.uiText('We need your location before login so we can apply the region-based security check.'),
        cancelLabel: this.uiText('Not now'),
        confirmLabel: this.uiText('Allow location'),
        busyConfirmLabel: this.uiText('Checking location...'),
        failureMessage: this.uiText('Location permission was not granted. Use the browser prompt or site settings, then try again.'),
        allowBackdropClose: true,
        allowEscapeClose: true,
        onCancel: () => settle(false),
        onConfirm: async () => {
          const coordinates = await this.requestCurrentLocation();
          if (!coordinates) {
            throw new Error(this.uiText('Location permission was not granted. Use the browser prompt or site settings, then try again.'));
          }

          let result: UserLocationEligibilityResponseDto;
          try {
            result = await this.usersService.checkLocationEligibility(coordinates);
          } catch {
            this.markEntryNetworkUnavailable();
            settle(false);
            setTimeout(() => {
              this.confirmationDialogService.openInfo(
                this.uiText('The server is not reachable right now. Please try again when the network is back.'),
                {
                  title: this.uiText('No network'),
                  confirmLabel: this.uiText('OK')
                }
              );
            }, 0);
            return;
          }
          this.syncLandingLoginAvailability(result, 'coordinates');
          if (result.eligible) {
            settle(true);
            return;
          }

          settle(false);
          setTimeout(() => {
            this.confirmationDialogService.openInfo(
              this.uiText(result.message?.trim() || 'Login is currently unavailable from your country or region for security reasons. Please come back later.'),
              {
                title: this.uiText('Please register'),
                confirmLabel: this.uiText('OK')
              }
            );
          }, 0);
        }
      });
    });
  }

  private uiText(value: string): string {
    return this.i18n.translate(value);
  }

  private waitForPopupPaint(): Promise<void> {
    return new Promise(resolve => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            setTimeout(resolve, 80);
          });
        });
        return;
      }
      setTimeout(resolve, 80);
    });
  }

  private waitForLoaderCompletionBeat(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 240));
  }

  private commitDemoSelectorState(update: () => void): void {
    this.ngZone.run(() => {
      update();
      this.changeDetectorRef.markForCheck();
    });
  }

  private loadEntryConsentState(): EntryConsentStateDto | null {
    const expectedVersion = this.entryConsentVersion();
    if (!expectedVersion) {
      return null;
    }
    const raw = localStorage.getItem(EntryShellComponent.ENTRY_CONSENT_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<EntryConsentStateDto>;
      if (
        parsed.version !== expectedVersion ||
        parsed.accepted !== true ||
        typeof parsed.acceptedAtIso !== 'string' ||
        parsed.acceptedAtIso.length === 0
      ) {
        return null;
      }
      return {
        version: parsed.version,
        accepted: true,
        acceptedAtIso: parsed.acceptedAtIso
      };
    } catch {
      return null;
    }
  }

  private appendEntryConsentAudit(action: EntryConsentAuditRecordDto['action'], tsIso: string): void {
    const record: EntryConsentAuditRecordDto = {
      tsIso,
      action,
      version: this.entryConsentVersion(),
      source: 'entry',
      userAgent: navigator.userAgent
    };
    const existing = this.loadEntryConsentAudit();
    existing.unshift(record);
    const trimmed = existing.slice(0, EntryShellComponent.ENTRY_CONSENT_AUDIT_MAX);
    localStorage.setItem(EntryShellComponent.ENTRY_CONSENT_AUDIT_KEY, JSON.stringify(trimmed));
  }

  private loadEntryConsentAudit(): EntryConsentAuditRecordDto[] {
    const raw = localStorage.getItem(EntryShellComponent.ENTRY_CONSENT_AUDIT_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as EntryConsentAuditRecordDto[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private shouldPromptEntryConsent(): boolean {
    return this.entryConsentVersion().length > 0 && this.loadEntryConsentState() === null;
  }

  private async loadEntryContent(): Promise<void> {
    if (this.entryContentLoadPromise) {
      return this.entryContentLoadPromise;
    }
    const requestToken = ++this.landingContentRequestToken;
    this.startEntryPrivacyLoadingWindow();
    this.startLandingArticlesLoadingWindow();
    this.entryContentLoadPromise = (async () => {
      try {
        if (this.landingContent.usesLocalContent()) {
          await this.staticContentSeed.ensureReady();
        }
        const displayState = await this.landingContent.loadDisplayState();
        this.ngZone.run(() => {
          if (requestToken !== this.landingContentRequestToken) {
            return;
          }
          this.entryNetworkUnavailable = false;
          this.landingIdeaCards = displayState.ideaCards;
          if (!this.locationEligibilityResolvedFromCoordinates
            && (displayState.state.loginAvailability || this.landingLoginAvailability === null)) {
            this.syncLandingLoginAvailability(displayState.state.loginAvailability, 'bundle');
          }
          this.finishEntryPrivacyLoad(requestToken);
          this.changeDetectorRef.markForCheck();
        });
      } catch {
        this.ngZone.run(() => {
          if (requestToken !== this.landingContentRequestToken) {
            return;
          }
          this.landingIdeaCards = [];
          this.markEntryNetworkUnavailable();
          this.finishEntryPrivacyLoad(requestToken);
        });
      }
    })().finally(() => {
      this.ngZone.run(() => {
        if (requestToken !== this.landingContentRequestToken) {
          return;
        }
        this.endLandingArticlesLoadingWindow();
        this.changeDetectorRef.markForCheck();
      });
      this.entryContentLoadPromise = null;
    });
    return this.entryContentLoadPromise;
  }

  private finishEntryPrivacyLoad(requestToken: number): void {
    if (requestToken !== this.landingContentRequestToken) {
      return;
    }
    this.endEntryPrivacyLoadingWindow();
    if (!this.entryNetworkUnavailable && !this.entryConsentViewOnly) {
      this.showEntryConsentPopup = this.shouldPromptEntryConsent();
    }
    this.changeDetectorRef.markForCheck();
    this.entryConsentStateChanged.emit(this.hasEntryConsent);
  }

  private entryConsentVersion(): string {
    const revision = this.privacyPolicy.activeRevision();
    if (!revision) {
      return '';
    }
    return `privacy:${revision.id}:v${revision.version}`;
  }

  private startEntryPrivacyLoadingWindow(): void {
    this.entryPrivacyLoading = true;
  }

  private endEntryPrivacyLoadingWindow(): void {
    this.entryPrivacyLoading = false;
  }

  private startLandingArticlesLoadingWindow(): void {
    this.landingArticlesLoading = true;
  }

  private endLandingArticlesLoadingWindow(): void {
    this.changeDetectorRef.markForCheck();
    setTimeout(() => {
      this.ngZone.run(() => {
        this.landingArticlesLoading = false;
        this.changeDetectorRef.markForCheck();
      });
    }, 100);
  }

  private syncLandingLoginAvailability(
    availability: UserLocationEligibilityResponseDto | null | undefined,
    source: 'bundle' | 'coordinates' | 'reset' = 'bundle'
  ): void {
    if (source === 'coordinates') {
      this.locationEligibilityResolvedFromCoordinates = true;
    } else if (source === 'reset') {
      this.locationEligibilityResolvedFromCoordinates = false;
      this.browserLocationAutoRequestAttempted = false;
    }
    this.landingLoginAvailability = availability
      ? {
          eligible: availability.eligible !== false,
          partitionKey: availability.partitionKey ?? null,
          message: availability.message ?? null,
          securityGateEnabled: availability.securityGateEnabled === true,
          locationRequired: false
      }
      : null;
    this.syncEntryAuthGateState();
  }

  private markEntryNetworkUnavailable(): void {
    this.entryNetworkUnavailable = true;
    this.entryNetworkUnavailableLabel = 'No network';
    this.syncLandingLoginAvailability(null, 'reset');
  }

  private syncEntryAuthGateState(): void {
    const loginEnabled = this.authMode === 'firebase';
    this.entryAuthUnavailable = !this.entryNetworkUnavailable && loginEnabled && this.isLoginBlockedByLandingBundle();
    this.entryAuthUnavailableLabel = 'Unavailable in your country';
    this.entryAuthLocationRequired = !this.entryNetworkUnavailable && loginEnabled && this.isLoginLocationRequiredByLandingBundle();
    this.deferEntryAuthLocationRequiredLabel(this.grantedLocationEligibilityPromise ? 'Checking location' : 'Allow location');
    this.resolveBrowserLocationAccessIfNeeded();
    this.changeDetectorRef.markForCheck();
  }

  private isLoginBlockedByLandingBundle(): boolean {
    return this.landingLoginAvailability !== null
      && this.locationEligibilityResolvedFromCoordinates
      && this.landingLoginAvailability.securityGateEnabled === true
      && this.landingLoginAvailability.eligible === false;
  }

  private isLoginLocationRequiredByLandingBundle(): boolean {
    return !this.entryNetworkUnavailable
      && !this.locationEligibilityResolvedFromCoordinates;
  }

  private openBundledLoginUnavailableInfo(): void {
    this.confirmationDialogService.openInfo(this.loginUnavailableMessage(this.landingLoginAvailability), {
      title: 'Please register',
      confirmLabel: 'OK'
    });
  }

  private loginUnavailableMessage(availability: UserLocationEligibilityResponseDto | null): string {
    return availability?.message?.trim()
      || 'Login is currently unavailable from your country or region for security reasons. Please come back later.';
  }

  private resolveBrowserLocationAccessIfNeeded(): void {
    if (!this.entryAuthLocationRequired || this.grantedLocationEligibilityPromise || this.browserLocationAutoRequestAttempted) {
      return;
    }

    this.browserLocationAutoRequestAttempted = true;
    const requestToken = ++this.grantedLocationEligibilityRequestToken;
    this.grantedLocationEligibilityPromise = this.resolveBrowserLocationAccess(requestToken)
      .finally(() => {
        if (requestToken === this.grantedLocationEligibilityRequestToken) {
          this.ngZone.run(() => {
            this.grantedLocationEligibilityPromise = null;
            this.syncEntryAuthGateState();
          });
        }
      });
    this.deferEntryAuthLocationRequiredLabel('Checking location');
  }

  private deferEntryAuthLocationRequiredLabel(label: string): void {
    const nextLabel = label.trim() || 'Allow location';
    if (this.entryAuthLocationRequiredLabel === nextLabel) {
      return;
    }
    setTimeout(() => {
      this.ngZone.run(() => {
        this.entryAuthLocationRequiredLabel = nextLabel;
        this.changeDetectorRef.markForCheck();
      });
    }, 0);
  }

  private async resolveBrowserLocationAccess(requestToken: number): Promise<void> {
    try {
      const permissionState = await this.queryGeolocationPermissionState();
      if (requestToken !== this.grantedLocationEligibilityRequestToken) {
        return;
      }
      if (permissionState !== 'granted') {
        return;
      }

      const coordinates = await this.requestCurrentLocation();
      if (requestToken !== this.grantedLocationEligibilityRequestToken || !coordinates) {
        return;
      }

      let result: UserLocationEligibilityResponseDto;
      try {
        result = await this.usersService.checkLocationEligibility(coordinates);
      } catch {
        if (requestToken === this.grantedLocationEligibilityRequestToken) {
          this.ngZone.run(() => this.markEntryNetworkUnavailable());
        }
        return;
      }
      if (requestToken !== this.grantedLocationEligibilityRequestToken) {
        return;
      }

      this.ngZone.run(() => {
        this.syncLandingLoginAvailability(result, 'coordinates');
        this.changeDetectorRef.markForCheck();
      });
    } catch {
      // Keep the explicit "Allow location" action available if the silent refresh cannot complete.
    }
  }

  private async queryGeolocationPermissionState(): Promise<PermissionState | null> {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return null;
    }

    try {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      this.bindGeolocationPermissionStatus(status);
      this.geolocationPermissionState = status.state;
      return status.state;
    } catch {
      return null;
    }
  }

  private bindGeolocationPermissionStatus(status: PermissionStatus): void {
    if (this.geolocationPermissionStatus === status) {
      return;
    }

    this.unbindGeolocationPermissionStatus();
    this.geolocationPermissionStatus = status;
    this.geolocationPermissionState = status.state;
    status.addEventListener('change', this.geolocationPermissionChangeHandler);
  }

  private unbindGeolocationPermissionStatus(): void {
    if (!this.geolocationPermissionStatus) {
      return;
    }

    this.geolocationPermissionStatus.removeEventListener('change', this.geolocationPermissionChangeHandler);
    this.geolocationPermissionStatus = null;
    this.geolocationPermissionState = null;
  }

}
