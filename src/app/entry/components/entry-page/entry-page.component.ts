import { ChangeDetectorRef, Component, HostListener, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { ProfileOnboardingService, SessionService, UsersService, type AppSession, type FirebaseAuthRequestDto, type UserDto } from '../../../shared/core';
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
      [title]="onboardingTitle"
      [message]="onboardingMessage"
      (completed)="onOnboardingCompleted($event)"
      (dismissed)="onOnboardingDismissed()"
    ></app-profile-onboarding-popup>
  `
})
export class EntryPageComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly usersService = inject(UsersService);
  private readonly onboardingService = inject(ProfileOnboardingService);
  private readonly ngZone = inject(NgZone);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  protected readonly sessionService = inject(SessionService);
  protected isMobileView = typeof window !== 'undefined' ? window.innerWidth <= 760 : false;
  protected onboardingOpen = false;
  protected onboardingUser: UserDto | null = null;
  protected onboardingTitle = 'Profile setup';
  protected onboardingMessage = '';
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
      }
    } catch {
      selection.fail();
    }
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
          title: 'Please register',
          message: 'Complete your profile to finish registration.'
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
            title: 'Please register',
            message: 'Complete your profile to finish registration.'
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
      this.onboardingTitle = 'Profile setup';
      this.onboardingMessage = '';
      this.pendingRedirectAfterOnboarding = '';
      this.pendingDemoSessionUserId = '';
      this.changeDetectorRef.detectChanges();
    });
  }

  private openOnboardingGate(
    user: UserDto,
    redirectUrl: string,
    copy: { title: string; message?: string } = { title: 'Profile setup' }
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
}
