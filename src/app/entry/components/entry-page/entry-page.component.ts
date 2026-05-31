import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { ProfileOnboardingService, SessionService, UsersService, type AppSession, type FirebaseAuthProfile, type FirebaseAuthRequest, type UserDto } from '../../../shared/core';
import { EntryShellComponent, type EntryDemoUserSelectionEvent } from '../entry-shell/entry-shell.component';
import { ProfileOnboardingPopupComponent } from '../profile-onboarding-popup/profile-onboarding-popup.component';

@Component({
  selector: 'app-entry-page',
  standalone: true,
  imports: [EntryShellComponent, ProfileOnboardingPopupComponent],
  template: `
    <app-entry-shell
      [authMode]="sessionService.authMode"
      [firebaseAuthProfile]="sessionService.firebaseProfile()"
      [firebaseAuthIsBusy]="sessionService.firebaseBusy()"
      [firebaseAuthMessage]="sessionService.firebaseNotice()"
      [isMobileView]="isMobileView"
      (demoUserSelected)="onDemoUserSelected($event)"
      (firebaseAuthRequested)="onFirebaseAuthRequested($event)"
      (firebaseSessionContinueRequested)="onFirebaseSessionContinueRequested()"
      (entryConsentStateChanged)="onEntryConsentStateChanged($event)"
    ></app-entry-shell>
    <app-profile-onboarding-popup
      [open]="onboardingOpen"
      [user]="onboardingUser"
      [mobile]="isMobileView"
      (completed)="onOnboardingCompleted($event)"
      (dismissed)="onOnboardingDismissed()"
    ></app-profile-onboarding-popup>
  `
})
export class EntryPageComponent implements OnInit, OnDestroy {
  private static readonly ONBOARDING_OPTIMISTIC_OPEN_DELAY_MS = 350;

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly usersService = inject(UsersService);
  private readonly onboardingService = inject(ProfileOnboardingService);
  protected readonly sessionService = inject(SessionService);
  protected isMobileView = typeof window !== 'undefined' ? window.innerWidth <= 760 : false;
  protected onboardingOpen = false;
  protected onboardingUser: UserDto | null = null;
  private pendingRedirectAfterOnboarding = '';
  private pendingDemoSessionUserId = '';
  private autoOnboardingRequested = false;
  private entryConsentAccepted = false;
  private postSessionGateToken = 0;
  private queryParamSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.syncMobileView();
    this.queryParamSubscription = this.route.queryParamMap.subscribe(queryParams => {
      this.autoOnboardingRequested = queryParams.get('onboarding') === '1';
      this.beginAutoOnboardingIfReady();
    });
  }

  ngOnDestroy(): void {
    this.queryParamSubscription?.unsubscribe();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.syncMobileView();
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
      this.pendingRedirectAfterOnboarding = this.redirectUrl();
      this.onboardingUser = selectedUser;
      this.onboardingOpen = true;
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
      }
    } catch {
      selection.fail();
    }
  }

  protected async onFirebaseAuthRequested(request: FirebaseAuthRequest): Promise<void> {
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
    const session = await this.sessionService.ensureSession();
    if (!session) {
      return;
    }
    await this.runPostSessionGate(session, this.redirectUrl());
  }

  private async runPostSessionGate(session: AppSession, redirectUrl: string): Promise<void> {
    const gateToken = ++this.postSessionGateToken;
    const adminRedirect = this.isAdminRedirect(redirectUrl);
    let optimisticOnboardingTimer: ReturnType<typeof setTimeout> | null = null;
    if (session.kind === 'firebase' && !adminRedirect) {
      optimisticOnboardingTimer = setTimeout(() => {
        if (gateToken !== this.postSessionGateToken || this.onboardingOpen) {
          return;
        }
        this.pendingRedirectAfterOnboarding = redirectUrl;
        this.onboardingUser = this.optimisticOnboardingUser(session.profile);
        this.onboardingOpen = true;
      }, EntryPageComponent.ONBOARDING_OPTIMISTIC_OPEN_DELAY_MS);
    }
    let user: UserDto | null = null;
    try {
      user = await this.usersService.loadUserById(session.kind === 'demo' ? session.userId : undefined, 8000);
    } catch {
      user = null;
    } finally {
      if (optimisticOnboardingTimer) {
        clearTimeout(optimisticOnboardingTimer);
      }
    }
    if (gateToken !== this.postSessionGateToken) {
      return;
    }
    if (!user) {
      this.closeOnboardingGate();
      await this.router.navigateByUrl(redirectUrl);
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
    this.pendingRedirectAfterOnboarding = redirectUrl;
    this.onboardingUser = user;
    this.onboardingOpen = true;
  }

  private isAdminRedirect(redirectUrl: string): boolean {
    const normalizedRedirect = `${redirectUrl ?? ''}`.trim();
    return normalizedRedirect === '/admin' || normalizedRedirect.startsWith('/admin/');
  }

  private closeOnboardingGate(): void {
    this.onboardingOpen = false;
    this.onboardingUser = null;
    this.pendingRedirectAfterOnboarding = '';
    this.pendingDemoSessionUserId = '';
  }

  private optimisticOnboardingUser(profile: FirebaseAuthProfile): UserDto {
    const displayName = `${profile.name || profile.email || 'Firebase User'}`.trim();
    return {
      id: profile.id.trim() || profile.email.trim(),
      name: displayName,
      age: 0,
      birthday: '',
      city: '',
      height: '',
      physique: '',
      languages: [],
      horoscope: '',
      initials: profile.initials?.trim() || this.initialsFromText(displayName),
      gender: '' as UserDto['gender'],
      statusText: 'New profile',
      hostTier: '',
      traitLabel: '',
      completion: 0,
      profileFormVersion: 0,
      headline: '',
      about: '',
      affinity: 0,
      images: [],
      profileDetails: [],
      impressions: {},
      profileStatus: 'onboarding',
      previousProfileStatus: null,
      deletedAtIso: new Date().toISOString(),
      admin: false,
      activities: {
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
        adminJobs: 0,
        adminMetrics: 0
      }
    };
  }

  private initialsFromText(value: string): string {
    const words = value
      .replace(/@.*/, '')
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) {
      return 'U';
    }
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
}
