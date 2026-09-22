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
  private get source() { return this.resolveRouteService('/admin/content-moderation', this.local, this.http); }
  snapshot(adminUserId: string) { return this.source.snapshot(adminUserId); }
  page(adminUserId: string, category: ModerationCategoryFilter, status: ModerationStatus, query: ListQuery) { return this.source.page(adminUserId, category, status, query); }
  settings(adminUserId: string, revision: number, settings: ContentModerationSettings) { return this.source.settings(adminUserId, revision, settings); }
  decide(id: string, request: ContentModerationDecision, admin?: AdminUserDto) {
    const source = this.source; return source instanceof LocalContentModerationService ? source.decide(id, request, admin) : source.decide(id, request);
  }
  detail<T>(adminUserId: string, id: string) { return this.source.detail<T>(adminUserId, id); }
}
