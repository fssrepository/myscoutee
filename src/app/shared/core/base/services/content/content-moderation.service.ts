import { HTTP_ADAPTER, LOCAL_ADAPTER } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';

import { RouteIntervalSchedulerService } from '../platform/route-interval-scheduler.service';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from '../platform/base-route-mode.service';

import type { ContentModerationDecision, ContentModerationSettings, ModerationCategoryFilter, ModerationStatus } from '../../../contracts/content/content-moderation.interface';
import type { AdminUserDto } from '../../../contracts/administration/admin.interface';
import type { ListQuery } from '@fssrepository/myscoutee-components';
@Injectable({ providedIn: 'root' })
export class ContentModerationService extends BaseRouteModeService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly jobs = this.transportAdapters.reference(LOCAL_ADAPTER.ADMIN_NOTIFICATIONS);
  private readonly scheduler = inject(RouteIntervalSchedulerService);
  private stopWorker?: () => void;
  constructor() { super(); inject(DestroyRef).onDestroy(() => this.stopWorker?.()); }
  setWorkerActive(active: boolean): void {
    const local = active && this.isLocalRouteEnabled('/admin/content-moderation');
    if (!local) { this.stopWorker?.(); this.stopWorker = undefined; return; }
    if (!this.stopWorker) this.stopWorker = this.scheduler.startInterval('/admin/content-moderation',
      () => this.jobs.runContentApprovalTick().catch(() => {}), { fallbackIntervalMs: 60000 });
  }
  private readonly http = this.transportAdapters.reference(HTTP_ADAPTER.CONTENT_MODERATION);
  private readonly local = this.transportAdapters.reference(LOCAL_ADAPTER.CONTENT_MODERATION);
  private source(groupId?: string | null) { return this.resolveRouteService(groupId ? '/groups' : '/admin/content-moderation', this.local, this.http); }
  snapshot(adminUserId: string, groupId?: string | null) { return this.source(groupId).snapshot(adminUserId, groupId); }
  page(adminUserId: string, category: ModerationCategoryFilter, status: ModerationStatus, query: ListQuery, groupId?: string | null) { return this.source(groupId).page(adminUserId, category, status, query, groupId); }
  settings(adminUserId: string, revision: number, settings: ContentModerationSettings, groupId?: string | null) { return this.source(groupId).settings(adminUserId, revision, settings, groupId); }
  decide(id: string, request: ContentModerationDecision, admin?: AdminUserDto, groupId?: string | null) {
    const source = this.source(groupId); return source === this.local ? this.local.decide(id, request, admin, groupId) : this.http.decide(id, request, groupId);
  }
  detail<T>(adminUserId: string, id: string, groupId?: string | null) { return this.source(groupId).detail<T>(adminUserId, id, groupId); }
}
