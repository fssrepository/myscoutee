import { ChangeDetectorRef, Component, EventEmitter, HostListener, Injector, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';

import {
  AppContext,
  HelpCenterService,
  LandingContentService,
  USERS_LOAD_CONTEXT_KEY,
  UsersService,
  type DemoUserListItemDto,
  type UserLocationEligibilityResponseDto
} from '../../../shared/core';
import type { DemoBootstrapProgressStage } from '../../../shared/core/demo';
import type * as AppTypes from '../../../shared/core/base/models';
import type { LocationCoordinates } from '../../../shared/core/base/interfaces/location.interface';
import { ConfirmationDialogComponent } from '../../../shared/ui/components/confirmation-dialog/confirmation-dialog.component';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { I18nService } from '../../../shared/i18n';
import type { InfoCardData } from '../../../shared/ui';
import { EntryConsentPopupComponent } from '../entry-consent-popup/entry-consent-popup.component';
import { EntryDemoUserSelectorComponent } from '../entry-demo-user-selector/entry-demo-user-selector.component';
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
    EntryConsentPopupComponent,
    EntryDemoUserSelectorComponent,
    EntryFirebaseAuthPopupComponent,
    ConfirmationDialogComponent
  ],
  templateUrl: './entry-shell.component.html',
  styleUrl: './entry-shell.component.scss'
})
export class EntryShellComponent implements OnChanges, OnDestroy {
  private static readonly ENTRY_CONSENT_KEY = 'entry-gdpr-consent';
  private static readonly ENTRY_CONSENT_AUDIT_KEY = 'entry-gdpr-consent-audit';
  private static readonly ENTRY_CONSENT_AUDIT_MAX = 30;
  private static readonly LANDING_ARTICLES_LOADING_WINDOW_MS = 3000;
  private static readonly ENTRY_PRIVACY_LOADING_WINDOW_MS = 3000;

  private readonly injector = inject(Injector);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly appCtx = inject(AppContext);
  private readonly helpCenter = inject(HelpCenterService);
  private readonly landingContent = inject(LandingContentService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly i18n = inject(I18nService);
  private usersServiceRef: UsersService | null = null;
  private loginEligibilityBusy = false;
  private entryContentLoadPromise: Promise<void> | null = null;

  @Input({ required: true }) authMode: AppTypes.AuthMode = 'selector';
  @Input() firebaseAuthProfile: AppTypes.FirebaseAuthProfile | null = null;
  @Input() firebaseAuthIsBusy = false;
  @Input() isMobileView = false;

  @Output() readonly demoUserSelected = new EventEmitter<EntryDemoUserSelectionEvent>();
  @Output() readonly firebaseAuthRequested = new EventEmitter<AppTypes.FirebaseAuthRequest>();
  @Output() readonly firebaseSessionContinueRequested = new EventEmitter<void>();
  @Output() readonly entryConsentStateChanged = new EventEmitter<boolean>();

  protected showEntryConsentPopup = false;
  protected entryConsentViewOnly = false;
  protected entryPrivacyLoading = true;
  protected entryPrivacyLoadingProgress = 0;
  protected landingArticlesLoading = true;
  protected landingArticlesLoadingProgress = 0;
  protected landingIdeaCards: InfoCardData[] = [];
  protected entryAuthUnavailable = false;
  protected entryAuthUnavailableLabel = 'Unavailable in your country';
  protected entryAuthLocationRequired = false;
  protected entryAuthLocationRequiredLabel = 'Allow location';
  protected entryNetworkUnavailable = false;
  protected entryNetworkUnavailableLabel = 'No network';
  protected showUserSelector = false;
  protected demoSelectorUsers: DemoUserListItemDto[] = [];
  protected demoSelectorLoading = false;
  protected demoSelectorLoadingProgress = 0;
  protected demoSelectorLoadingLabel = 'Preparing demo data';
  protected demoSelectorLoadingStage: DemoBootstrapProgressStage = 'selector';
  protected demoSelectorErrorMessage = '';
  protected demoSelectorSubmitting = false;
  protected demoSelectorSelectedUserId = '';
  protected showFirebaseAuthPopup = false;
  private demoSelectorRequestToken = 0;
  private landingContentRequestToken = 0;
  private entryPrivacyLoadingStartedAtMs = 0;
  private entryPrivacyLoadingTimer: ReturnType<typeof setTimeout> | null = null;
  private landingArticlesLoadingStartedAtMs = 0;
  private landingArticlesLoadingInterval: ReturnType<typeof setInterval> | null = null;
  private landingLoginAvailability: UserLocationEligibilityResponseDto | null = null;
  private locationEligibilityResolvedFromCoordinates = false;
  private grantedLocationEligibilityPromise: Promise<void> | null = null;
  private grantedLocationEligibilityRequestToken = 0;
  private geolocationPermissionStatus: PermissionStatus | null = null;
  private readonly geolocationPermissionChangeHandler = (): void => {
    this.ngZone.run(() => {
      this.resolveGrantedLocationAccessIfNeeded();
    });
  };

  constructor() {
    this.initializeEntryFlow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['authMode']) {
      this.syncEntryAuthGateState();
    }
  }

  ngOnDestroy(): void {
    this.landingContentRequestToken += 1;
    this.grantedLocationEligibilityRequestToken += 1;
    this.unbindGeolocationPermissionStatus();
    this.clearEntryPrivacyLoadingWindow();
    this.clearLandingArticlesLoadingWindow();
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onGlobalEscape(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    if (this.showUserSelector) {
      keyboardEvent.stopPropagation();
      if (this.demoSelectorSubmitting) {
        return;
      }
      this.closeDemoUserSelectorPopup();
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
    const allowed = await this.ensureHttpLoginAccessAllowed();
    if (!allowed) {
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

  protected closeDemoUserSelectorPopup(): void {
    if (this.demoSelectorSubmitting) {
      return;
    }
    this.demoSelectorRequestToken += 1;
    this.showUserSelector = false;
    this.demoSelectorLoading = false;
    this.demoSelectorLoadingProgress = 0;
    this.demoSelectorLoadingLabel = 'Preparing demo data';
    this.demoSelectorLoadingStage = 'selector';
    this.demoSelectorErrorMessage = '';
    this.demoSelectorSubmitting = false;
    this.demoSelectorSelectedUserId = '';
  }

  protected onSelectDemoUser(userId: string): void {
    if (this.demoSelectorLoading || this.demoSelectorSubmitting) {
      return;
    }
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const selectedUser = this.demoSelectorUsers.find(user => user.id.trim() === normalizedUserId) ?? null;
    if (selectedUser && this.isNewDemoProfile(selectedUser)) {
      this.emitDemoUserSelection(normalizedUserId, this.demoSelectorRequestToken);
      return;
    }
    const requestToken = this.demoSelectorRequestToken;
    this.demoSelectorSubmitting = true;
    this.demoSelectorSelectedUserId = normalizedUserId;
    this.demoSelectorLoading = true;
    this.demoSelectorLoadingProgress = 0;
    this.demoSelectorLoadingLabel = 'Preparing demo session';
    this.demoSelectorLoadingStage = 'session';
    void this.prepareSelectedDemoUser(normalizedUserId, requestToken);
  }

  protected onRequestFirebaseAuth(request: AppTypes.FirebaseAuthRequest): void {
    if (this.firebaseAuthIsBusy) {
      return;
    }
    this.showFirebaseAuthPopup = false;
    this.firebaseAuthRequested.emit(request);
  }

  protected retryDemoUserSelectorPopup(): void {
    if (this.demoSelectorLoading || this.demoSelectorSubmitting) {
      return;
    }
    this.openDemoUserSelectorPopup();
  }

  protected openEntryConsentPopup(viewOnly = false): void {
    if (this.entryNetworkUnavailable) {
      return;
    }
    if (this.helpCenter.privacyState() === null) {
      this.entryPrivacyLoading = true;
      void this.loadEntryContent();
    }
    this.entryConsentViewOnly = viewOnly;
    this.showEntryConsentPopup = true;
  }

  protected closeEntryConsentPopup(): void {
    if (this.entryPrivacyLoading || !this.hasEntryConsent) {
      return;
    }
    this.showEntryConsentPopup = false;
    this.entryConsentViewOnly = false;
  }

  protected acceptEntryConsent(): void {
    const version = this.entryConsentVersion();
    if (this.entryPrivacyLoading || !version) {
      return;
    }
    const nowIso = new Date().toISOString();
    const consent: AppTypes.EntryConsentState = {
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
    this.entryPrivacyLoading = this.helpCenter.privacyState() === null;
    this.entryPrivacyLoadingProgress = 0;
    this.showEntryConsentPopup = !this.entryPrivacyLoading && this.shouldPromptEntryConsent();
    this.landingArticlesLoading = true;
    this.landingArticlesLoadingProgress = 0;
    this.syncLandingLoginAvailability(null, 'reset');
    this.showUserSelector = false;
    this.demoSelectorLoading = false;
    this.demoSelectorLoadingProgress = 0;
    this.demoSelectorLoadingLabel = 'Preparing demo data';
    this.demoSelectorLoadingStage = 'selector';
    this.demoSelectorErrorMessage = '';
    this.demoSelectorSubmitting = false;
    this.demoSelectorSelectedUserId = '';
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
    if (this.helpCenter.privacyState() === null) {
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
      if (gateState && gateState.securityGateEnabled !== true) {
        return true;
      }
      if (gateState?.eligible === true && gateState.locationRequired !== true) {
        return true;
      }
      if (gateState && gateState.locationRequired !== true) {
        this.confirmationDialogService.openInfo(
          this.loginUnavailableMessage(gateState),
          {
            title: 'Login Unavailable',
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
    const requestToken = ++this.demoSelectorRequestToken;
    this.showUserSelector = true;
    this.demoSelectorUsers = [];
    this.demoSelectorLoading = true;
    this.demoSelectorLoadingProgress = 0;
    this.demoSelectorLoadingLabel = 'Preparing demo data';
    this.demoSelectorLoadingStage = 'selector';
    this.demoSelectorErrorMessage = '';
    this.demoSelectorSubmitting = false;
    this.demoSelectorSelectedUserId = '';
    void this.loadDemoSelectorUsers(requestToken);
  }

  private async loadDemoSelectorUsers(requestToken: number): Promise<void> {
    await this.waitForPopupPaint();
    if (!this.isCurrentDemoSelectorRequest(requestToken)) {
      return;
    }

    try {
      const users = await this.usersService.loadAvailableDemoUsers(undefined, state => {
        if (!this.isCurrentDemoSelectorRequest(requestToken)) {
          return;
        }
        this.commitDemoSelectorState(() => {
          this.demoSelectorLoadingProgress = state.percent;
          this.demoSelectorLoadingLabel = state.label;
          this.demoSelectorLoadingStage = state.stage;
        });
      });
      const loadState = this.appCtx.getLoadingState(USERS_LOAD_CONTEXT_KEY);
      const selectorErrorMessage = users.length === 0
        && (loadState.status === 'timeout' || loadState.status === 'error')
        ? (loadState.error?.trim() || 'Unable to load demo users right now.')
        : '';
      if (!this.isCurrentDemoSelectorRequest(requestToken)) {
        return;
      }
      this.commitDemoSelectorState(() => {
        this.demoSelectorUsers = users;
        this.demoSelectorErrorMessage = selectorErrorMessage;
        this.demoSelectorLoadingProgress = selectorErrorMessage ? 0 : 100;
        this.demoSelectorLoadingLabel = selectorErrorMessage ? 'Retry demo selector' : 'Demo data ready';
        this.demoSelectorLoadingStage = selectorErrorMessage ? 'selector' : 'ready';
      });
      if (selectorErrorMessage) {
        this.commitDemoSelectorState(() => {
          this.demoSelectorLoading = false;
        });
        return;
      }
      await this.waitForLoaderCompletionBeat();
      if (!this.isCurrentDemoSelectorRequest(requestToken)) {
        return;
      }
      this.commitDemoSelectorState(() => {
        this.demoSelectorLoading = false;
      });
    } catch {
      if (!this.isCurrentDemoSelectorRequest(requestToken)) {
        return;
      }
      this.commitDemoSelectorState(() => {
        this.demoSelectorLoading = false;
        this.demoSelectorErrorMessage = this.appCtx.getLoadingState(USERS_LOAD_CONTEXT_KEY).error?.trim()
          || 'Unable to load demo users right now.';
      });
    }
  }

  private async prepareSelectedDemoUser(userId: string, requestToken: number): Promise<void> {
    await this.waitForPopupPaint();
    if (!this.isCurrentDemoSelectorRequest(requestToken)) {
      return;
    }

    try {
      await this.usersService.prepareDemoUserSession(userId, state => {
        if (!this.isCurrentDemoSelectorRequest(requestToken)) {
          return;
        }
        this.commitDemoSelectorState(() => {
          this.demoSelectorLoadingProgress = state.percent;
          this.demoSelectorLoadingLabel = state.label;
          this.demoSelectorLoadingStage = state.stage;
        });
      });
      if (!this.isCurrentDemoSelectorRequest(requestToken)) {
        return;
      }
      this.commitDemoSelectorState(() => {
        this.demoSelectorLoadingProgress = 100;
        this.demoSelectorLoadingLabel = 'Demo session ready';
        this.demoSelectorLoadingStage = 'sessionReady';
      });
      await this.waitForLoaderCompletionBeat();
      if (!this.isCurrentDemoSelectorRequest(requestToken)) {
        return;
      }
      const normalizedUserId = userId.trim();
      this.emitDemoUserSelection(normalizedUserId, requestToken);
    } catch {
      if (!this.isCurrentDemoSelectorRequest(requestToken)) {
        return;
      }
      this.resetDemoUserSelectionFailure();
    }
  }

  private emitDemoUserSelection(userId: string, requestToken: number): void {
    this.ngZone.run(() => {
      this.demoUserSelected.emit({
        userId,
        complete: () => {
          if (this.isCurrentDemoSelectorRequest(requestToken)) {
            this.completeDemoUserSelection();
          }
        },
        fail: () => {
          if (this.isCurrentDemoSelectorRequest(requestToken)) {
            this.resetDemoUserSelectionFailure();
          }
        }
      });
    });
  }

  private resetDemoUserSelectionFailure(): void {
    this.commitDemoSelectorState(() => {
      this.demoSelectorLoading = false;
      this.demoSelectorSubmitting = false;
      this.demoSelectorSelectedUserId = '';
      this.demoSelectorLoadingProgress = 0;
      this.demoSelectorLoadingLabel = 'Preparing demo data';
      this.demoSelectorLoadingStage = 'selector';
    });
  }

  private isNewDemoProfile(user: DemoUserListItemDto): boolean {
    const statusText = `${user.statusText ?? ''}`.trim().toLowerCase();
    const hasProfileStateSignal = user.completion !== undefined || user.profileFormVersion !== undefined;
    const completion = Math.max(0, Math.trunc(Number(user.completion) || 0));
    const profileFormVersion = Math.max(0, Math.trunc(Number(user.profileFormVersion) || 0));
    return statusText === 'new'
      || statusText === 'new profile'
      || (hasProfileStateSignal && completion === 0 && profileFormVersion === 0);
  }

  private isCurrentDemoSelectorRequest(requestToken: number): boolean {
    return this.showUserSelector && this.demoSelectorRequestToken === requestToken;
  }

  private completeDemoUserSelection(): void {
    this.demoSelectorRequestToken += 1;
    this.showUserSelector = false;
    this.demoSelectorLoading = false;
    this.demoSelectorSubmitting = false;
    this.demoSelectorSelectedUserId = '';
    this.demoSelectorLoadingProgress = 0;
    this.demoSelectorLoadingLabel = 'Preparing demo data';
    this.demoSelectorLoadingStage = 'selector';
    this.demoSelectorErrorMessage = '';
    this.changeDetectorRef.markForCheck();
  }

  private async requestCurrentLocation(): Promise<LocationCoordinates | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return null;
    }

    return new Promise<LocationCoordinates | null>(resolve => {
      navigator.geolocation.getCurrentPosition(
        position => {
          const latitude = Number(position.coords.latitude);
          const longitude = Number(position.coords.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            resolve(null);
            return;
          }
          resolve({ latitude, longitude });
        },
        () => resolve(null),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5 * 60 * 1000
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

          const result = await this.usersService.checkLocationEligibility(coordinates);
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
                title: this.uiText('Login Unavailable'),
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

  private loadEntryConsentState(): AppTypes.EntryConsentState | null {
    const expectedVersion = this.entryConsentVersion();
    if (!expectedVersion) {
      return null;
    }
    const raw = localStorage.getItem(EntryShellComponent.ENTRY_CONSENT_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<AppTypes.EntryConsentState>;
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

  private appendEntryConsentAudit(action: AppTypes.EntryConsentAuditRecord['action'], tsIso: string): void {
    const record: AppTypes.EntryConsentAuditRecord = {
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

  private loadEntryConsentAudit(): AppTypes.EntryConsentAuditRecord[] {
    const raw = localStorage.getItem(EntryShellComponent.ENTRY_CONSENT_AUDIT_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as AppTypes.EntryConsentAuditRecord[];
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
          this.entryNetworkUnavailable = true;
          this.landingIdeaCards = [];
          this.syncLandingLoginAvailability(null, 'reset');
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
    const revision = this.helpCenter.activePrivacyRevision();
    if (!revision) {
      return '';
    }
    return `privacy:${revision.id}:v${revision.version}`;
  }

  private startEntryPrivacyLoadingWindow(): void {
    this.clearEntryPrivacyLoadingWindow();
    this.entryPrivacyLoading = true;
    this.entryPrivacyLoadingProgress = 0.02;
    this.entryPrivacyLoadingStartedAtMs = performance.now();
    this.updateEntryPrivacyLoadingWindow();
  }

  private updateEntryPrivacyLoadingWindow(): void {
    if (!this.entryPrivacyLoading) {
      return;
    }
    const elapsed = Math.max(0, performance.now() - this.entryPrivacyLoadingStartedAtMs);
    const nextProgress = Math.min(1, elapsed / EntryShellComponent.ENTRY_PRIVACY_LOADING_WINDOW_MS);
    this.entryPrivacyLoadingProgress = Math.max(this.entryPrivacyLoadingProgress, nextProgress);
    if (nextProgress >= 1) {
      return;
    }
    this.entryPrivacyLoadingTimer = setTimeout(() => {
      this.ngZone.run(() => {
        this.updateEntryPrivacyLoadingWindow();
        this.changeDetectorRef.markForCheck();
      });
    }, 80);
  }

  private endEntryPrivacyLoadingWindow(): void {
    this.clearEntryPrivacyLoadingWindow();
    this.entryPrivacyLoading = false;
    this.entryPrivacyLoadingProgress = 1;
  }

  private clearEntryPrivacyLoadingWindow(): void {
    if (!this.entryPrivacyLoadingTimer) {
      return;
    }
    clearTimeout(this.entryPrivacyLoadingTimer);
    this.entryPrivacyLoadingTimer = null;
  }

  private startLandingArticlesLoadingWindow(): void {
    this.clearLandingArticlesLoadingWindow();
    this.landingArticlesLoading = true;
    this.landingArticlesLoadingProgress = 0.02;
    this.landingArticlesLoadingStartedAtMs = performance.now();
    this.updateLandingArticlesLoadingWindow();
    this.landingArticlesLoadingInterval = this.ngZone.runOutsideAngular(() =>
      setInterval(() => {
        this.ngZone.run(() => {
          this.updateLandingArticlesLoadingWindow();
          this.changeDetectorRef.markForCheck();
        });
      }, 16)
    );
  }

  private endLandingArticlesLoadingWindow(): void {
    this.clearLandingArticlesLoadingWindow();
    this.landingArticlesLoadingProgress = 1;
    this.changeDetectorRef.markForCheck();
    setTimeout(() => {
      this.ngZone.run(() => {
        this.landingArticlesLoading = false;
        this.landingArticlesLoadingProgress = 0;
        this.landingArticlesLoadingStartedAtMs = 0;
        this.changeDetectorRef.markForCheck();
      });
    }, 100);
  }

  private updateLandingArticlesLoadingWindow(): void {
    if (!this.landingArticlesLoading) {
      return;
    }
    const elapsed = Math.max(0, performance.now() - this.landingArticlesLoadingStartedAtMs);
    const nextProgress = Math.min(1, elapsed / EntryShellComponent.LANDING_ARTICLES_LOADING_WINDOW_MS);
    this.landingArticlesLoadingProgress = Math.max(this.landingArticlesLoadingProgress, nextProgress);
  }

  private clearLandingArticlesLoadingWindow(): void {
    if (!this.landingArticlesLoadingInterval) {
      return;
    }
    clearInterval(this.landingArticlesLoadingInterval);
    this.landingArticlesLoadingInterval = null;
  }

  private syncLandingLoginAvailability(
    availability: UserLocationEligibilityResponseDto | null | undefined,
    source: 'bundle' | 'coordinates' | 'reset' = 'bundle'
  ): void {
    if (source === 'coordinates') {
      this.locationEligibilityResolvedFromCoordinates = true;
    } else if (source === 'reset') {
      this.locationEligibilityResolvedFromCoordinates = false;
    }
    this.landingLoginAvailability = availability
      ? {
          eligible: availability.eligible !== false,
          partitionKey: availability.partitionKey ?? null,
          message: availability.message ?? null,
          securityGateEnabled: availability.securityGateEnabled === true,
          locationRequired: availability.locationRequired === true
        }
      : null;
    this.syncEntryAuthGateState();
  }

  private syncEntryAuthGateState(): void {
    const loginEnabled = this.authMode === 'firebase';
    this.entryAuthUnavailable = !this.entryNetworkUnavailable && loginEnabled && this.isLoginBlockedByLandingBundle();
    this.entryAuthUnavailableLabel = 'Unavailable in your country';
    this.entryAuthLocationRequired = !this.entryNetworkUnavailable && loginEnabled && this.isLoginLocationRequiredByLandingBundle();
    this.deferEntryAuthLocationRequiredLabel(this.grantedLocationEligibilityPromise ? 'Checking location' : 'Allow location');
    this.resolveGrantedLocationAccessIfNeeded();
    this.changeDetectorRef.markForCheck();
  }

  private isLoginBlockedByLandingBundle(): boolean {
    return this.landingLoginAvailability !== null
      && this.landingLoginAvailability.securityGateEnabled === true
      && this.landingLoginAvailability.eligible === false
      && this.landingLoginAvailability.locationRequired !== true;
  }

  private isLoginLocationRequiredByLandingBundle(): boolean {
    return !this.entryNetworkUnavailable
      && (this.landingLoginAvailability === null
      || (
        this.landingLoginAvailability.securityGateEnabled === true
        && this.landingLoginAvailability.locationRequired === true
      ));
  }

  private openBundledLoginUnavailableInfo(): void {
    this.confirmationDialogService.openInfo(this.loginUnavailableMessage(this.landingLoginAvailability), {
      title: 'Login Unavailable',
      confirmLabel: 'OK'
    });
  }

  private loginUnavailableMessage(availability: UserLocationEligibilityResponseDto | null): string {
    return availability?.message?.trim()
      || 'Login is currently unavailable from your country or region for security reasons. Please come back later.';
  }

  private resolveGrantedLocationAccessIfNeeded(): void {
    if (!this.entryAuthLocationRequired || this.grantedLocationEligibilityPromise) {
      return;
    }

    const requestToken = ++this.grantedLocationEligibilityRequestToken;
    this.grantedLocationEligibilityPromise = this.resolveGrantedLocationAccess(requestToken)
      .finally(() => {
        if (requestToken === this.grantedLocationEligibilityRequestToken) {
          this.grantedLocationEligibilityPromise = null;
          this.deferEntryAuthLocationRequiredLabel('Allow location');
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

  private async resolveGrantedLocationAccess(requestToken: number): Promise<void> {
    try {
      const permissionState = await this.queryGeolocationPermissionState();
      if (requestToken !== this.grantedLocationEligibilityRequestToken || permissionState !== 'granted') {
        return;
      }

      const coordinates = await this.requestCurrentLocation();
      if (requestToken !== this.grantedLocationEligibilityRequestToken || !coordinates) {
        return;
      }

      const result = await this.usersService.checkLocationEligibility(coordinates);
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
    status.addEventListener('change', this.geolocationPermissionChangeHandler);
  }

  private unbindGeolocationPermissionStatus(): void {
    if (!this.geolocationPermissionStatus) {
      return;
    }

    this.geolocationPermissionStatus.removeEventListener('change', this.geolocationPermissionChangeHandler);
    this.geolocationPermissionStatus = null;
  }

}
