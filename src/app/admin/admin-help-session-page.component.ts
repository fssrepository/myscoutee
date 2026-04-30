import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { environment } from '../../environments/environment';
import { SessionService, ShareTokensService, UsersService, type DemoUserListItemDto, type ShareTokenResolvedItem } from '../shared/core';
import {
  type DemoBootstrapProgressStage,
  type DemoBootstrapProgressState
} from '../shared/core/demo';
import { EntryDemoUserSelectorComponent } from '../entry/components/entry-demo-user-selector/entry-demo-user-selector.component';

@Component({
  selector: 'app-admin-help-session-page',
  standalone: true,
  imports: [CommonModule, EntryDemoUserSelectorComponent],
  template: `
    <section class="admin-help-session"></section>
    <app-entry-demo-user-selector
      [open]="selectorOpen"
      [title]="'Opening shared user'"
      [subtitle]="'Support selected the user from the service chat. Preparing the same app view now.'"
      [loading]="selectorLoading"
      [loadingProgress]="selectorLoadingProgress"
      [loadingLabel]="selectorLoadingLabel"
      [loadingStage]="selectorLoadingStage"
      [errorMessage]="error"
      [submitting]="selectorSubmitting"
      [users]="selectorUsers"
      (closeRequested)="goAdmin()"
      (retryRequested)="retry()"
    ></app-entry-demo-user-selector>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #eef3fb;
      color: #132642;
      font-family: Arial, sans-serif;
    }

    .admin-help-session {
      min-height: 100vh;
    }
  `]
})
export class AdminHelpSessionPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  private readonly shareTokens = inject(ShareTokensService);
  private readonly usersService = inject(UsersService);

  protected selectorOpen = true;
  protected selectorLoading = true;
  protected selectorSubmitting = true;
  protected selectorLoadingProgress = 0;
  protected selectorLoadingLabel = 'Opening shared support session';
  protected selectorLoadingStage: DemoBootstrapProgressStage = 'session';
  protected selectorUsers: DemoUserListItemDto[] = [];
  protected error = '';

  async ngOnInit(): Promise<void> {
    await this.openSharedUserView();
  }

  protected async retry(): Promise<void> {
    this.error = '';
    this.selectorLoading = true;
    this.selectorSubmitting = true;
    this.selectorLoadingProgress = 0;
    this.selectorLoadingStage = 'session';
    this.selectorLoadingLabel = 'Opening shared support session';
    this.selectorUsers = [];
    await this.openSharedUserView();
  }

  protected async goAdmin(): Promise<void> {
    await this.router.navigateByUrl('/admin', { replaceUrl: true });
  }

  private async openSharedUserView(): Promise<void> {
    const token = this.resolveTokenFromRoute();
    if (!token) {
      this.fail('This support link is missing its token.');
      return;
    }
    const resolved = await this.resolveAdminHelpToken(token);
    if (!resolved || resolved.kind !== 'adminHelp' || !resolved.ownerUserId?.trim()) {
      this.fail('This support link expired or is no longer available.');
      return;
    }
    const userId = resolved.ownerUserId.trim();
    const targetUrl = this.safeTargetUrl(resolved.url || resolved.entityId || '/game');
    if (environment.activitiesDataSource !== 'http' || !environment.loginEnabled) {
      const userAvailable = await this.prepareDemoSelectorForAutoSelectedUser(userId);
      if (!userAvailable) {
        this.fail('This shared support user is not available in the demo selector.');
        return;
      }
      this.selectorSubmitting = true;
      this.selectorLoading = true;
      this.selectorLoadingProgress = 0;
      this.selectorLoadingStage = 'session';
      this.selectorLoadingLabel = 'Preparing demo session';
      await this.usersService.prepareDemoUserSession(userId, state => this.applyProgress(state));
      this.selectorLoadingProgress = 100;
      this.selectorLoadingStage = 'sessionReady';
      this.selectorLoadingLabel = 'Demo session ready';
      await this.waitForLoaderCompletionBeat();
      this.sessionService.startDemoSession(userId);
      await this.router.navigateByUrl(targetUrl);
      return;
    }
    this.selectorLoadingProgress = 100;
    this.selectorLoadingStage = 'sessionReady';
    this.selectorLoadingLabel = 'Opening MyScoutee as the user sees it';
    await this.router.navigateByUrl(targetUrl, { replaceUrl: true });
  }

  private resolveTokenFromRoute(): string {
    const rawToken = `${this.route.snapshot.paramMap.get('token') ?? ''}`.trim();
    try {
      return decodeURIComponent(rawToken);
    } catch {
      return rawToken;
    }
  }

  private safeTargetUrl(value: string): string {
    const normalized = `${value ?? ''}`.trim();
    if (!normalized || normalized.startsWith('http:') || normalized.startsWith('https:') || normalized.startsWith('//')) {
      return '/game';
    }
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }

  private async resolveAdminHelpToken(token: string): Promise<ShareTokenResolvedItem | null> {
    if (!environment.loginEnabled) {
      const demoResolved = this.resolveDemoAdminHelpToken(token);
      if (demoResolved) {
        return demoResolved;
      }
    }
    try {
      const resolved = await Promise.race([
        this.shareTokens.resolveToken(token, ''),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 1200))
      ]);
      if (resolved) {
        return resolved;
      }
    } catch {
      // Fall through to the demo-token fallback below.
    }
    if (!environment.loginEnabled) {
      return this.resolveDemoAdminHelpToken(token);
    }
    return null;
  }

  private applyProgress(state: DemoBootstrapProgressState): void {
    this.selectorLoadingProgress = state.percent;
    this.selectorLoadingLabel = state.label;
    this.selectorLoadingStage = state.stage;
  }

  private async prepareDemoSelectorForAutoSelectedUser(userId: string): Promise<boolean> {
    this.selectorSubmitting = false;
    this.selectorLoading = true;
    this.selectorLoadingProgress = 0;
    this.selectorLoadingStage = 'selector';
    this.selectorLoadingLabel = 'Preparing demo data';
    await this.waitForPopupPaint();

    const users = await this.usersService.loadAvailableDemoUsers(undefined, state => this.applyProgress(state));
    this.selectorUsers = users;
    this.selectorLoading = false;
    this.selectorLoadingProgress = 100;
    this.selectorLoadingStage = 'ready';
    this.selectorLoadingLabel = 'Demo data ready';
    await this.waitForPopupPaint();

    return users.some(user => user.id.trim() === userId);
  }

  private fail(message: string): void {
    this.error = message;
    this.selectorLoading = false;
    this.selectorSubmitting = false;
    this.selectorLoadingProgress = 0;
    this.selectorLoadingStage = 'selector';
    this.selectorLoadingLabel = 'Support link unavailable';
    this.selectorUsers = [];
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

  private resolveDemoAdminHelpToken(token: string): ShareTokenResolvedItem | null {
    const prefix = 'myscoutee:token:admin-help-';
    if (!token.startsWith(prefix)) {
      return null;
    }
    const payload = token.slice(prefix.length);
    const ownerUserId = payload.includes('-u')
      ? `u${payload.split('-u').pop() ?? ''}`.trim()
      : payload.split('-').pop()?.trim() ?? '';
    if (!ownerUserId) {
      return null;
    }
    return {
      kind: 'adminHelp',
      entityId: '/game',
      ownerUserId,
      title: 'Shared help view',
      subtitle: 'MyScoutee support session',
      description: 'The user allowed MyScoutee admin to open their current app view.',
      imageUrl: null,
      url: '/game'
    };
  }
}
