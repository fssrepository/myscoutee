import { HTTP_ADAPTER, LOCAL_ADAPTER } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from '../platform/base-route-mode.service';

import type { ICommunityAnnouncementsService, AnnouncementFilters, SaveAnnouncement, AnnouncementCommand } from '../../../contracts/community/community-announcement.interface';
import type { ListQuery } from '@fssrepository/myscoutee-components';
@Injectable({ providedIn: 'root' })
export class CommunityAnnouncementsService extends BaseRouteModeService implements ICommunityAnnouncementsService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly local = this.transportAdapters.reference(LOCAL_ADAPTER.COMMUNITY_ANNOUNCEMENTS);
  private readonly http = this.transportAdapters.reference(HTTP_ADAPTER.COMMUNITY_ANNOUNCEMENTS);
  private get adapter(): ICommunityAnnouncementsService { return this.resolveRouteService('/community-announcements', this.local, this.http); }
  page(userId: string, query: ListQuery<AnnouncementFilters>, signal?: AbortSignal) { return this.adapter.page(userId, query, signal); }
  detail(userId: string, id: string, signal?: AbortSignal) { return this.adapter.detail(userId, id, signal); }
  save(request: SaveAnnouncement) { return this.adapter.save(request); }
  action(id: string, request: AnnouncementCommand) { return this.adapter.action(id, request); }
}
