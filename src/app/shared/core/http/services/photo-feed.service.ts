import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { CreatePhotoFeedPost, IPhotoFeedService, PhotoFeedPost, PhotoFeedEventOption, PhotoFeedFilters } from '../../contracts/photo-feed.interface';
import type { ListQuery, PageResult } from '../../contracts/list.interface';
import type { PhotoFeedCounters } from '../../contracts/photo-feed.interface';
@Injectable({ providedIn: 'root' })
export class HttpPhotoFeedService implements IPhotoFeedService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl ?? '/api'}/activities/feed`;
  page(userId: string, query: ListQuery<PhotoFeedFilters>, signal?: AbortSignal, seenPostIds?: string[]): Promise<PageResult<PhotoFeedPost, PhotoFeedCounters>> {
    signal?.throwIfAborted();
    if (seenPostIds?.length) return firstValueFrom(this.http.post<PageResult<PhotoFeedPost, PhotoFeedCounters>>(`${this.url}/page`,
      { userId, pageSize: query.pageSize, cursor: query.cursor, status: query.filters?.status ?? 'public', seenPostIds }));
    return firstValueFrom(this.http.get<PageResult<PhotoFeedPost, PhotoFeedCounters>>(this.url,
      { params: { userId, pageSize: query.pageSize, status: query.filters?.status ?? 'public', ...(query.cursor ? { cursor: query.cursor } : {}) } }));
  }
  create(request: CreatePhotoFeedPost): Promise<PhotoFeedPost> {
    return firstValueFrom(this.http.post<PhotoFeedPost>(this.url, request));
  }
  remove(userId: string, id: string): Promise<PhotoFeedCounters> {
    return firstValueFrom(this.http.delete<PhotoFeedCounters>(`${this.url}/${encodeURIComponent(id)}`, { params: { userId } }));
  }
  seen(userId: string, postIds: string[]): Promise<string[]> {
    return firstValueFrom(this.http.post<string[]>(`${this.url}/seen`, { userId, postIds }));
  }
  events(userId: string, query: ListQuery): Promise<PageResult<PhotoFeedEventOption>> {
    return firstValueFrom(this.http.get<PageResult<PhotoFeedEventOption>>(`${this.url}/events`,
      { params: { userId, pageSize: query.pageSize, ...(query.cursor ? { cursor: query.cursor } : {}) } }));
  }
}
