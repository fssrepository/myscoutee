import {
  NgComponentOutlet
} from '@angular/common';
import {
  Component,
  OnInit,
  inject
} from '@angular/core';
import {
  ActivatedRoute,
  Router
} from '@angular/router';

import {
  AssetDefaultsBuilder
} from '../../../shared/core/base/builders/asset-defaults.builder';
import {
  AdminWorkspaceDataService
} from '../../../shared/core/base/services/admin-workspace-data.service';
import {
  EventsService
} from '../../../shared/core/base/services/events.service';
import {
  SessionService
} from '../../../shared/core/base/services/session.service';
import type { AssetDTO } from '../../../shared/core/contracts/asset.interface';
import type { ShareTokenResolvedItem } from '../../../shared/core/contracts/share.interface';
import * as AppConstants from '../../../shared/core/common/constants';
import type { AssetType } from '../../../shared/core/common/constants';
import { DemoBootstrapSelectorStore } from '../../../shared/ui/context/stores/demo-bootstrap-selector.store';
import { MemberMenuStore } from '../../../shared/ui/context/stores/member-menu.store';

@Component({
  selector: 'app-admin-help-session-page',
  standalone: true,
  imports: [NgComponentOutlet],
  templateUrl: './admin-help-session-page.component.html',
  styleUrl: './admin-help-session-page.component.scss'
})
export class AdminHelpSessionPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  private readonly workspaceData = inject(AdminWorkspaceDataService);
  private readonly eventsService = inject(EventsService);
  private readonly demoBootstrapSelectorStore = inject(DemoBootstrapSelectorStore);
  private readonly memberMenuStore = inject(MemberMenuStore);
  protected error = '';
  protected readonly demoBootstrapSelector = this.demoBootstrapSelectorStore.demoBootstrapSelector;
  protected readonly demoBootstrapSelectorComponent = this.demoBootstrapSelectorStore.demoBootstrapSelectorComponent;

  async ngOnInit(): Promise<void> {
    await this.openSharedUserView();
  }

  protected async retry(): Promise<void> {
    this.error = '';
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
    this.openSharedUserSelector(userId, targetUrl);
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
    return await this.workspaceData.resolveAdminHelpToken(token, value => this.resolveDemoAdminHelpToken(value));
  }

  private openSharedUserSelector(userId: string, targetUrl: string): void {
    this.demoBootstrapSelectorStore.openDemoBootstrapSelector({
      mode: 'member',
      title: 'Demo felhasználó választása',
      subtitle: 'Bejelentkezés nélküli mód. Válassz demo felhasználót a nézőpont szerinti adatok megnyitásához.',
      autoSelectUserId: userId,
      onSelect: selectedUserId => this.openSelectedSharedUser(selectedUserId, targetUrl),
      onClose: () => {
        void this.goAdmin();
      }
    });
  }

  private openSelectedSharedUser(userId: string, targetUrl: string): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || !this.sessionService.startDemoSession(normalizedUserId, {
      supportContext: {
        kind: 'admin-support',
        targetUrl: this.safeTargetUrl(targetUrl)
      }
    })) {
      return false;
    }
    void this.navigateToSharedTargetAfterSelectorClose(normalizedUserId, targetUrl);
    return true;
  }

  private async navigateToSharedTargetAfterSelectorClose(userId: string, targetUrl: string): Promise<void> {
    await this.waitForDemoSelectorClose();
    await this.router.navigateByUrl(await this.queueSharedSupportTarget(userId, targetUrl), { replaceUrl: true });
  }

  private fail(message: string): void {
    this.demoBootstrapSelectorStore.closeDemoBootstrapSelector();
    this.error = message;
  }

  private waitForDemoSelectorClose(): Promise<void> {
    return new Promise(resolve => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
        return;
      }
      setTimeout(resolve, 0);
    });
  }

  private resolveDemoAdminHelpToken(token: string): ShareTokenResolvedItem | null {
    const reportToken = this.resolveDemoAdminReportToken(token);
    if (reportToken) {
      return reportToken;
    }
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

  private resolveDemoAdminReportToken(token: string): ShareTokenResolvedItem | null {
    const prefix = 'myscoutee:token:admin-report:';
    if (!token.startsWith(prefix)) {
      return null;
    }
    const payload = token.slice(prefix.length);
    const [ownerUserId, encodedTarget] = payload.split(':');
    const targetUrl = this.decodeDemoTokenPayload(encodedTarget);
    if (!ownerUserId?.trim() || !targetUrl) {
      return null;
    }
    return {
      kind: 'adminHelp',
      entityId: targetUrl,
      ownerUserId: ownerUserId.trim(),
      title: 'Shared report context',
      subtitle: 'MyScoutee support session',
      description: 'MyScoutee admin opened a report context as the reporting user sees it.',
      imageUrl: null,
      url: targetUrl
    };
  }

  private decodeDemoTokenPayload(value: string | undefined): string {
    const normalized = `${value ?? ''}`.trim();
    if (!normalized) {
      return '';
    }
    try {
      const padded = normalized.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      return '';
    }
  }

  private parseDemoAdminHelpPayload(payload: string): { ownerUserId: string; targetKey: string } | null {
    const targetKeys = ['service-chat', 'events', 'asset-supplies', 'asset-transport'];
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
      case 'asset-transport':
        return '/game?supportTarget=asset&assetFilter=Transport';
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
    if (supportTarget === 'service-chat' || supportTarget === 'chats' || supportTarget === 'chat-message') {
      this.memberMenuStore.openNavigatorActivitiesRequest('chats');
    } else if (supportTarget === 'member') {
      const ownerId = `${parsed.searchParams.get('ownerId') ?? ''}`.trim();
      if (ownerId) {
        this.memberMenuStore.requestActivitiesNavigation({
          type: 'members',
          ownerId,
          ownerType: 'event',
          viewOnly: true,
          canManage: false,
          subtitle: 'Reported member context'
        });
      } else {
        this.memberMenuStore.openNavigatorActivitiesRequest('events');
      }
    } else if (supportTarget === 'event') {
      const eventId = `${parsed.searchParams.get('eventId') ?? ''}`.trim();
      const eventRecord = eventId ? await this.eventsService.queryKnownRecordById(userId, eventId) : null;
      if (eventRecord) {
        this.memberMenuStore.requestActivitiesNavigation({
          type: 'eventEditor',
          eventId: eventRecord.id,
          target: eventRecord.type === 'hosting' || eventRecord.creatorUserId === userId ? 'hosting' : 'events',
          readOnly: true
        });
      } else {
        this.memberMenuStore.openNavigatorActivitiesRequest('events');
      }
    } else if (supportTarget === 'events') {
      this.memberMenuStore.openNavigatorActivitiesRequest('events');
    } else if (supportTarget === 'rates') {
      this.memberMenuStore.openNavigatorActivitiesRequest('rates');
    } else if (supportTarget === 'asset') {
      const assetFilter = this.toAssetFilter(parsed.searchParams.get('assetFilter'));
      if (assetFilter) {
        const assetId = `${parsed.searchParams.get('assetId') ?? ''}`.trim();
        this.memberMenuStore.requestActivitiesNavigation({
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

  private buildSupportFallbackAsset(assetType: AssetType, parsed: URL): AssetDTO | undefined {
    const assetId = `${parsed.searchParams.get('assetId') ?? ''}`.trim();
    if (!assetId) {
      return undefined;
    }
    const title = `${parsed.searchParams.get('assetTitle') ?? ''}`.trim() || 'Shared asset';
    const subtitle = `${parsed.searchParams.get('assetSubtitle') ?? ''}`.trim();
    const city = `${parsed.searchParams.get('assetCity') ?? ''}`.trim();
    const details = `${parsed.searchParams.get('assetDetails') ?? ''}`.trim();
    const category = AssetDefaultsBuilder.normalizeCategory(
      assetType,
      `${parsed.searchParams.get('assetCategory') ?? ''}`.trim()
    );
    const imageUrl = this.safeImageUrl(parsed.searchParams.get('assetPreview'))
      || this.defaultSupportAssetImage(assetType, assetId || title);
    return {
      id: assetId,
      type: assetType,
      title,
      subtitle,
      category,
      city: city || this.defaultSupportAssetCity(assetType),
      capacityTotal: this.positiveIntegerParam(parsed, 'assetCapacity') || (assetType === AppConstants.ASSET_TYPE_SUPPLIES ? 4 : 1),
      quantity: this.positiveIntegerParam(parsed, 'assetQuantity') || (assetType === AppConstants.ASSET_TYPE_SUPPLIES ? 4 : 1),
      description: details || subtitle || title,
      imageUrl,
      visibility: 'Public',
      ownerUserId: '',
      requests: []
    };
  }

  private positiveIntegerParam(parsed: URL, key: string): number {
    return Math.max(0, Math.trunc(Number(parsed.searchParams.get(key)) || 0));
  }

  private defaultSupportAssetCity(assetType: AssetType): string {
    return assetType === AppConstants.ASSET_TYPE_SUPPLIES ? 'Austin' : '';
  }

  private defaultSupportAssetImage(assetType: AssetType, seed: string): string {
    const flavor = assetType === AppConstants.ASSET_TYPE_TRANSPORT
      ? 'transport'
      : assetType === AppConstants.ASSET_TYPE_ACCOMMODATION
        ? 'property'
        : 'gear';
    const normalizedSeed = encodeURIComponent(`${assetType.toLowerCase()}-${flavor}-${seed || assetType.toLowerCase()}`);
    return `https://picsum.photos/seed/${normalizedSeed}/1200/700`;
  }

  private safeImageUrl(value: string | null): string {
    const normalized = `${value ?? ''}`.trim();
    if (!normalized) {
      return '';
    }
    return normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('/')
      ? normalized
      : '';
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

  private toAssetFilter(value: string | null): AssetType | null {
    switch (`${value ?? ''}`.trim()) {
      case AppConstants.ASSET_TYPE_TRANSPORT:
        return AppConstants.ASSET_TYPE_TRANSPORT;
      case AppConstants.ASSET_TYPE_ACCOMMODATION:
        return AppConstants.ASSET_TYPE_ACCOMMODATION;
      case AppConstants.ASSET_TYPE_SUPPLIES:
        return AppConstants.ASSET_TYPE_SUPPLIES;
      default:
        return null;
    }
  }
}
