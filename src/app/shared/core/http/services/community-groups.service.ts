import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { ICommunityGroupsService, CommunityGroup, SaveCommunityGroup, GroupFilters, GroupCounters, GroupWorkspace, GroupWorkspaceSelection } from '../../contracts/community-group.interface';
import type { ListQuery, PageResult } from '../../contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class HttpCommunityGroupsService implements ICommunityGroupsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl ?? '/api'}/groups`;
  workspaces(userId: string): Promise<GroupWorkspace[]> {
    return firstValueFrom(this.http.get<GroupWorkspace[]>(`${this.url}/workspaces`, { params: { userId } }));
  }
  selectWorkspace(userId: string, groupId: string | null): Promise<GroupWorkspaceSelection> {
    return firstValueFrom(this.http.post<GroupWorkspaceSelection>(`${this.url}/workspaces/select`, { userId, groupId }));
  }
  async page(userId: string, query: ListQuery<GroupFilters>, signal?: AbortSignal): Promise<PageResult<CommunityGroup, GroupCounters>> {
    signal?.throwIfAborted();
    const page = await firstValueFrom(this.http.get<PageResult<CommunityGroup, GroupCounters>>(this.url, { params: {
      userId, bucket: query.filters?.bucket ?? 'explore', category: query.filters?.category ?? '',
      pageSize: query.pageSize, ...(query.cursor ? { cursor: query.cursor } : {})
    } }));
    signal?.throwIfAborted(); return page;
  }
  detail(userId: string, id: string): Promise<CommunityGroup> {
    return firstValueFrom(this.http.get<CommunityGroup>(`${this.url}/${encodeURIComponent(id)}`, { params: { userId } }));
  }
  save(request: SaveCommunityGroup): Promise<CommunityGroup> { return firstValueFrom(this.http.post<CommunityGroup>(this.url, request)); }
  join(userId: string, groupId: string): Promise<CommunityGroup> {
    return firstValueFrom(this.http.post<CommunityGroup>(`${this.url}/join`, { userId, groupId }));
  }
}
