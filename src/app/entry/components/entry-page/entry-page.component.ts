import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { SessionService } from '../../../shared/core';
import { EntryShellComponent } from '../entry-shell/entry-shell.component';

@Component({
  selector: 'app-entry-page',
  standalone: true,
  imports: [EntryShellComponent],
  template: `
    <app-entry-shell
      [authMode]="sessionService.authMode"
      [firebaseAuthProfile]="sessionService.firebaseProfile()"
      [firebaseAuthIsBusy]="sessionService.firebaseBusy()"
      [isMobileView]="isMobileView"
      (demoUserSelected)="onDemoUserSelected($event)"
      (firebaseAuthRequested)="onFirebaseAuthRequested()"
      (firebaseSessionContinueRequested)="onFirebaseSessionContinueRequested()"
    ></app-entry-shell>
  `
})
export class EntryPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly sessionService = inject(SessionService);
  protected isMobileView = typeof window !== 'undefined' ? window.innerWidth <= 760 : false;

  protected async onDemoUserSelected(userId: string): Promise<void> {
    const session = this.sessionService.startDemoSession(userId);
    if (!session) {
      return;
    }
    await this.router.navigateByUrl(this.redirectUrl());
  }

  protected async onFirebaseAuthRequested(): Promise<void> {
    const session = await this.sessionService.startFirebaseSession();
    if (!session) {
      return;
    }
    await this.router.navigateByUrl(this.redirectUrl());
  }

  protected async onFirebaseSessionContinueRequested(): Promise<void> {
    const session = await this.sessionService.restoreFirebaseSession();
    if (!session) {
      return;
    }
    await this.router.navigateByUrl(this.redirectUrl());
  }

  private redirectUrl(): string {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    if (redirect && redirect.startsWith('/')) {
      return redirect;
    }
    return '/game';
  }
}
