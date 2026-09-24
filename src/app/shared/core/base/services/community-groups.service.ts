import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from './base-route-mode.service';
import { LocalCommunityGroupsService } from '../../local/source/services/community-groups.service';
import { HttpCommunityGroupsService } from '../../http/services/community-groups.service';
import type { ICommunityGroupsService, SaveCommunityGroup, GroupFilters } from '../../contracts/community-group.interface';
import type { ListQuery } from '../../contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class CommunityGroupsService extends BaseRouteModeService implements ICommunityGroupsService {
  private readonly local = inject(LocalCommunityGroupsService);
  private readonly http = inject(HttpCommunityGroupsService);
  private get adapter(): ICommunityGroupsService { return this.resolveRouteService('/groups', this.local, this.http); }
  page(userId: string, query: ListQuery<GroupFilters>, signal?: AbortSignal) { return this.adapter.page(userId, query, signal); }
  detail(userId: string, id: string) { return this.adapter.detail(userId, id); }
  save(request: SaveCommunityGroup) { return this.adapter.save(request); }
  join(userId: string, groupId: string) { return this.adapter.join(userId, groupId); }
}
