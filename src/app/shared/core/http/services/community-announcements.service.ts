import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { ICommunityAnnouncementsService, CommunityAnnouncement, AnnouncementFilters, SaveAnnouncement, AnnouncementCommand } from '../../contracts/community-announcement.interface';
import type { ListQuery, PageResult } from '../../contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class HttpCommunityAnnouncementsService implements ICommunityAnnouncementsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl ?? '/api'}/community-announcements`;
  async page(userId: string, query: ListQuery<AnnouncementFilters>, signal?: AbortSignal): Promise<PageResult<CommunityAnnouncement>> {
    signal?.throwIfAborted();
    const result = await firstValueFrom(this.http.get<PageResult<CommunityAnnouncement>>(this.url, { params: { userId, ...query.filters!, pageSize: query.pageSize, cursor: query.cursor ?? '' } }));
    signal?.throwIfAborted(); return result;
  }
  async detail(userId: string, id: string, signal?: AbortSignal) {
    signal?.throwIfAborted(); const result = await firstValueFrom(this.http.get<CommunityAnnouncement>(`${this.url}/${encodeURIComponent(id)}`, { params: { userId } }));
    signal?.throwIfAborted(); return result;
  }
  save(request: SaveAnnouncement) { return firstValueFrom(this.http.post<CommunityAnnouncement>(this.url, request)); }
  action(id: string, request: AnnouncementCommand) { return firstValueFrom(this.http.post<CommunityAnnouncement>(`${this.url}/${encodeURIComponent(id)}/action`, request)); }
}
