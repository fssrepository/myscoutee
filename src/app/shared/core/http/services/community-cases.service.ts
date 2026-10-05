import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { CommunityCase, CommunityScheduledTask, ICommunityCasesService, CaseFilters, CaseListContext, SaveCommunityCase, CaseCommand, SaveCommunityScheduledTask, ScheduledTaskAction, ScheduledTaskFilters, ScheduledTaskCounters } from '../../contracts/community-case.interface';
import type { ListQuery, PageResult } from '../../contracts/list.interface';

@Injectable({ providedIn: 'root' })
export class HttpCommunityCasesService implements ICommunityCasesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl ?? '/api'}/community-cases`;
  private params(userId: string, query: ListQuery<CaseFilters | ScheduledTaskFilters>) {
    const params: Record<string, string | number> = { userId, pageSize: query.pageSize, cursor: query.cursor ?? '' };
    for (const [key, value] of Object.entries(query.filters ?? {})) if (value != null) params[key] = value;
    return params;
  }
  async page(userId: string, query: ListQuery<CaseFilters>, signal?: AbortSignal): Promise<PageResult<CommunityCase, CaseListContext>> {
    signal?.throwIfAborted(); const result = await firstValueFrom(this.http.get<PageResult<CommunityCase, CaseListContext>>(this.url, { params: this.params(userId, query) }));
    signal?.throwIfAborted(); return result;
  }
  async detail(userId: string, id: string, signal?: AbortSignal): Promise<CommunityCase> {
    signal?.throwIfAborted(); const result = await firstValueFrom(this.http.get<CommunityCase>(`${this.url}/${encodeURIComponent(id)}`, { params: { userId } }));
    signal?.throwIfAborted(); return result;
  }
  save(request: SaveCommunityCase) { return firstValueFrom(this.http.post<CommunityCase>(this.url, request)); }
  action(id: string, request: CaseCommand) { return firstValueFrom(this.http.post<CommunityCase>(`${this.url}/${encodeURIComponent(id)}/action`, request)); }
  read(userId: string, id: string) { return firstValueFrom(this.http.post<CommunityCase>(`${this.url}/${encodeURIComponent(id)}/read`, { userId })); }
  async tasks(userId: string, query: ListQuery<ScheduledTaskFilters>, signal?: AbortSignal): Promise<PageResult<CommunityScheduledTask, ScheduledTaskCounters>> {
    signal?.throwIfAborted(); const result = await firstValueFrom(this.http.get<PageResult<CommunityScheduledTask, ScheduledTaskCounters>>(`${this.url}/tasks`, { params: this.params(userId, query) }));
    signal?.throwIfAborted(); return result;
  }
  saveTask(request: SaveCommunityScheduledTask) { return firstValueFrom(this.http.post<CommunityScheduledTask>(`${this.url}/tasks`, request)); }
  taskAction(userId: string, id: string, action: ScheduledTaskAction, version: number) { return firstValueFrom(this.http.post<CommunityScheduledTask>(`${this.url}/tasks/${encodeURIComponent(id)}/action`, { userId, action, version })); }
}