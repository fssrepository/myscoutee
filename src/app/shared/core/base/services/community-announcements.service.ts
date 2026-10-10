import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from './base-route-mode.service';
import { LocalCommunityAnnouncementsService } from '../../local/source/services/community-announcements.service';
import { HttpCommunityAnnouncementsService } from '../../http/services/community-announcements.service';
import type { ICommunityAnnouncementsService, AnnouncementFilters, SaveAnnouncement, AnnouncementCommand } from '../../contracts/community-announcement.interface';
import type { ListQuery } from '@myscoutee/components';
@Injectable({ providedIn: 'root' })
export class CommunityAnnouncementsService extends BaseRouteModeService implements ICommunityAnnouncementsService {
  private readonly local = inject(LocalCommunityAnnouncementsService);
  private readonly http = inject(HttpCommunityAnnouncementsService);
  private get adapter(): ICommunityAnnouncementsService { return this.resolveRouteService('/community-announcements', this.local, this.http); }
  page(userId: string, query: ListQuery<AnnouncementFilters>, signal?: AbortSignal) { return this.adapter.page(userId, query, signal); }
  detail(userId: string, id: string, signal?: AbortSignal) { return this.adapter.detail(userId, id, signal); }
  save(request: SaveAnnouncement) { return this.adapter.save(request); }
  action(id: string, request: AnnouncementCommand) { return this.adapter.action(id, request); }
}
