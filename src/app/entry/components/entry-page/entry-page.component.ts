import { ChangeDetectorRef, Component, HostListener, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AppPopupContext } from '../../../shared/ui';
import {
  HelpCenterService,
  LandingContentService,
  PrivacyPolicyService,
  ProfileOnboardingService,
  SessionService,
  TermsPolicyService,
  UsersService,
  type AppSession,
  type UserDto,
  type UserLocationEligibilityResponseDto
} from '../../../shared/core';
import type {
  EntryConsentAuditRecordDto,
  EntryConsentStateDto,
  FirebaseAuthProfileDto,
  FirebaseAuthRequestDto,
  LocationCoordinates
} from '../../../shared/core/contracts/user.interface';
import type { HelpCenterRevisionDto, HelpCenterSectionDto } from '../../../shared/core/contracts';
import type { AuthMode } from '../../../shared/core/common/constants';
import { APP_STORAGE_KEYS } from '../../../shared/core/common/storage-scope';
import { ConfirmationDialogComponent } from '../../../shared/ui/components/confirmation-dialog/confirmation-dialog.component';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { I18nService } from '../../../shared/core';
import { SeedStaticContentService } from '../../../shared/core/local/seed';
import type { InfoCardData } from '../../../shared/ui';
import {
  DocumentViewerComponent,
  type DocumentViewerAction,
  type DocumentViewerActionEvent,
  type DocumentViewerActionVisibility,
  type DocumentViewerConfig
} from '../../../shared/ui/components/document-viewer';
import { HelpCenterRevisionDocumentViewerConfigConverter } from '../../../shared/ui/converters';
import { EntryFirebaseAuthPopupComponent } from '../entry-firebase-auth-popup/entry-firebase-auth-popup.component';
import { EntryLandingComponent } from '../entry-landing/entry-landing.component';
import { ProfileOnboardingPopupComponent } from '../profile-onboarding-popup/profile-onboarding-popup.component';

interface EntryDemoUserSelectionEvent {
  userId: string;
  complete: () => void;
  fail: () => void;
}

interface EntryDemoNewProfileRequestEvent {
  complete: () => void;
  fail: () => void;
}

@Component({
  selector: 'app-entry-page',
  standalone: true,
  imports: [
    EntryLandingComponent,
    DocumentViewerComponent,
    EntryFirebaseAuthPopupComponent,
    ConfirmationDialogComponent,
    ProfileOnboardingPopupComponent
  ],
  templateUrl: './entry-page.component.html',
  styleUrl: './entry-page.component.scss'
})
export class EntryPageComponent implements OnInit, OnDestroy {
  private static readonly ENTRY_CONSENT_KEY = APP_STORAGE_KEYS.entryConsent;
  private static readonly ENTRY_CONSENT_AUDIT_KEY = APP_STORAGE_KEYS.entryConsentAudit;
  private static readonly ENTRY_CONSENT_AUDIT_MAX = 30;
  private static readonly LOCATION_REQUEST_TIMEOUT_MS = 4500;
  private static readonly LOCATION_REQUEST_MAXIMUM_AGE_MS = 0;

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly helpCenter = inject(HelpCenterService);
  private readonly privacyPolicy = inject(PrivacyPolicyService);
  private readonly onboardingService = inject(ProfileOnboardingService);
  protected readonly sessionService = inject(SessionService);
  private readonly termsPolicy = inject(TermsPolicyService);
  private readonly landingContent = inject(LandingContentService);
  private readonly staticContentSeed = inject(SeedStaticContentService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly i18n = inject(I18nService);
  private readonly usersService = inject(UsersService);
  private loginEligibilityBusy = false;
  private entryContentLoadPromise: Promise<void> | null = null;

  protected showEntryConsentPopup = false;
  protected showEntryTermsPopup = false;
  protected entryConsentViewOnly = false;
  protected entryPrivacyLoading = true;
  protected entryPrivacySaving = false;
  protected entryPrivacySaveMessage = '';
  protected entryPrivacySaveError = '';
  protected landingArticlesLoading = true;
  protected landingIdeaCards: InfoCardData[] = [];
  protected entryAuthUnavailable = false;
  protected entryAuthUnavailableLabel = 'Unavailable in your country';
  protected entryAuthLocationRequired = false;
  protected entryAuthLocationRequiredLabel = 'Allow location';
  protected entryNetworkUnavailable = false;
  protected entryNetworkUnavailableLabel = 'No network';
  protected showFirebaseAuthPopup = false;
  protected isMobileView = typeof window !== 'undefined' ? window.innerWidth <= 760 : false;
  protected onboardingOpen = false;
  protected onboardingUser: UserDto | null = null;
  protected onboardingTitle = 'profile.setup';
  protected onboardingMessage = '';
  private pendingRedirectAfterOnboarding = '';
  private pendingDemoSessionUserId = '';
  private autoOnboardingRequested = false;
  private entryConsentAccepted = false;
  private postSessionGateToken = 0;
  private queryParamSubscription: Subscription | null = null;
  private landingContentRequestToken = 0;
  private landingLoginAvailability: UserLocationEligibilityResponseDto | null = null;
  private locationEligibilityResolvedFromCoordinates = false;
  private grantedLocationEligibilityPromise: Promise<void> | null = null;
  private grantedLocationEligibilityRequestToken = 0;
  private browserLocationAutoRequestAttempted = false;
  private entryApprovedPrivacySectionIds = new Set<string>();
  private entryOptionalApprovalsLoadedForRevision = '';
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

  ngOnInit(): void {
    this.syncMobileView();
    this.queryParamSubscription = this.route.queryParamMap.subscribe(queryParams => {
      this.autoOnboardingRequested = queryParams.get('onboarding') === '1';
      this.beginAutoOnboardingIfReady();
    });
  }

  ngOnDestroy(): void {
    this.queryParamSubscription?.unsubscribe();
    this.landingContentRequestToken += 1;
    this.grantedLocationEligibilityRequestToken += 1;
    this.unbindGeolocationPermissionStatus();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.syncMobileView();
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

  protected get authMode(): AuthMode {
    return this.sessionService.authMode;
  }

  protected get firebaseAuthProfile(): FirebaseAuthProfileDto | null {
    return this.sessionService.firebaseProfile();
  }

  protected get firebaseAuthIsBusy(): boolean {
    return this.sessionService.firebaseBusy();
  }

  protected get firebaseAuthMessage(): string {
    return this.sessionService.firebaseNotice();
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
      void this.onFirebaseSessionContinueRequested();
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
    void this.onFirebaseAuthRequested(request);
  }

  protected openEntryConsentPopup(viewOnly = false): void {
    if (this.entryNetworkUnavailable) {
      return;
    }
    if (this.privacyPolicy.state() === null) {
      this.entryPrivacyLoading = true;
      void this.loadEntryContent();
    }
    this.syncEntryPrivacyApprovalsForRevision();
    this.entryConsentViewOnly = viewOnly;
    this.showEntryConsentPopup = true;
  }

  protected closeEntryConsentPopup(): void {
    if (this.entryPrivacyLoading) {
      return;
    }
    this.showEntryConsentPopup = false;
    this.entryConsentViewOnly = false;
    this.entryPrivacySaveMessage = '';
    this.entryPrivacySaveError = '';
  }

  protected openEntryTermsPopup(): void {
    this.showEntryTermsPopup = true;
    void this.termsPolicy.prepareOpen();
  }

  protected closeEntryTermsPopup(): void {
    this.showEntryTermsPopup = false;
  }

  protected entryPrivacyDocumentConfig(): DocumentViewerConfig {
    const revision = this.privacyPolicy.activeRevision();
    return HelpCenterRevisionDocumentViewerConfigConverter.convert({
      revision,
      open: this.showEntryConsentPopup,
      shell: 'popup',
      onClose: () => this.closeEntryConsentPopup(),
      ariaLabel: this.uiText('GDPR consent'),
      closeAriaLabel: this.uiText('Close privacy popup'),
      closeOnBackdrop: this.entryConsentViewOnly,
      titleFallback: this.uiText('Privacy first'),
      descriptionFallback: this.uiText('Privacy first'),
      versionLabel: this.privacyPolicy.activeVersionLabel(),
      loading: this.entryPrivacyLoading,
      loadingLabel: this.uiText('Loading privacy content'),
      emptyState: {
        icon: 'policy',
        title: this.uiText('Privacy is not available'),
        description: this.uiText('Privacy content is not available right now.')
      },
      sectionMode: 'privacy',
      selectedSectionIds: this.entryApprovedPrivacySectionIds,
      actions: this.entryPrivacyDocumentActions(),
      statusMessage: this.entryPrivacySaveError || this.entryPrivacySaveMessage,
      statusTone: this.entryPrivacySaveError ? 'error' : 'default'
    });
  }

  protected entryTermsDocumentConfig(): DocumentViewerConfig {
    const revision = this.helpCenter.activeTermsRevision();
    return HelpCenterRevisionDocumentViewerConfigConverter.convert({
      revision,
      open: this.showEntryTermsPopup,
      shell: 'popup',
      onClose: () => this.closeEntryTermsPopup(),
      ariaLabel: this.uiText('Terms of service'),
      closeAriaLabel: this.uiText('Close terms popup'),
      titleFallback: this.uiText('Usage terms'),
      descriptionFallback: this.uiText('Review the terms that apply when you use MyScoutee features, accounts, events, chats, and community tools.'),
      versionLabel: this.helpCenter.activeTermsVersionLabel(),
      loading: this.termsPolicy.loading() || (this.landingArticlesLoading && !revision),
      loadingLabel: this.uiText('Loading terms content'),
      emptyState: {
        icon: 'rule',
        title: this.uiText('Terms are not available'),
        description: this.uiText('Terms content is not available right now.')
      }
    });
  }

  protected onEntryPrivacyDocumentAction(event: DocumentViewerActionEvent): void {
    if (event.id === 'entry-privacy-save') {
      void this.saveEntryPrivacyChoices(event.selectedSectionIds);
      return;
    }
    if (event.id === 'entry-privacy-accept') {
      void this.acceptEntryConsent(event.selectedSectionIds);
      return;
    }
    if (event.id === 'entry-privacy-reject') {
      this.rejectEntryConsent();
    }
  }

  protected async acceptEntryConsent(selectedSectionIds: readonly string[] = Array.from(this.entryApprovedPrivacySectionIds)): Promise<void> {
    const version = this.entryConsentVersion();
    if (this.entryPrivacyLoading || !version || this.entryPrivacySaving) {
      return;
    }
    this.entryPrivacySaving = true;
    this.entryPrivacySaveMessage = '';
    this.entryPrivacySaveError = '';
    try {
      this.saveEntryPrivacyApprovalState(selectedSectionIds);
    } catch {
      this.entryPrivacySaveError = this.uiText('Privacy choices could not be saved.');
      this.entryPrivacySaving = false;
      return;
    }
    const nowIso = new Date().toISOString();
    const consent: EntryConsentStateDto = {
      version,
      accepted: true,
      acceptedAtIso: nowIso
    };
    localStorage.setItem(EntryPageComponent.ENTRY_CONSENT_KEY, JSON.stringify(consent));
    this.appendEntryConsentAudit('accepted', nowIso);
    this.showEntryConsentPopup = false;
    this.entryConsentViewOnly = false;
    this.entryPrivacySaving = false;
    this.onEntryConsentStateChanged(true);
  }

  protected rejectEntryConsent(): void {
    const nowIso = new Date().toISOString();
    localStorage.removeItem(EntryPageComponent.ENTRY_CONSENT_KEY);
    this.appendEntryConsentAudit('rejected', nowIso);
    this.showEntryConsentPopup = false;
    this.entryConsentViewOnly = false;
    this.entryPrivacySaveMessage = '';
    this.entryPrivacySaveError = '';
    this.onEntryConsentStateChanged(false);
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
            title: 'please.register',
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
          void this.onDemoUserSelected({
            userId,
            complete: () => resolve(true),
            fail: () => resolve(false)
          });
        });
      }),
      onNewProfile: () => new Promise<boolean>(resolve => {
        this.ngZone.run(() => {
          this.onDemoNewProfileRequested({
            complete: () => resolve(true),
            fail: () => resolve(false)
          });
        });
      })
    });
  }

  protected async onDemoUserSelected(selection: EntryDemoUserSelectionEvent): Promise<void> {
    const normalizedUserId = selection.userId.trim();
    if (!normalizedUserId) {
      selection.fail();
      return;
    }
    const selectedUser = this.usersService.peekCachedUserById(normalizedUserId);
    if (selectedUser && this.onboardingService.shouldPrompt(selectedUser)) {
      this.pendingDemoSessionUserId = normalizedUserId;
      this.openOnboardingGate(selectedUser, this.redirectUrl());
      selection.complete();
      return;
    }
    const session = this.sessionService.startDemoSession(normalizedUserId);
    if (!session) {
      selection.fail();
      return;
    }
    try {
      const navigated = await this.router.navigateByUrl(this.redirectUrl());
      if (!navigated) {
        selection.fail();
        return;
      }
      selection.complete();
    } catch {
      selection.fail();
    }
  }

  protected onDemoNewProfileRequested(request: EntryDemoNewProfileRequestEvent): void {
    const user = this.buildDemoRegistrationUser();
    this.pendingDemoSessionUserId = user.id;
    this.openOnboardingGate(
      user,
      this.redirectUrl(),
      {
        title: 'profile.setup',
        message: 'profile.setup.demo.message'
      }
    );
    request.complete();
  }

  protected async onFirebaseAuthRequested(request: FirebaseAuthRequestDto): Promise<void> {
    const session = await this.sessionService.startFirebaseSession(request);
    if (!session) {
      return;
    }
    await this.runPostSessionGate(session, this.redirectUrl());
  }

  protected async onFirebaseSessionContinueRequested(): Promise<void> {
    const session = await this.sessionService.restoreFirebaseSession();
    if (!session) {
      return;
    }
    await this.runPostSessionGate(session, this.redirectUrl());
  }

  protected onEntryConsentStateChanged(accepted: boolean): void {
    this.entryConsentAccepted = accepted;
    this.beginAutoOnboardingIfReady();
  }

  protected async onOnboardingCompleted(_user: UserDto): Promise<void> {
    const redirect = this.pendingRedirectAfterOnboarding || this.redirectUrl();
    const demoSessionUserId = this.pendingDemoSessionUserId;
    this.pendingRedirectAfterOnboarding = '';
    this.pendingDemoSessionUserId = '';
    if (demoSessionUserId) {
      const session = this.sessionService.startDemoSession(demoSessionUserId);
      if (!session) {
        this.onboardingOpen = false;
        this.onboardingUser = null;
        return;
      }
    }
    try {
      const navigated = await this.router.navigateByUrl(redirect);
      if (!navigated) {
        this.onboardingOpen = false;
        this.onboardingUser = null;
      }
    } catch {
      this.onboardingOpen = false;
      this.onboardingUser = null;
    }
  }

  protected async onOnboardingDismissed(): Promise<void> {
    this.onboardingOpen = false;
    this.onboardingUser = null;
    this.pendingRedirectAfterOnboarding = '';
    this.pendingDemoSessionUserId = '';
    await this.sessionService.logout();
    await this.router.navigateByUrl('/entry');
  }

  private redirectUrl(): string {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    if (redirect && redirect.startsWith('/')) {
      return redirect;
    }
    return '/game';
  }

  private syncMobileView(): void {
    this.isMobileView = typeof window !== 'undefined' ? window.innerWidth <= 760 : false;
  }

  private beginAutoOnboardingIfReady(): void {
    if (!this.autoOnboardingRequested || !this.entryConsentAccepted) {
      return;
    }
    this.autoOnboardingRequested = false;
    void this.beginExistingSessionGate();
  }

  private async beginExistingSessionGate(): Promise<void> {
    const session = await this.sessionService.ensureSession() ?? await this.sessionService.restoreFirebaseSession();
    if (!session) {
      return;
    }
    await this.runPostSessionGate(session, this.redirectUrl());
  }

  private async runPostSessionGate(session: AppSession, redirectUrl: string): Promise<void> {
    const gateToken = ++this.postSessionGateToken;
    const adminRedirect = this.isAdminRedirect(redirectUrl);
    let user: UserDto | null = null;
    try {
      user = await this.usersService.loadUserById(session.kind === 'demo' ? session.userId : undefined, 8000);
    } catch {
      user = null;
    }
    if (gateToken !== this.postSessionGateToken) {
      return;
    }
    if (!user && session.kind === 'firebase') {
      this.openOnboardingGate(
        this.buildFirebaseRegistrationUser(session.profile),
        redirectUrl,
        {
          title: 'please.register',
          message: 'profile.setup.registration.message'
        }
      );
      return;
    }
    if (!user) {
      this.closeOnboardingGate();
      await this.router.navigateByUrl(redirectUrl);
      return;
    }
    if (user.admin === true) {
      this.closeOnboardingGate();
      await this.router.navigateByUrl('/admin');
      return;
    }
    if (adminRedirect) {
      this.closeOnboardingGate();
      await this.router.navigateByUrl(redirectUrl);
      return;
    }
    if (!this.onboardingService.shouldPrompt(user)) {
      this.closeOnboardingGate();
      await this.router.navigateByUrl(redirectUrl);
      return;
    }
    this.openOnboardingGate(
      user,
      redirectUrl,
      user.profileStatus === 'onboarding'
        ? {
            title: 'please.register',
            message: 'profile.setup.registration.message'
          }
        : undefined
    );
  }

  private isAdminRedirect(redirectUrl: string): boolean {
    const normalizedRedirect = `${redirectUrl ?? ''}`.trim();
    return normalizedRedirect === '/admin' || normalizedRedirect.startsWith('/admin/');
  }

  private closeOnboardingGate(): void {
    this.ngZone.run(() => {
      this.onboardingOpen = false;
      this.onboardingUser = null;
      this.onboardingTitle = 'profile.setup';
      this.onboardingMessage = '';
      this.pendingRedirectAfterOnboarding = '';
      this.pendingDemoSessionUserId = '';
      this.changeDetectorRef.detectChanges();
    });
  }

  private openOnboardingGate(
    user: UserDto,
    redirectUrl: string,
    copy: { title: string; message?: string } = { title: 'profile.setup' }
  ): void {
    this.ngZone.run(() => {
      this.pendingRedirectAfterOnboarding = redirectUrl;
      this.onboardingUser = user;
      this.onboardingTitle = copy.title;
      this.onboardingMessage = copy.message ?? '';
      this.onboardingOpen = true;
      this.changeDetectorRef.detectChanges();
    });
  }

  private buildFirebaseRegistrationUser(profile: Extract<AppSession, { kind: 'firebase' }>['profile']): UserDto {
    const name = profile.name.trim() || profile.email.trim() || 'Firebase User';
    const imageUrl = profile.imageUrl?.trim();
    return {
      id: profile.id.trim(),
      name,
      age: 0,
      birthday: '',
      city: '',
      height: '',
      physique: '',
      languages: [],
      horoscope: '',
      initials: profile.initials.trim() || this.initialsFromText(name),
      gender: 'man',
      statusText: '',
      hostTier: '',
      traitLabel: '',
      completion: 0,
      headline: '',
      about: '',
      images: imageUrl ? [imageUrl] : [],
      profileStatus: 'onboarding',
      activities: this.emptyActivities()
    };
  }

  private buildDemoRegistrationUser(): UserDto {
    const userId = `demo-profile-${this.randomToken()}`;
    return {
      id: userId,
      name: '',
      age: 0,
      birthday: '',
      city: '',
      height: '',
      physique: '',
      languages: [],
      horoscope: '',
      initials: '',
      gender: 'man',
      statusText: '',
      hostTier: '',
      traitLabel: '',
      completion: 0,
      profileFormVersion: 0,
      headline: '',
      about: '',
      images: [],
      profileDetails: [],
      profileStatus: 'onboarding',
      activities: this.emptyActivities()
    };
  }

  private randomToken(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private emptyActivities(): UserDto['activities'] {
    return {
      game: 0,
      chat: 0,
      invitations: 0,
      events: 0,
      hosting: 0,
      cars: 0,
      accommodation: 0,
      supplies: 0,
      tickets: 0,
      contacts: 0,
      feedback: 0,
      event: {
        all: 0,
        active: 0,
        pending: 0,
        invitations: 0,
        hosting: 0,
        drafts: 0,
        trash: 0
      },
      asset: {
        cars: 0,
        accommodation: 0,
        supplies: 0,
        tickets: 0
      },
      eventFeedback: {
        ownEvents: 0,
        pending: 0,
        feedbacked: 0,
        removed: 0
      },
      adminJobs: 0,
      adminMetrics: 0
    };
  }

  private initialsFromText(value: string): string {
    const initials = value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
    return initials || 'U';
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
        EntryPageComponent.LOCATION_REQUEST_TIMEOUT_MS + 500
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
          timeout: EntryPageComponent.LOCATION_REQUEST_TIMEOUT_MS,
          maximumAge: EntryPageComponent.LOCATION_REQUEST_MAXIMUM_AGE_MS
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
                title: this.uiText('please.register'),
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
    const raw = localStorage.getItem(EntryPageComponent.ENTRY_CONSENT_KEY);
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
    const trimmed = existing.slice(0, EntryPageComponent.ENTRY_CONSENT_AUDIT_MAX);
    localStorage.setItem(EntryPageComponent.ENTRY_CONSENT_AUDIT_KEY, JSON.stringify(trimmed));
  }

  private loadEntryConsentAudit(): EntryConsentAuditRecordDto[] {
    const raw = localStorage.getItem(EntryPageComponent.ENTRY_CONSENT_AUDIT_KEY);
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
    this.syncEntryPrivacyApprovalsForRevision();
    if (!this.entryNetworkUnavailable && !this.entryConsentViewOnly) {
      this.showEntryConsentPopup = this.shouldPromptEntryConsent();
    }
    this.changeDetectorRef.markForCheck();
    this.onEntryConsentStateChanged(this.hasEntryConsent);
  }

  private entryConsentVersion(): string {
    const revision = this.privacyPolicy.activeRevision();
    if (!revision) {
      return '';
    }
    return `privacy:${revision.id}:v${revision.version}`;
  }

  private entryPrivacyDocumentActions(): readonly DocumentViewerAction[] {
    if (!this.showEntryConsentPopup) {
      return [];
    }
    if (this.entryConsentViewOnly) {
      return [{
        id: 'entry-privacy-save',
        label: this.entryPrivacySaveButtonLabel(),
        icon: 'check_circle',
        palette: 'blue',
        disabled: !this.canRunEntryPrivacySaveAction(),
        visible: this.entryPrivacySaveActionVisibility(),
        progress: this.entryPrivacySaving
          ? {
              state: 'loading',
              shape: 'button'
            }
          : null
      }];
    }
    return [
      {
        id: 'entry-privacy-reject',
        label: this.uiText('Cancel'),
        palette: 'slate',
        disabled: this.entryPrivacySaving
      },
      {
        id: 'entry-privacy-accept',
        label: this.uiText('Accept and continue'),
        icon: this.entryPrivacySaving ? 'hourglass_top' : null,
        palette: 'blue',
        disabled: !this.canAcceptEntryPrivacy(),
        progress: this.entryPrivacySaving
          ? {
              state: 'loading',
              shape: 'button'
            }
          : null
      }
    ];
  }

  private entryPrivacySaveActionVisibility(): DocumentViewerActionVisibility {
    const revision = this.privacyPolicy.activeRevision();
    if (!this.entryConsentViewOnly || !revision) {
      return false;
    }
    if (!this.hasEntryConsent) {
      return true;
    }
    return this.hasOptionalPrivacySections(revision) ? 'dirty' : false;
  }

  private canRunEntryPrivacySaveAction(): boolean {
    return !this.entryPrivacyLoading && !this.entryPrivacySaving;
  }

  private canAcceptEntryPrivacy(): boolean {
    const revision = this.privacyPolicy.activeRevision();
    return !this.entryConsentViewOnly
      && !this.entryPrivacyLoading
      && !this.entryPrivacySaving
      && Boolean(revision)
      && (revision?.sections.length ?? 0) > 0;
  }

  private entryPrivacySaveButtonLabel(): string {
    if (this.entryPrivacySaving) {
      return this.uiText('Saving...');
    }
    return this.uiText(!this.hasEntryConsent ? 'Approve privacy' : 'Save choices');
  }

  private async saveEntryPrivacyChoices(selectedSectionIds: readonly string[]): Promise<void> {
    if (!this.canRunEntryPrivacySaveAction()) {
      return;
    }
    this.entryPrivacySaving = true;
    this.entryPrivacySaveMessage = '';
    this.entryPrivacySaveError = '';
    try {
      this.saveEntryPrivacyApprovalState(selectedSectionIds);
      this.entryPrivacySaveMessage = this.uiText('Privacy choices saved.');
      if (!this.hasEntryConsent) {
        this.entryPrivacySaving = false;
        await this.acceptEntryConsent(selectedSectionIds);
        return;
      } else {
        this.closeEntryConsentPopup();
      }
    } catch {
      this.entryPrivacySaveError = this.uiText('Privacy choices could not be saved.');
    } finally {
      this.entryPrivacySaving = false;
    }
  }

  private saveEntryPrivacyApprovalState(selectedSectionIds: readonly string[]): void {
    const revision = this.privacyPolicy.activeRevision();
    if (!revision) {
      return;
    }
    const optionalSectionIds = this.optionalPrivacySectionIds(revision.sections);
    const approvedSectionIds = Array.from(new Set(selectedSectionIds))
      .filter(sectionId => optionalSectionIds.has(sectionId))
      .sort();
    this.privacyPolicy.saveEntryOptionalApprovals(revision, approvedSectionIds);
    this.entryApprovedPrivacySectionIds = new Set(approvedSectionIds);
    this.entryOptionalApprovalsLoadedForRevision = this.privacyPolicy.revisionKey(revision);
  }

  private syncEntryPrivacyApprovalsForRevision(): void {
    const revision = this.privacyPolicy.activeRevision();
    const optionalSectionIds = this.optionalPrivacySectionIds(revision?.sections ?? []);
    if (!revision) {
      this.entryApprovedPrivacySectionIds = this.filteredSectionIds(this.entryApprovedPrivacySectionIds, optionalSectionIds);
      return;
    }
    const revisionKey = this.privacyPolicy.revisionKey(revision);
    if (this.entryOptionalApprovalsLoadedForRevision !== revisionKey) {
      this.entryApprovedPrivacySectionIds = this.privacyPolicy.loadEntryOptionalApprovals(revision);
      this.entryOptionalApprovalsLoadedForRevision = revisionKey;
      return;
    }
    this.entryApprovedPrivacySectionIds = this.filteredSectionIds(this.entryApprovedPrivacySectionIds, optionalSectionIds);
  }

  private hasOptionalPrivacySections(revision: HelpCenterRevisionDto): boolean {
    return revision.sections.some(section => section.optional === true);
  }

  private optionalPrivacySectionIds(sections: readonly HelpCenterSectionDto[]): Set<string> {
    return new Set(sections.filter(section => section.optional === true).map(section => section.id));
  }

  private filteredSectionIds(source: ReadonlySet<string>, allowedIds: ReadonlySet<string>): Set<string> {
    return new Set(Array.from(source).filter(sectionId => allowedIds.has(sectionId)));
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
      title: 'please.register',
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
