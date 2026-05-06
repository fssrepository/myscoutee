import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { ProfileOnboardingService, SessionService, UsersService, type AppSession, type UserDto } from '../../../shared/core';
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
      [isMobileView]="isMobileView"
      (demoUserSelected)="onDemoUserSelected($event)"
      (firebaseAuthRequested)="onFirebaseAuthRequested()"
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

  protected async onFirebaseAuthRequested(): Promise<void> {
    const session = await this.sessionService.startFirebaseSession();
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
    let user: UserDto | null = null;
    try {
      user = await this.usersService.loadUserById(session.kind === 'demo' ? session.userId : undefined, 8000);
    } catch {
      user = null;
    }
    if (gateToken !== this.postSessionGateToken) {
      return;
    }
    if (!user) {
      await this.router.navigateByUrl(redirectUrl);
      return;
    }
    if (!this.onboardingService.shouldPrompt(user)) {
      await this.router.navigateByUrl(redirectUrl);
      return;
    }
    this.pendingRedirectAfterOnboarding = redirectUrl;
    this.onboardingUser = user;
    this.onboardingOpen = true;
  }
}
