import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { environment } from '../../environments/environment';
import {
  AppPopupContext,
  EventsService,
  SessionService,
  ShareTokensService,
  UsersService,
  type DemoUserListItemDto,
  type ShareTokenResolvedItem
} from '../shared/core';
import type { AssetCard } from '../shared/core/base/models';
import { toActivityEventRow } from '../shared/core/base/converters/activities-event.converter';
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
      [selectedUserId]="selectorSelectedUserId"
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
  private readonly eventsService = inject(EventsService);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  protected selectorOpen = true;
  protected selectorLoading = true;
  protected selectorSubmitting = false;
  protected selectorLoadingProgress = 0;
  protected selectorLoadingLabel = 'Preparing demo data';
  protected selectorLoadingStage: DemoBootstrapProgressStage = 'selector';
  protected selectorUsers: DemoUserListItemDto[] = [];
  protected selectorSelectedUserId = '';
  protected error = '';

  async ngOnInit(): Promise<void> {
    await this.openSharedUserView();
  }

  protected async retry(): Promise<void> {
    this.error = '';
    this.selectorLoading = true;
    this.selectorSubmitting = false;
    this.selectorLoadingProgress = 0;
    this.selectorLoadingStage = 'selector';
    this.selectorLoadingLabel = 'Preparing demo data';
    this.selectorUsers = [];
    this.selectorSelectedUserId = '';
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
    const demoUsersPromise = environment.activitiesDataSource !== 'http' || !environment.loginEnabled
      ? this.prepareDemoSelectorUsers()
      : Promise.resolve<DemoUserListItemDto[]>([]);
    const resolved = await this.resolveAdminHelpToken(token);
    if (!resolved || resolved.kind !== 'adminHelp' || !resolved.ownerUserId?.trim()) {
      this.fail('This support link expired or is no longer available.');
      return;
    }
    const userId = resolved.ownerUserId.trim();
    const targetUrl = this.safeTargetUrl(resolved.url || resolved.entityId || '/game');
    if (environment.activitiesDataSource !== 'http' || !environment.loginEnabled) {
      this.selectorSelectedUserId = userId;
      const users = await demoUsersPromise;
      const selectedUser = users.find(user => user.id.trim() === userId) ?? null;
      if (!selectedUser) {
        this.fail('This shared support user is not available in the demo selector.');
        return;
      }
      await this.prepareAutoSelectedDemoUser(userId, targetUrl);
      return;
    }
    this.selectorLoadingProgress = 100;
    this.selectorLoadingStage = 'sessionReady';
    this.selectorLoadingLabel = 'Opening MyScoutee as the user sees it';
    await this.router.navigateByUrl(await this.queueSharedSupportTarget(userId, targetUrl), { replaceUrl: true });
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
    this.commitSelectorState(() => {
      this.selectorLoadingProgress = state.percent;
      this.selectorLoadingLabel = state.label;
      this.selectorLoadingStage = state.stage;
    });
  }

  private async prepareDemoSelectorUsers(): Promise<DemoUserListItemDto[]> {
    this.commitSelectorState(() => {
      this.selectorSubmitting = false;
      this.selectorLoading = true;
      this.selectorLoadingProgress = 0;
      this.selectorLoadingStage = 'selector';
      this.selectorLoadingLabel = 'Preparing demo data';
    });
    await this.waitForPopupPaint();

    const users = await this.usersService.loadAvailableDemoUsers(undefined, state => this.applyProgress(state));
    this.commitSelectorState(() => {
      this.selectorUsers = users;
      this.selectorLoadingProgress = 100;
      this.selectorLoadingStage = 'ready';
      this.selectorLoadingLabel = 'Demo data ready';
    });
    await this.waitForLoaderCompletionBeat();

    return users;
  }

  private async prepareAutoSelectedDemoUser(userId: string, targetUrl: string): Promise<void> {
    this.commitSelectorState(() => {
      this.selectorSubmitting = true;
      this.selectorLoading = true;
      this.selectorLoadingProgress = 0;
      this.selectorLoadingStage = 'session';
      this.selectorLoadingLabel = 'Preparing demo session';
    });
    await this.waitForPopupPaint();

    try {
      await this.usersService.prepareDemoUserSession(userId, state => this.applyProgress(state));
      this.commitSelectorState(() => {
        this.selectorLoadingProgress = 100;
        this.selectorLoadingStage = 'sessionReady';
        this.selectorLoadingLabel = 'Demo session ready';
      });
      await this.waitForLoaderCompletionBeat();
      this.sessionService.startDemoSession(userId);
      await this.router.navigateByUrl(await this.queueSharedSupportTarget(userId, targetUrl));
    } catch {
      this.commitSelectorState(() => {
        this.selectorLoading = false;
        this.selectorSubmitting = false;
        this.selectorLoadingProgress = 0;
        this.selectorLoadingStage = 'selector';
        this.selectorLoadingLabel = 'Preparing demo data';
      });
    }
  }

  private fail(message: string): void {
    this.error = message;
    this.selectorLoading = false;
    this.selectorSubmitting = false;
    this.selectorLoadingProgress = 0;
    this.selectorLoadingStage = 'selector';
    this.selectorLoadingLabel = 'Support link unavailable';
    this.selectorUsers = [];
    this.selectorSelectedUserId = '';
  }

  private commitSelectorState(update: () => void): void {
    this.ngZone.run(() => {
      update();
      this.changeDetectorRef.detectChanges();
    });
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
    const parsed = this.parseDemoAdminHelpPayload(payload);
    if (!parsed) {
      return null;
    }
    const targetUrl = this.demoHelpTargetUrl(parsed.targetKey);
    return {
      kind: 'adminHelp',
      entityId: targetUrl,
      ownerUserId: parsed.ownerUserId,
      title: 'Shared help view',
      subtitle: 'MyScoutee support session',
      description: 'The user allowed MyScoutee admin to open their current app view.',
      imageUrl: null,
      url: targetUrl
    };
  }

  private parseDemoAdminHelpPayload(payload: string): { ownerUserId: string; targetKey: string } | null {
    const targetKeys = ['service-chat', 'events', 'asset-supplies', 'asset-car'];
    const targetKey = targetKeys.find(key => payload.endsWith(`-${key}`)) ?? 'current';
    const userPayload = targetKey === 'current' ? payload : payload.slice(0, -(targetKey.length + 1));
    const ownerUserId = userPayload.split('-').pop()?.trim() ?? '';
    return ownerUserId ? { ownerUserId, targetKey } : null;
  }

  private demoHelpTargetUrl(targetKey: string): string {
    switch (targetKey) {
      case 'service-chat':
        return '/game?supportTarget=service-chat';
      case 'events':
        return '/game?supportTarget=event&eventId=e1';
      case 'asset-supplies':
        return '/game?supportTarget=asset&assetFilter=Supplies&assetId=asset-sup-2&assetTitle=Game%20Night%20Box&assetSubtitle=Board%20games%20%2B%20cards%20%2B%20speakers&assetCity=Austin&assetDetails=Board%20games%2C%20cards%2C%20and%20speakers%20ready%20for%20the%20venue.&assetPreview=https%3A%2F%2Fpicsum.photos%2Fseed%2Fsupplies-gear-asset-sup-2%2F1200%2F700';
      case 'asset-car':
        return '/game?supportTarget=asset&assetFilter=Car';
      default:
        return '/game';
    }
  }

  private async queueSharedSupportTarget(userId: string, targetUrl: string): Promise<string> {
    const normalized = this.safeTargetUrl(targetUrl);
    const parsed = this.parseRelativeUrl(normalized);
    if (!parsed) {
      return normalized;
    }
    const supportTarget = `${parsed.searchParams.get('supportTarget') ?? ''}`.trim();
    if (supportTarget === 'service-chat' || supportTarget === 'chats') {
      this.popupCtx.openNavigatorActivitiesRequest('chats');
    } else if (supportTarget === 'event') {
      const eventId = `${parsed.searchParams.get('eventId') ?? ''}`.trim();
      const eventRecord = eventId ? await this.eventsService.queryKnownItemById(userId, eventId) : null;
      if (eventRecord) {
        this.popupCtx.requestActivitiesNavigation({
          type: 'eventEditor',
          row: toActivityEventRow(eventRecord),
          readOnly: true
        });
      } else {
        this.popupCtx.openNavigatorActivitiesRequest('events');
      }
    } else if (supportTarget === 'events') {
      this.popupCtx.openNavigatorActivitiesRequest('events');
    } else if (supportTarget === 'rates') {
      this.popupCtx.openNavigatorActivitiesRequest('rates');
    } else if (supportTarget === 'asset') {
      const assetFilter = this.toAssetFilter(parsed.searchParams.get('assetFilter'));
      if (assetFilter) {
        const assetId = `${parsed.searchParams.get('assetId') ?? ''}`.trim();
        this.popupCtx.requestActivitiesNavigation({
          type: 'assetExplore',
          assetType: assetFilter,
          assetId: assetId || undefined,
          viewOnly: Boolean(assetId),
          fallbackAsset: this.buildSupportFallbackAsset(assetFilter, parsed)
        });
      }
    }
    return parsed.pathname || '/game';
  }

  private buildSupportFallbackAsset(assetType: 'Car' | 'Accommodation' | 'Supplies', parsed: URL): AssetCard | undefined {
    const assetId = `${parsed.searchParams.get('assetId') ?? ''}`.trim();
    if (!assetId) {
      return undefined;
    }
    const title = `${parsed.searchParams.get('assetTitle') ?? ''}`.trim() || 'Shared asset';
    const subtitle = `${parsed.searchParams.get('assetSubtitle') ?? ''}`.trim();
    const city = `${parsed.searchParams.get('assetCity') ?? ''}`.trim();
    return {
      id: assetId,
      type: assetType,
      title,
      subtitle,
      city,
      capacityTotal: 1,
      quantity: 1,
      details: `${parsed.searchParams.get('assetDetails') ?? ''}`.trim(),
      imageUrl: `${parsed.searchParams.get('assetPreview') ?? ''}`.trim(),
      sourceLink: '',
      routes: [],
      topics: [],
      policies: [],
      pricing: null,
      visibility: 'Public',
      ownerUserId: '',
      requests: []
    };
  }

  private parseRelativeUrl(value: string): URL | null {
    try {
      const origin = typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost';
      return new URL(value, origin);
    } catch {
      return null;
    }
  }

  private toAssetFilter(value: string | null): 'Car' | 'Accommodation' | 'Supplies' | null {
    switch (`${value ?? ''}`.trim()) {
      case 'Car':
        return 'Car';
      case 'Accommodation':
        return 'Accommodation';
      case 'Supplies':
        return 'Supplies';
      default:
        return null;
    }
  }
}
