import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { ContentModerationDecision, ContentModerationDecisionResult, ContentModerationPage, ContentModerationSettings, ContentModerationSnapshot, ModerationCategoryFilter, ModerationStatus } from '../../contracts/content-moderation.interface';
import type { ListQuery } from '../../contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class HttpContentModerationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl ?? '/api'}/admin/content-moderation`;
  snapshot(adminUserId: string) { return firstValueFrom(this.http.get<ContentModerationSnapshot>(`${this.url}/state`, { params: { adminUserId } })); }
  page(adminUserId: string, category: ModerationCategoryFilter, status: ModerationStatus, query: ListQuery) {
    return firstValueFrom(this.http.get<ContentModerationPage>(this.url, { params: { adminUserId, category, status, pageSize: query.pageSize, ...(query.cursor ? { cursor: query.cursor } : {}) } }));
  }
  settings(adminUserId: string, expectedRevision: number, settings: ContentModerationSettings) {
    return firstValueFrom(this.http.post<ContentModerationSnapshot>(`${this.url}/settings`, { adminUserId, expectedRevision, settings }));
  }
  decide(id: string, request: ContentModerationDecision) { return firstValueFrom(this.http.post<ContentModerationDecisionResult>(`${this.url}/${encodeURIComponent(id)}/decision`, request)); }
  detail<T>(adminUserId: string, id: string) { return firstValueFrom(this.http.get<T>(`${this.url}/${encodeURIComponent(id)}/detail`, { params: { adminUserId } })); }
}
