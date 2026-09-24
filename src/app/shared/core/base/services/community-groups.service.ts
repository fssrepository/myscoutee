import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from './base-route-mode.service';
import { LocalCommunityGroupsService } from '../../local/source/services/community-groups.service';
import { HttpCommunityGroupsService } from '../../http/services/community-groups.service';
import type { ICommunityGroupsService, SaveCommunityGroup, GroupFilters, GroupSyncRequest } from '../../contracts/community-group.interface';
import type { ListQuery } from '../../contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class CommunityGroupsService extends BaseRouteModeService implements ICommunityGroupsService {
  private readonly local = inject(LocalCommunityGroupsService);
  private readonly http = inject(HttpCommunityGroupsService);
  private get adapter(): ICommunityGroupsService { return this.resolveRouteService('/groups', this.local, this.http); }
  sync(userId: string, request: GroupSyncRequest, signal?: AbortSignal) { return this.adapter.sync(userId, request, signal); }
  workspaces(userId: string) { return this.adapter.workspaces(userId); }
  page(userId: string, query: ListQuery<GroupFilters>, signal?: AbortSignal) { return this.adapter.page(userId, query, signal); }
  detail(userId: string, id: string, signal?: AbortSignal) { return this.adapter.detail(userId, id, signal); }
  save(request: SaveCommunityGroup) { return this.adapter.save(request); }
  join(userId: string, groupId: string) { return this.adapter.join(userId, groupId); }
  report(userId: string, groupId: string, details: string) { return this.adapter.report(userId, groupId, details); }
}
