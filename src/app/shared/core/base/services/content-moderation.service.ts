import { LocalAdminNotificationsService } from '../../local/source/services/admin-notifications.service';
import { RouteIntervalSchedulerService } from './route-interval-scheduler.service';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from './base-route-mode.service';
import { HttpContentModerationService } from '../../http/services/content-moderation.service';
import { LocalContentModerationService } from '../../local/source/services/content-moderation.service';
import type { ContentModerationDecision, ContentModerationSettings, ModerationCategoryFilter, ModerationStatus } from '../../contracts/content-moderation.interface';
import type { AdminUserDto } from '../../contracts/admin.interface';
import type { ListQuery } from '../../contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class ContentModerationService extends BaseRouteModeService {
  private readonly jobs = inject(LocalAdminNotificationsService);
  private readonly scheduler = inject(RouteIntervalSchedulerService);
  private stopWorker?: () => void;
  constructor() { super(); inject(DestroyRef).onDestroy(() => this.stopWorker?.()); }
  setWorkerActive(active: boolean): void {
    const local = active && this.isLocalRouteEnabled('/admin/content-moderation');
    if (!local) { this.stopWorker?.(); this.stopWorker = undefined; return; }
    if (!this.stopWorker) this.stopWorker = this.scheduler.startInterval('/admin/content-moderation',
      () => this.jobs.runContentApprovalTick().catch(() => {}), { fallbackIntervalMs: 60000 });
  }
  private readonly http = inject(HttpContentModerationService);
  private readonly local = inject(LocalContentModerationService);
  private source(groupId?: string | null) { return this.resolveRouteService(groupId ? '/groups' : '/admin/content-moderation', this.local, this.http); }
  snapshot(adminUserId: string, groupId?: string | null) { return this.source(groupId).snapshot(adminUserId, groupId); }
  page(adminUserId: string, category: ModerationCategoryFilter, status: ModerationStatus, query: ListQuery, groupId?: string | null) { return this.source(groupId).page(adminUserId, category, status, query, groupId); }
  settings(adminUserId: string, revision: number, settings: ContentModerationSettings, groupId?: string | null) { return this.source(groupId).settings(adminUserId, revision, settings, groupId); }
  decide(id: string, request: ContentModerationDecision, admin?: AdminUserDto, groupId?: string | null) {
    const source = this.source(groupId); return source instanceof LocalContentModerationService ? source.decide(id, request, admin, groupId) : source.decide(id, request, groupId);
  }
  detail<T>(adminUserId: string, id: string, groupId?: string | null) { return this.source(groupId).detail<T>(adminUserId, id, groupId); }
}
