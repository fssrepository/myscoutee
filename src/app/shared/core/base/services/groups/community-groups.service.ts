import { HTTP_ADAPTER, LOCAL_ADAPTER } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from '../platform/base-route-mode.service';

import type { ICommunityGroupsService, SaveCommunityGroup, GroupFilters, GroupSyncRequest } from '../../../contracts/groups/community-group.interface';
import type { ListQuery } from '@fssrepository/myscoutee-components';
@Injectable({ providedIn: 'root' })
export class CommunityGroupsService extends BaseRouteModeService implements ICommunityGroupsService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly local = this.transportAdapters.reference(LOCAL_ADAPTER.COMMUNITY_GROUPS);
  private readonly http = this.transportAdapters.reference(HTTP_ADAPTER.COMMUNITY_GROUPS);
  private get adapter(): ICommunityGroupsService { return this.resolveRouteService('/groups', this.local, this.http); }
  sync(userId: string, request: GroupSyncRequest, signal?: AbortSignal) { return this.adapter.sync(userId, request, signal); }
  workspaces(userId: string) { return this.adapter.workspaces(userId); }
  page(userId: string, query: ListQuery<GroupFilters>, signal?: AbortSignal) { return this.adapter.page(userId, query, signal); }
  detail(userId: string, id: string, signal?: AbortSignal) { return this.adapter.detail(userId, id, signal); }
  save(request: SaveCommunityGroup) { return this.adapter.save(request); }
  join(userId: string, groupId: string) { return this.adapter.join(userId, groupId); }
  report(userId: string, groupId: string, details: string) { return this.adapter.report(userId, groupId, details); }
}
