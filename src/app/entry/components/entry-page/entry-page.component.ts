import { finishLandingDebug, markLandingDebug } from '../../../shared/core/common/landing-debug';
import { baseGroupId, groupType, type GroupType } from '../../../shared/core/contracts/groups/group-type';
import { backendUnavailable } from '../../../shared/core/common/backend-connectivity';
import { demoFailoverEnabled } from '../../../shared/core/common/demo-failover';
import { environment } from '../../../../environments/environment';
import { preloadAdapterMode } from '../../../shared/core/base/adapter-loaders';
import { ExplanationLauncherComponent } from '../../../shared/ui/components/explanation-popup/explanation-launcher.component';
import {
  ExplanationGuideService,
  type GuideRevision as HelpCenterRevisionDto,
  type GuideSection as HelpCenterSectionDto,
  DialogStore,
  IndicatorComponent,
  PopupComponent,
  type InfoCardData
} from '@fssrepository/myscoutee-components';
import { LANDING_EXPLANATION_GUIDE } from '../../../shared/core/base/services/help/landing-explanation-guide';
import { LandingGuideSurfaceDirective } from '../entry-landing/landing-guide-surface.directive';
import { AffiliateReferralService } from '../../../shared/core/base/services/integrations/affiliate-referral.service';
import {
  ChangeDetectorRef,
  Component,
  HostListener,
  ComponentRef,
  DestroyRef,
  DoCheck,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
  effect,
  inputBinding,
  outputBinding,
  signal,
  viewChild,
  ViewContainerRef
} from '@angular/core';
import {
  ActivatedRoute,
  Router
} from '@angular/router';
import {
  Subscription
} from 'rxjs';

import {
  AppUtils
} from '../../../shared/core/base/app-utils';
import {
  CURRENT_PROFILE_FORM_VERSION,
  type AuthMode
} from '../../../shared/core/common/constants';
import {
  APP_STORAGE_KEYS
} from '../../../shared/core/common/storage-scope';
import {
  isFirebaseLoginEnabled
} from '../../../shared/core/common/firebase-login-mode';
import {
  hasOperatorRole
} from '../../../shared/core/common/user-role';

import type { SupportedCountryDto } from '../../../shared/core/contracts/content/content.interface';
import type {
  EntryConsentAuditRecordDto,
  EntryConsentStateDto,
  FirebaseAuthProfileDto,
  FirebaseAuthRequestDto,
  LocationCoordinates,
  UserDto,
  UserSelectorListItemDto,
  UserLocationEligibilityResponseDto
} from '../../../shared/core/contracts/accounts/user.interface';
import {
  AdminWorkspaceDataService
} from '../../../shared/core/base/services/administration/admin-workspace-data.service';
import {
  HelpCenterService
} from '../../../shared/core/base/services/help/help-center.service';
import {
  FirebaseAppService
} from '../../../shared/core/base/services/accounts/firebase-app.service';
import { FirebaseMessagingService } from '../../../shared/core/base/services/notifications/firebase-messaging.service';
import { AppLocationService } from '../../../shared/core/base/services/accounts/app-location.service';
import { AppSetupStore } from '../../../shared/ui/context/stores/app/app-setup.store';
import {
  I18nService
} from '../../../shared/core/base/services/localization/i18n.service';
import {
  LandingContentService
} from '../../../shared/core/base/services/content/landing-content.service';
import {
  PrivacyPolicyService, canonicalEntryConsentVersion, automaticPrivacyConsentEnabled
} from '../../../shared/core/base/services/help/privacy-policy.service';
import {
  SessionService,
  type AppSession
} from '../../../shared/core/base/services/accounts/session.service';
import {
  TermsPolicyService
} from '../../../shared/core/base/services/help/terms-policy.service';
import {
  UsersService
} from '../../../shared/core/base/services/accounts/users.service';

import {
  AdminWorkspaceStore
} from '../../../shared/ui/context/stores/admin/admin-workspace.store';

import {
  DocumentViewerComponent,
  type DocumentViewerAction,
  type DocumentViewerActionEvent,
  type DocumentViewerActionVisibility,
  type DocumentViewerConfig
} from '../../../shared/ui/components/document-viewer';
import {
  HelpCenterRevisionDocumentViewerConfigConverter
} from '../../../shared/ui/converters/app/help-center-revision-document-viewer.converter';
import type {
  EntryFirebaseAuthPopupComponent
} from '../entry-firebase-auth-popup/entry-firebase-auth-popup.component';
import {
  EntryLandingComponent
} from '../entry-landing/entry-landing.component';
import type {
  ProfileOnboardingPopupComponent
} from '../profile-onboarding-popup/profile-onboarding-popup.component';
import {
  DemoBootstrapSelectorStore,
  type DemoBootstrapSelectorMode
} from '../../../shared/ui/context/stores/app/demo-bootstrap-selector.store';

interface EntryDemoUserSelectionEvent {
  userId: string;
  user?: UserSelectorListItemDto;
  mode: DemoBootstrapSelectorMode;
  complete: () => void;
  fail: (message?: string) => void;
}

interface EntryDemoNewProfileRequestEvent {
  complete: () => void;
  fail: () => void;
}

@Component({
  selector: 'app-entry-page',
  providers: [{ provide: ExplanationGuideService, useFactory: () => inject(LANDING_EXPLANATION_GUIDE) }],
  standalone: true,
  imports: [
    ExplanationLauncherComponent,
    LandingGuideSurfaceDirective,
    EntryLandingComponent,
    DocumentViewerComponent,
    PopupComponent,
    IndicatorComponent
  ],
  templateUrl: './entry-page.component.html',
  styleUrl: './entry-page.component.scss'
})
export class EntryPageComponent implements OnInit, OnDestroy, DoCheck {
  private readonly destroyRef = inject(DestroyRef);
  private readonly firebaseAuthPopupHost = viewChild.required('firebaseAuthPopupHost', { read: ViewContainerRef });
  private readonly onboardingPopupHost = viewChild.required('onboardingPopupHost', { read: ViewContainerRef });
  protected readonly firebaseAuthPopup = signal<ComponentRef<EntryFirebaseAuthPopupComponent> | null>(null);
  protected readonly onboardingPopup = signal<ComponentRef<ProfileOnboardingPopupComponent> | null>(null);
  private readonly firebaseAuthPopupInputs = signal({ open: false, mobile: false });
  private readonly onboardingPopupInputs = signal({ open: false, user: null as UserDto | null, mobile: false, title: '', message: '' });
  private firebaseAuthPopupLoad: Promise<void> | null = null;
  private onboardingPopupLoad: Promise<void> | null = null;
  private static readonly ENTRY_CONSENT_KEY = APP_STORAGE_KEYS.entryConsent;
  private static readonly ENTRY_CONSENT_AUDIT_KEY = APP_STORAGE_KEYS.entryConsentAudit;
  private static readonly ENTRY_CONSENT_AUDIT_MAX = 30;

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly demoBootstrapSelectorStore = inject(DemoBootstrapSelectorStore);
  private readonly adminWorkspace = inject(AdminWorkspaceStore);
  private readonly adminWorkspaceData = inject(AdminWorkspaceDataService);
  private readonly helpCenter = inject(HelpCenterService);
  private readonly firebaseAppService = inject(FirebaseAppService);
  private readonly firebaseMessagingService = inject(FirebaseMessagingService);
  private readonly appLocationService = inject(AppLocationService);
  private readonly appSetupStore = inject(AppSetupStore);
  private readonly privacyPolicy = inject(PrivacyPolicyService);
  protected readonly sessionService = inject(SessionService);
  private readonly termsPolicy = inject(TermsPolicyService);
  private readonly landingContent = inject(LandingContentService);
  private readonly landingGuide = inject(LANDING_EXPLANATION_GUIDE);
  private readonly dialogStore = inject(DialogStore);
  private readonly i18n = inject(I18nService);
  private readonly usersService = inject(UsersService);
  private loginEligibilityBusy = false;
  private firebaseEntryAccessApproved = false;
  private pendingFirebaseEntryCoordinates: LocationCoordinates | null = null;
  private entryContentLoadPromise: Promise<void> | null = null;

  private entryConsentPopupOpen = false;
  private entryConsentManuallyOpened = false;
  protected get showEntryConsentPopup(): boolean { return this.entryConsentPopupOpen; }
  protected set showEntryConsentPopup(open: boolean) {
    if (open !== this.entryConsentPopupOpen) {
      this.entryConsentPopupOpen = open;
      markLandingDebug(open ? 'privacy.open' : 'privacy.close');
    }
  }
  protected showEntryTermsPopup = false;
  protected entryConsentViewOnly = false;
  protected entryPrivacyLoading = true;
  protected entryPrivacySaving = false;
  protected entryPrivacySaveMessage = '';
  protected entryPrivacySaveError = '';
  protected landingArticlesLoading = true;
  protected landingIdeaCards: InfoCardData[] = [];
  protected landingIdeaCount = 0;
  protected landingSupportedCountries: SupportedCountryDto[] = [];
  protected entryAuthUnavailable = false;
  protected entryAuthUnavailableLabel = 'entry.auth.unavailable';
  private entryTransportUnavailable = false;
  protected get entryNetworkUnavailable(): boolean {
    return this.entryTransportUnavailable
      || (environment.activitiesDataSource === 'http' && backendUnavailable());
  }
  protected set entryNetworkUnavailable(value: boolean) { this.entryTransportUnavailable = value; }
  protected entryNetworkUnavailableLabel = 'network.offline';
  protected showFirebaseAuthPopup = false;
  private firebaseEntryTransitionBusy = false;

  protected isMobileView = typeof window !== 'undefined' ? window.matchMedia('(max-width: 760px)').matches : false;
  protected onboardingOpen = false;
  protected onboardingUser: UserDto | null = null;
  protected onboardingTitle = 'profile.setup';
  protected onboardingMessage = '';
  private pendingRedirectAfterOnboarding = '';
  private pendingDemoSessionUserId = '';
  private autoOnboardingRequested = false;
  private entryConsentAccepted = false;
  private resumeExploreAfterConsent = false;
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
      if (this.geolocationPermissionState === 'granted' && !this.loginEligibilityBusy) {
        this.browserLocationAutoRequestAttempted = false;
      }
      this.syncEntryAuthGateState();
    });
  };

  constructor() {
    this.initializeEntryFlow();
    effect(() => {
      if (!this.appSetupStore.privacyRequested()) return;
      this.appSetupStore.privacyRequested.set(false);
      this.openEntryConsentPopup();
    });
  }

  private readonly affiliateReferral = inject(AffiliateReferralService);

  ngOnInit(): void {
    this.landingGuide.beginVisit();
    this.syncMobileView();
    this.queryParamSubscription = this.route.queryParamMap.subscribe(queryParams => {
      this.affiliateReferral.capture(queryParams.get('affiliate'));
      const redirect = queryParams.get('redirect');
      const redirectParams = redirect?.startsWith('/') && !redirect.startsWith('//')
        ? this.router.parseUrl(redirect).queryParams : {};
      // An invite keeps its context inside the existing authentication redirect.
      // The hint only selects public landing content; claiming the token owns
      // authorization and group membership after login.
      const sharedMode = redirectParams['partnerInvite'] ? redirectParams['mode'] : queryParams.get('mode');
      this.changeLandingMode(groupType(sharedMode));
      if (redirect?.startsWith('/') && !redirect.startsWith('//')) {
        this.affiliateReferral.capture(this.router.parseUrl(redirect).queryParams['affiliate'] ?? null);
      }
      this.autoOnboardingRequested = queryParams.get('onboarding') === '1';
      this.beginAutoOnboardingIfReady();
    });
  }

  ngOnDestroy(): void {
    finishLandingDebug();
    this.queryParamSubscription?.unsubscribe();
    this.landingContentRequestToken += 1;
    this.grantedLocationEligibilityRequestToken += 1;
    this.unbindGeolocationPermissionStatus();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.syncMobileView();
  }

  @HostListener('window:offline')
  protected onBrowserOffline(): void {
    // A response started before disconnection must not reopen the entry gate.
    this.landingContentRequestToken += 1;
    this.entryContentLoadPromise = null;
    this.grantedLocationEligibilityRequestToken += 1;
    this.grantedLocationEligibilityPromise = null;
    this.markEntryNetworkUnavailable();
  }

  @HostListener('window:online')
  protected onBrowserOnline(): void {
    this.entryNetworkUnavailable = false;
    this.syncLandingLoginAvailability(null, 'reset');
    void this.synchronizeDeploymentAuthMode();
    void this.loadEntryContent();
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
    return this.firebaseEntryTransitionBusy || this.sessionService.firebaseBusy();
  }

  protected get firebaseAuthMessage(): string {
    return this.sessionService.firebaseNotice();
  }

  protected async openEntryDemo(): Promise<void> {
    if (this.entryNetworkUnavailable && environment.activitiesDataSource === 'http') {
      return;
    }
    if (!await this.ensureEntryConsent()) {
      this.resumeExploreAfterConsent = true;
      return;
    }
    this.resumeExploreAfterConsent = false;
    this.openDemoUserSelectorPopup();
  }

  protected async openEntryFirebaseAuth(): Promise<void> {
    await this.openEntryAuthPopup();
  }

  private async openEntryAuthPopup(
    options: {
      forceAuthPopup?: boolean;
      bypassConsumerEligibility?: boolean;
    } = {}
  ): Promise<void> {
    if (this.entryNetworkUnavailable || this.entryAuthUnavailable) {
      return;
    }
    await this.synchronizeDeploymentAuthMode();
    if (!await this.ensureEntryConsent()) {
      return;
    }
    if (this.authMode !== 'firebase' && !options.forceAuthPopup) {
      this.openDemoUserSelectorPopup();
      return;
    }
    if (this.showEntryLocationSetup(options.bypassConsumerEligibility)) return;
    if (!options.bypassConsumerEligibility && this.loginEligibilityBusy) {
      return;
    }
    this.firebaseEntryAccessApproved = false;
    if (!options.bypassConsumerEligibility) {
      if (!await this.ensureHttpLoginAccessAllowed()) {
        this.pendingFirebaseEntryCoordinates = null;
        return;
      }
      this.firebaseEntryAccessApproved = true;
    }
    if (this.firebaseAuthProfile && !options.forceAuthPopup) {
      void this.onFirebaseSessionContinueRequested();
      return;
    }
    this.showFirebaseAuthPopup = true;
    void this.ensureFirebaseAuthPopupLoaded();
    markLandingDebug('auth.open');
  }

  private ensureFirebaseAuthPopupLoaded(): Promise<void> {
    if (this.firebaseAuthPopup()) return Promise.resolve();
    return this.firebaseAuthPopupLoad ??= Promise.all([
      import('../entry-firebase-auth-popup/entry-firebase-auth-popup.component'),
      preloadAdapterMode(environment.activitiesDataSource)
    ]).then(([module]) => {
        if (this.destroyRef.destroyed) return;
        this.firebaseAuthPopupInputs.set({ open: this.showFirebaseAuthPopup, mobile: this.isMobileView });
        this.firebaseAuthPopup.set(this.firebaseAuthPopupHost().createComponent(module.EntryFirebaseAuthPopupComponent, {
          bindings: [
            inputBinding('open', () => this.firebaseAuthPopupInputs().open),
            inputBinding('isMobileView', () => this.firebaseAuthPopupInputs().mobile),
            inputBinding('busy', () => this.firebaseAuthIsBusy),
            inputBinding('statusMessage', () => this.firebaseAuthMessage),
            outputBinding('closeRequested', () => this.closeFirebaseAuthPopup()),
            outputBinding<FirebaseAuthRequestDto>('authRequested', request => this.onRequestFirebaseAuth(request))
          ]
        }));
      }).finally(() => { this.firebaseAuthPopupLoad = null; });
  }

  private ensureOnboardingPopupLoaded(): Promise<void> {
    if (this.onboardingPopup()) return Promise.resolve();
    return this.onboardingPopupLoad ??= import('../profile-onboarding-popup/profile-onboarding-popup.component')
      .then(module => {
        if (this.destroyRef.destroyed) return;
        this.onboardingPopup.set(this.onboardingPopupHost().createComponent(module.ProfileOnboardingPopupComponent, {
          bindings: [
            inputBinding('open', () => this.onboardingPopupInputs().open),
            inputBinding('user', () => this.onboardingPopupInputs().user),
            inputBinding('mobile', () => this.onboardingPopupInputs().mobile),
            inputBinding('title', () => this.onboardingPopupInputs().title),
            inputBinding('message', () => this.onboardingPopupInputs().message),
            outputBinding<UserDto>('completed', user => this.onOnboardingCompleted(user)),
            outputBinding('dismissed', () => this.onOnboardingDismissed())
          ]
        }));
      }).finally(() => { this.onboardingPopupLoad = null; });
  }

  ngDoCheck(): void {
    // Keep the original live input bindings as the parent page is checked.
    if (this.firebaseAuthPopup()) {
      const current = this.firebaseAuthPopupInputs();
      if (current.open !== this.showFirebaseAuthPopup || current.mobile !== this.isMobileView) {
        this.firebaseAuthPopupInputs.set({ open: this.showFirebaseAuthPopup, mobile: this.isMobileView });
      }
    }
    if (this.onboardingPopup()) {
      const current = this.onboardingPopupInputs();
      if (current.open !== this.onboardingOpen || current.user !== this.onboardingUser
        || current.mobile !== this.isMobileView || current.title !== this.onboardingTitle
        || current.message !== this.onboardingMessage) {
        this.onboardingPopupInputs.set({ open: this.onboardingOpen, user: this.onboardingUser,
          mobile: this.isMobileView, title: this.onboardingTitle, message: this.onboardingMessage });
      }
    }
  }

  private showEntryLocationSetup(bypassLocationSetup = false): boolean {
    this.appSetupStore.guideRequested.set(false);
    this.landingGuide.closePopup();
    if (!bypassLocationSetup && this.appSetupStore.locationSetupMissing()) {
      this.appSetupStore.open();
      return true;
    }
    return false;
  }

  protected async openEntryOperator(): Promise<void> {
    if (this.entryNetworkUnavailable) {
      return;
    }
    if (!this.usersService.localModeEnabled || this.authMode === 'firebase') {
      await this.openEntryAuthPopup({
        forceAuthPopup: this.authMode !== 'firebase',
        bypassConsumerEligibility: true
      });
      return;
    }
    if (!await this.ensureEntryConsent()) {
      return;
    }
    this.openDemoUserSelectorPopup('operator', ['operator']);
  }

  protected closeFirebaseAuthPopup(): void {
    if (this.firebaseAuthIsBusy) {
      return;
    }
    void this.sessionService.cancelFirebaseAccountLink();
    this.showFirebaseAuthPopup = false;
    markLandingDebug('auth.close');
    this.firebaseEntryAccessApproved = false;
    this.pendingFirebaseEntryCoordinates = null;
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
    this.entryConsentManuallyOpened = true;
    this.entryConsentViewOnly = viewOnly;
    this.showEntryConsentPopup = true;
  }

  protected closeEntryConsentPopup(): void {
    if (this.entryPrivacyLoading) {
      return;
    }
    this.resumeExploreAfterConsent = false;
    this.showEntryConsentPopup = false;
    this.entryConsentManuallyOpened = false;
    this.entryConsentViewOnly = false;
    this.entryPrivacySaveMessage = '';
    this.entryPrivacySaveError = '';
  }

  protected openEntryTermsPopup(): void {
    markLandingDebug('terms.open');
    this.showEntryTermsPopup = true;
    void this.termsPolicy.prepareOpen();
  }

  protected closeEntryTermsPopup(): void {
    markLandingDebug('terms.close');
    this.showEntryTermsPopup = false;
  }

  protected entryPrivacyDocumentConfig(): DocumentViewerConfig {
    const revision = this.privacyPolicy.activeRevision();
    return HelpCenterRevisionDocumentViewerConfigConverter.convert({
      revision,
      open: this.showEntryConsentPopup,
      shell: 'popup',
      onClose: () => this.closeEntryConsentPopup(),
      ariaLabel: this.uiText('privacy.consent.aria'),
      closeAriaLabel: this.uiText('privacy.popup.close'),
      closeOnBackdrop: this.entryConsentViewOnly,
      titleFallback: this.uiText('privacy.document.title'),
      descriptionFallback: this.uiText('privacy.document.title'),
      versionLabel: this.privacyPolicy.activeVersionLabel(),
      loading: this.entryPrivacyLoading,
      loadingLabel: this.uiText('privacy.document.loading'),
      emptyState: {
        icon: 'policy',
        title: this.uiText('privacy.document.unavailable.title'),
        description: this.uiText('privacy.document.unavailable.description')
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
      ariaLabel: this.uiText('terms.document.aria'),
      closeAriaLabel: this.uiText('terms.popup.close'),
      titleFallback: this.uiText('terms.document.title'),
      descriptionFallback: this.uiText('document.terms.description'),
      versionLabel: this.helpCenter.activeTermsVersionLabel(),
      loading: this.termsPolicy.loading() || (this.landingArticlesLoading && !revision),
      loadingLabel: this.uiText('terms.document.loading'),
      emptyState: {
        icon: 'rule',
        title: this.uiText('terms.document.unavailable.title'),
        description: this.uiText('terms.document.unavailable.description')
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
    markLandingDebug('privacy.accepted');
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
      this.entryPrivacySaveError = this.uiText('privacy.preferences.save.error');
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
    this.entryConsentManuallyOpened = false;
    this.entryConsentViewOnly = false;
    this.entryPrivacySaving = false;
    this.onEntryConsentStateChanged(true);
    const resumeExplore = this.resumeExploreAfterConsent;
    this.resumeExploreAfterConsent = false;
    if (resumeExplore) {
      await this.openEntryDemo();
    }
  }

  protected rejectEntryConsent(): void {
    markLandingDebug('privacy.rejected');
    this.resumeExploreAfterConsent = false;
    const nowIso = new Date().toISOString();
    localStorage.removeItem(EntryPageComponent.ENTRY_CONSENT_KEY);
    this.appendEntryConsentAudit('rejected', nowIso);
    this.showEntryConsentPopup = false;
    this.entryConsentManuallyOpened = false;
    this.entryConsentViewOnly = false;
    this.entryPrivacySaveMessage = '';
    this.entryPrivacySaveError = '';
    this.onEntryConsentStateChanged(false);
  }

  private initializeEntryFlow(): void {
    this.entryNetworkUnavailable = typeof navigator !== 'undefined' && navigator.onLine === false;
    this.entryConsentViewOnly = false;
    this.entryPrivacyLoading = this.privacyPolicy.state() === null;
    this.showEntryConsentPopup = !this.entryPrivacyLoading && this.shouldPromptEntryConsent();
    this.landingArticlesLoading = true;
    this.syncLandingLoginAvailability(null, 'reset');
    this.showFirebaseAuthPopup = false;
    void this.synchronizeDeploymentAuthMode();
    void this.loadEntryContent();
  }

  private async synchronizeDeploymentAuthMode(): Promise<void> {
    if (!isFirebaseLoginEnabled()) {
      this.sessionService.setFirebaseRuntimeAvailable(false);
      this.syncEntryAuthGateState();
      return;
    }
    await this.firebaseAppService.ensureFirebaseRuntime();
    this.syncEntryAuthGateState();
  }

  private async ensureEntryConsent(): Promise<boolean> {
    if (this.entryNetworkUnavailable && environment.activitiesDataSource === 'http') {
      return false;
    }
    if (!automaticPrivacyConsentEnabled()) return true;
    if (this.entryPrivacyLoading || this.privacyPolicy.state() === null) {
      await this.loadEntryContent();
    }
    if ((this.entryNetworkUnavailable && environment.activitiesDataSource === 'http') || this.entryPrivacyLoading) {
      return false;
    }
    if (this.hasEntryConsent) {
      return true;
    }
    this.entryConsentViewOnly = false;
    this.showEntryConsentPopup = true;
    return false;
  }

  private async ensureHttpLoginAccessAllowed(): Promise<boolean> {
    // Device setup is optional. Only an already known regional security decision
    // may reject entry; missing browser permissions never open a blocking dialog.
    if (this.isLoginBlockedByLandingBundle()) {
      this.openBundledLoginUnavailableInfo();
      return false;
    }
    return true;
  }

  private openDemoUserSelectorPopup(
    mode: DemoBootstrapSelectorMode = 'member',
    selectableModes: readonly DemoBootstrapSelectorMode[] = [
      'member',
      'admin',
      'operator'
    ]
  ): void {
    this.demoBootstrapSelectorStore.openDemoBootstrapSelector({
      mode,
      selectableModes,
      groupType: this.landingContent.mode(),
      onSelect: (userId, mode, user) => new Promise<boolean | string>(resolve => {
        this.ngZone.run(() => {
          void this.onDemoUserSelected({
            userId,
            user,
            mode,
            complete: () => resolve(true),
            fail: message => resolve(message === '' ? '' : message?.trim() || false)
          });
        });
      }),
      onNewProfile: () => new Promise<boolean>(resolve => {
        this.ngZone.run(() => {
          void this.onDemoNewProfileRequested({
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
    if (selection.mode === 'admin') {
      await this.onDemoAdminSelected(selection, normalizedUserId);
      return;
    }
    if (selection.mode === 'operator') {
      await this.onDemoOperatorSelected(selection, normalizedUserId);
      return;
    }
    const selectedUser = this.usersService.localModeEnabled
      ? this.usersService.peekCachedUserById(normalizedUserId)
      : null;
    const coordinates = selectedUser?.locationCoordinates ?? selection.user?.locationCoordinates;
    if (coordinates && Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude)) {
      try {
        const result = await this.usersService.checkLocationEligibility(coordinates);
        if (!result.eligible) {
          selection.fail(this.loginUnavailableMessage(result));
          return;
        }
      } catch {
        selection.fail(this.uiText('entry.permissions.location.unavailable'));
        return;
      }
    }
    if (selectedUser && this.requiresProfileOnboarding(selectedUser)) {
      this.pendingDemoSessionUserId = normalizedUserId;
      this.openOnboardingGate(selectedUser, this.memberRedirectUrl());
      selection.complete();
      return;
    }
    const session = this.usersService.localModeEnabled
      ? this.sessionService.startDemoSession(normalizedUserId)
      : await this.sessionService.startTrackedDemoSession(normalizedUserId);
    if (!session) {
      selection.fail(this.sessionService.firebaseNotice());
      return;
    }
    try {
      // The destination's existing avatar hydration owns profile loading.
      if (this.usersService.localModeEnabled || (this.landingContent.mode() !== 'dating'
        && selection.user?.baseGroupTypes?.includes(this.landingContent.mode()))) {
        this.usersService.stageInitialWorkspace(baseGroupId(this.landingContent.mode()));
      }
      const navigated = await (this.usersService.localModeEnabled
        ? this.router.navigateByUrl(this.memberRedirectUrl())
        : this.router.navigateByUrl(this.memberRedirectUrl(), { state: { avatarLoading: true } }));
      if (!navigated) {
        selection.fail();
        return;
      }
      selection.complete();
    } catch {
      selection.fail();
    }
  }

  protected async onDemoNewProfileRequested(request: EntryDemoNewProfileRequestEvent): Promise<void> {
    const user = this.buildDemoRegistrationUser();
    this.pendingDemoSessionUserId = user.id;
    this.openOnboardingGate(
      user,
      this.memberRedirectUrl(),
      {
        title: 'profile.setup',
        message: 'profile.setup.demo.message'
      }
    );
    request.complete();
  }

  private async onDemoAdminSelected(
    selection: EntryDemoUserSelectionEvent,
    adminUserId: string
  ): Promise<void> {
    const normalizedAdminUserId = this.adminWorkspace.prepareSelectedAdminSession(adminUserId);
    if (!normalizedAdminUserId) {
      selection.fail();
      return;
    }
    const session = this.usersService.localModeEnabled
      ? this.sessionService.startDemoSession(normalizedAdminUserId)
      : await this.sessionService.startTrackedDemoSession(normalizedAdminUserId);
    if (!session) {
      selection.fail(this.sessionService.firebaseNotice());
      return;
    }
    try {
      const profile = await this.usersService.loadProfileExtById(normalizedAdminUserId, undefined, baseGroupId(this.landingContent.mode()));
      if (!profile) { selection.fail(); return; }
      const navigated = await this.router.navigateByUrl('/admin');
      if (!navigated) {
        selection.fail();
        return;
      }
      selection.complete();
    } catch {
      selection.fail();
    }
  }

  private async onDemoOperatorSelected(
    selection: EntryDemoUserSelectionEvent,
    operatorUserId: string
  ): Promise<void> {
    const session = this.usersService.localModeEnabled
      ? this.sessionService.startDemoSession(operatorUserId)
      : await this.sessionService.startTrackedDemoSession(operatorUserId);
    if (!session) {
      selection.fail(this.sessionService.firebaseNotice());
      return;
    }
    try {
      const navigated = await this.router.navigateByUrl('/operator');
      if (!navigated) {
        selection.fail();
        return;
      }
      selection.complete();
    } catch {
      selection.fail();
    }
  }

  protected async onFirebaseAuthRequested(request: FirebaseAuthRequestDto): Promise<void> {
    this.firebaseEntryTransitionBusy = true;
    try {
      const entryCoordinates = this.pendingFirebaseEntryCoordinates;
      const entryAccessApproved = this.firebaseEntryAccessApproved;
      const session = await this.sessionService.startAuthSession(request);
      if (!session) {
        return;
      }
      if (session.kind === 'firebase' && entryCoordinates) {
        await this.appLocationService.stageLoginCoordinates(session.profile.id, entryCoordinates);
      }
      this.pendingFirebaseEntryCoordinates = null;
      this.firebaseEntryAccessApproved = false;
      await this.runPostSessionGate(session, this.redirectUrl(), undefined, entryAccessApproved);
    } finally {
      this.firebaseEntryTransitionBusy = false;
    }
  }

  protected async onFirebaseSessionContinueRequested(): Promise<void> {
    this.firebaseEntryTransitionBusy = true;
    try {
      await preloadAdapterMode(environment.activitiesDataSource);
      const entryAccessApproved = this.firebaseEntryAccessApproved;
      const session = await this.sessionService.restoreFirebaseSession();
      if (!session) {
        return;
      }
      this.firebaseEntryAccessApproved = false;
      await this.runPostSessionGate(session, this.redirectUrl(), undefined, entryAccessApproved);
    } finally {
      this.firebaseEntryTransitionBusy = false;
    }
  }

  protected onEntryConsentStateChanged(accepted: boolean): void {
    this.entryConsentAccepted = accepted;
    this.appSetupStore.privacyMissing.set(this.entryConsentVersion().length > 0 && !accepted);
    this.beginAutoOnboardingIfReady();
  }

  protected async onOnboardingCompleted(_user: UserDto): Promise<void> {
    const redirect = this.pendingRedirectAfterOnboarding || this.redirectUrl();
    const demoSessionUserId = this.pendingDemoSessionUserId;
    this.pendingRedirectAfterOnboarding = '';
    this.pendingDemoSessionUserId = '';
    if (demoSessionUserId) {
      const session = this.usersService.localModeEnabled
        ? this.sessionService.startDemoSession(demoSessionUserId)
        : await this.sessionService.startTrackedDemoSession(demoSessionUserId);
      if (!session) {
        this.onboardingOpen = false;
        this.onboardingUser = null;
        return;
      }
    }
    try {
      if (demoSessionUserId && !this.usersService.localModeEnabled) {
        // Read under the registered session before displaying protected media,
        // just as the ordinary demo selector does after sign-in.
        const user = await this.usersService.loadUserById(demoSessionUserId, 8000);
        if (!user) {
          await this.sessionService.logout();
          this.onboardingOpen = false;
          this.onboardingUser = null;
          return;
        }
      }
      const navigated = await this.router.navigateByUrl(redirect);
      if (navigated && demoSessionUserId) {
        this.demoBootstrapSelectorStore.closeDemoBootstrapSelector();
      }
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

  private memberRedirectUrl(): string {
    const redirect = this.redirectUrl();
    return this.isAdminShellRedirect(redirect) ? '/game' : redirect;
  }

  private syncMobileView(): void {
    this.isMobileView = typeof window !== 'undefined' ? window.matchMedia('(max-width: 760px)').matches : false;
  }

  private beginAutoOnboardingIfReady(): void {
    if (!this.autoOnboardingRequested || (automaticPrivacyConsentEnabled() && !this.entryConsentAccepted)) {
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

  private async runPostSessionGate(
    session: AppSession,
    redirectUrl: string,
    loadedUser?: UserDto,
    entryAccessApproved = false
  ): Promise<void> {
    const gateToken = ++this.postSessionGateToken;
    const sessionIdentity = this.sessionService.identity();
    await preloadAdapterMode(environment.activitiesDataSource);
    if (gateToken !== this.postSessionGateToken || sessionIdentity !== this.sessionService.identity()) return;
    const adminShellRedirect = this.isAdminShellRedirect(redirectUrl);
    let user: UserDto | null = loadedUser ?? null;
    if (!loadedUser) {
      try {
        user = await this.usersService.loadUserById(session.kind === 'demo' ? session.userId : undefined, 8000);
      } catch {
        user = null;
      }
    }
    if (gateToken !== this.postSessionGateToken || sessionIdentity !== this.sessionService.identity()) {
      return;
    }
    if (!user && session.kind === 'firebase') {
      this.openOnboardingGate(
        this.buildFirebaseRegistrationUser(session.profile),
        redirectUrl,
        {
          title: 'account.registration.required',
          message: 'profile.setup.registration.message'
        }
      );
      return;
    }
    if (!user && session.kind === 'operator-bootstrap') {
      this.closeOnboardingGate();
      this.sessionService.clearOperatorBootstrapSession(
        'operator.bootstrap.auth.profile.unavailable'
      );
      return;
    }
    if (!user) {
      this.closeOnboardingGate();
      await this.router.navigateByUrl(redirectUrl);
      return;
    }
    if (this.isAdminUser(user)) {
      this.closeOnboardingGate();
      await this.router.navigateByUrl('/admin');
      return;
    }
    if (this.isOperatorUser(user)) {
      this.closeOnboardingGate();
      await this.router.navigateByUrl('/operator');
      return;
    }
    if (adminShellRedirect) {
      this.closeOnboardingGate();
      await this.router.navigateByUrl('/game');
      return;
    }
    if (!this.requiresProfileOnboarding(user)) {
      this.closeOnboardingGate();
      await this.router.navigateByUrl(redirectUrl);
      return;
    }
    this.openOnboardingGate(
      user,
      redirectUrl,
      user.profileStatus === 'onboarding'
        ? {
            title: 'account.registration.required',
            message: 'profile.setup.registration.message'
          }
        : undefined
    );
  }

  private requiresProfileOnboarding(user: UserDto | null | undefined): boolean {
    if (
      !user
      || this.isAdminUser(user)
      || this.isOperatorUser(user)
      || user.profileStatus === 'blocked'
      || user.profileStatus === 'deleted'
    ) {
      return false;
    }
    return user.profileStatus === 'onboarding'
      || AppUtils.positiveInteger(user.profileFormVersion) < CURRENT_PROFILE_FORM_VERSION;
  }

  private isAdminUser(user: UserDto | null | undefined): boolean {
    return user?.admin === true || `${user?.hostTier ?? ''}`.trim().toLowerCase() === 'admin';
  }

  private isOperatorUser(user: UserDto | null | undefined): boolean {
    return hasOperatorRole(user);
  }

  private isAdminShellRedirect(redirectUrl: string): boolean {
    const normalizedRedirect = `${redirectUrl ?? ''}`.trim();
    return normalizedRedirect === '/admin' || normalizedRedirect === '/admin/workspace';
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
      this.showFirebaseAuthPopup = false;
      this.onboardingOpen = true;
      void this.ensureOnboardingPopupLoaded();
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
      chats: 0,
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
      feedbackCounts: {
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

  private requestCurrentLocation(): Promise<LocationCoordinates | null> {
    return this.appLocationService.requestCurrentCoordinates();
  }


  private uiText(value: string): string {
    return this.i18n.translate(value);
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
        canonicalEntryConsentVersion(parsed.version ?? '') !== expectedVersion ||
        parsed.accepted !== true ||
        typeof parsed.acceptedAtIso !== 'string' ||
        parsed.acceptedAtIso.length === 0
      ) {
        return null;
      }
      return {
        version: expectedVersion,
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
    return automaticPrivacyConsentEnabled()
      && this.entryConsentVersion().length > 0 && this.loadEntryConsentState() === null;
  }

  protected changeLandingMode(mode: GroupType): void {
    if (mode === this.landingContent.mode()) return;
    this.landingContent.mode.set(mode);
    this.landingContentRequestToken++;
    this.entryContentLoadPromise = null;
    this.landingIdeaCards = [];
    this.landingIdeaCount = 0;
    void this.loadEntryContent({ promptConsent: false });
  }

  private async loadEntryContent(options: { promptConsent?: boolean } = {}): Promise<void> {
    if (this.entryContentLoadPromise) {
      return this.entryContentLoadPromise;
    }
    const requestToken = ++this.landingContentRequestToken;
    const groupId = baseGroupId(this.landingContent.mode());
    this.startEntryPrivacyLoadingWindow();
    this.startLandingArticlesLoadingWindow();
    this.entryContentLoadPromise = (async () => {
      try {
        const displayState = await this.landingContent.loadDisplayState(groupId);
        this.ngZone.run(() => {
          if (requestToken !== this.landingContentRequestToken) {
            return;
          }
          this.entryNetworkUnavailable = typeof navigator !== 'undefined' && navigator.onLine === false;
          this.landingIdeaCards = displayState.ideaCards;
          this.landingIdeaCount = displayState.state.ideasTotal;
          this.landingSupportedCountries = displayState.state.supportedCountries ?? [];
          if (!this.locationEligibilityResolvedFromCoordinates
            && (displayState.state.loginAvailability || this.landingLoginAvailability === null)) {
            this.syncLandingLoginAvailability(displayState.state.loginAvailability, 'bundle');
          }
          this.finishEntryPrivacyLoad(requestToken, options.promptConsent !== false);
          this.changeDetectorRef.markForCheck();
        });
      } catch {
        this.ngZone.run(() => {
          if (requestToken !== this.landingContentRequestToken) {
            return;
          }
          this.landingIdeaCards = [];
          this.landingIdeaCount = 0;
          this.landingSupportedCountries = [];
          this.markEntryNetworkUnavailable();
          markLandingDebug('landing.content.failed');
          this.finishEntryPrivacyLoad(requestToken, options.promptConsent !== false);
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
      if (requestToken === this.landingContentRequestToken) {
        this.entryContentLoadPromise = null;
      }
    });
    return this.entryContentLoadPromise;
  }

  private finishEntryPrivacyLoad(requestToken: number, promptConsent: boolean): void {
    if (requestToken !== this.landingContentRequestToken) {
      return;
    }
    this.endEntryPrivacyLoadingWindow();
    this.syncEntryPrivacyApprovalsForRevision();
    if (promptConsent && !this.entryNetworkUnavailable && !this.entryConsentViewOnly && !this.entryConsentManuallyOpened) {
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
        label: this.uiText(this.hasEntryConsent ? 'privacy.consent.revoke' : 'cancel'),
        palette: 'slate',
        disabled: this.entryPrivacySaving
      },
      {
        id: 'entry-privacy-accept',
        label: this.uiText('privacy.consent.accept'),
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
      return this.uiText('saving');
    }
    return this.uiText(!this.hasEntryConsent ? 'privacy.preferences.approve' : 'privacy.preferences.save');
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
      this.entryPrivacySaveMessage = this.uiText('privacy.preferences.save.success');
      if (!this.hasEntryConsent) {
        this.entryPrivacySaving = false;
        await this.acceptEntryConsent(selectedSectionIds);
        return;
      } else {
        this.closeEntryConsentPopup();
      }
    } catch {
      this.entryPrivacySaveError = this.uiText('privacy.preferences.save.error');
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
          locationRequired: availability.locationRequired === true
        }
      : null;
    this.syncEntryAuthGateState();
  }

  private markEntryNetworkUnavailable(): void {
    this.entryNetworkUnavailable = true;
    this.entryNetworkUnavailableLabel = 'network.offline';
    this.syncLandingLoginAvailability(null, 'reset');
  }

  private syncEntryAuthGateState(): void {
    // A previous rejected browser sample must not turn Login into a permanent block.
    // The selected profile and the retryable Setup flow decide admission on click.
    this.entryAuthUnavailable = demoFailoverEnabled() && environment.activitiesDataSource === 'local';
    this.entryAuthUnavailableLabel = this.entryAuthUnavailable ? 'network.offline' : 'entry.auth.unavailable';
    // Device setup stays available from its launcher during and after sign-in.
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
    this.dialogStore.openInfo(this.loginUnavailableMessage(this.landingLoginAvailability), {
      title: 'account.registration.required',
      confirmLabel: 'OK'
    });
  }

  private loginUnavailableMessage(availability: UserLocationEligibilityResponseDto | null): string {
    return availability?.message?.trim()
      || 'Login is currently unavailable from your country or region for security reasons. Please come back later.';
  }

  private resolveBrowserLocationAccessIfNeeded(): void {
    if (this.authMode !== 'firebase' || !this.isLoginLocationRequiredByLandingBundle()
      || this.grantedLocationEligibilityPromise || this.browserLocationAutoRequestAttempted) {
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
  }

  private async resolveBrowserLocationAccess(requestToken: number): Promise<void> {
    const accountId = this.sessionService.activeUserId();
    try {
      const permissionState = await this.queryGeolocationPermissionState();
      if (
        requestToken !== this.grantedLocationEligibilityRequestToken
        || permissionState !== 'granted'
      ) {
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

      if (result.eligible && accountId && accountId === this.sessionService.activeUserId()) {
        await this.appLocationService.stageLoginCoordinates(accountId, coordinates);
      }
      if (requestToken !== this.grantedLocationEligibilityRequestToken) return;
      this.ngZone.run(() => {
        this.syncLandingLoginAvailability(result, 'coordinates');
        if (result.eligible && !accountId && accountId === this.sessionService.activeUserId()) {
          this.pendingFirebaseEntryCoordinates = coordinates;
        }
        this.changeDetectorRef.markForCheck();
      });
    } catch {
      // Login retries the permission and eligibility check if the silent refresh cannot complete.
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
