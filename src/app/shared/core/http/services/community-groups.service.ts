import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { ICommunityGroupsService, GroupSyncRequest, GroupSyncResponse, CommunityGroup, CommunityGroupSummary, SaveCommunityGroup, GroupFilters, GroupCounters, GroupWorkspace, GroupWorkspaceSelection } from '../../contracts/community-group.interface';
import type { ListQuery, PageResult } from '../../contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class HttpCommunityGroupsService implements ICommunityGroupsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl ?? '/api'}/groups`;
  async sync(userId: string, request: GroupSyncRequest, signal?: AbortSignal): Promise<GroupSyncResponse> {
    signal?.throwIfAborted();
    const result = await firstValueFrom(this.http.post<GroupSyncResponse>(`${this.url}/sync`, { ...request, userId }));
    signal?.throwIfAborted(); return result;
  }
  workspaces(userId: string): Promise<GroupWorkspace[]> {
    return firstValueFrom(this.http.get<GroupWorkspace[]>(`${this.url}/workspaces`, { params: { userId } }));
  }
  selectWorkspace(userId: string, groupId: string | null): Promise<GroupWorkspaceSelection> {
    return firstValueFrom(this.http.post<GroupWorkspaceSelection>(`${this.url}/workspaces/select`, { userId, groupId }));
  }
  async page(userId: string, query: ListQuery<GroupFilters>, signal?: AbortSignal): Promise<PageResult<CommunityGroupSummary, GroupCounters>> {
    signal?.throwIfAborted();
    const page = await firstValueFrom(this.http.get<PageResult<CommunityGroupSummary, GroupCounters>>(this.url, { params: {
      userId, bucket: query.filters?.bucket ?? 'explore', category: query.filters?.category ?? '',
      pageSize: query.pageSize, ...(query.cursor ? { cursor: query.cursor } : {})
    } }));
    signal?.throwIfAborted(); return page;
  }
  async detail(userId: string, id: string, signal?: AbortSignal): Promise<CommunityGroup> {
    signal?.throwIfAborted();
    const group = await firstValueFrom(this.http.get<CommunityGroup>(`${this.url}/${encodeURIComponent(id)}`, { params: { userId } }));
    signal?.throwIfAborted(); return group;
  }
  save(request: SaveCommunityGroup): Promise<CommunityGroup> { return firstValueFrom(this.http.post<CommunityGroup>(this.url, request)); }
  join(userId: string, groupId: string): Promise<CommunityGroup> {
    return firstValueFrom(this.http.post<CommunityGroup>(`${this.url}/join`, { userId, groupId }));
  }
  report(userId: string, groupId: string, details: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.url}/report`, { userId, groupId, details }));
  }
}
