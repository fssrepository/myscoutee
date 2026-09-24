import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { ContentModerationDecision, ContentModerationDecisionResult, ContentModerationPage, ContentModerationSettings, ContentModerationSnapshot, ModerationCategoryFilter, ModerationStatus } from '../../contracts/content-moderation.interface';
import type { ListQuery } from '../../contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class HttpContentModerationService {
  private readonly http = inject(HttpClient);
  private url(groupId?: string | null) { return `${environment.apiBaseUrl ?? '/api'}/${groupId ? `groups/${encodeURIComponent(groupId)}` : 'admin'}/content-moderation`; }
  snapshot(adminUserId: string, groupId?: string | null) { return firstValueFrom(this.http.get<ContentModerationSnapshot>(`${this.url(groupId)}/state`, { params: { adminUserId } })); }
  page(adminUserId: string, category: ModerationCategoryFilter, status: ModerationStatus, query: ListQuery, groupId?: string | null) {
    return firstValueFrom(this.http.get<ContentModerationPage>(this.url(groupId), { params: { adminUserId, category, status, pageSize: query.pageSize, ...(query.cursor ? { cursor: query.cursor } : {}) } }));
  }
  settings(adminUserId: string, expectedRevision: number, settings: ContentModerationSettings, groupId?: string | null) {
    return firstValueFrom(this.http.post<ContentModerationSnapshot>(`${this.url(groupId)}/settings`, { adminUserId, expectedRevision, settings }));
  }
  decide(id: string, request: ContentModerationDecision, groupId?: string | null) { return firstValueFrom(this.http.post<ContentModerationDecisionResult>(`${this.url(groupId)}/${encodeURIComponent(id)}/decision`, request)); }
  detail<T>(adminUserId: string, id: string, groupId?: string | null) { return firstValueFrom(this.http.get<T>(`${this.url(groupId)}/${encodeURIComponent(id)}/detail`, { params: { adminUserId } })); }
}
