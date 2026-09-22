import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { CreatePhotoFeedPost, IPhotoFeedService, PhotoFeedPost } from '../../contracts/photo-feed.interface';
import type { ListQuery, PageResult } from '../../contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class HttpPhotoFeedService implements IPhotoFeedService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl ?? '/api'}/activities/feed`;
  page(userId: string, query: ListQuery): Promise<PageResult<PhotoFeedPost>> {
    return firstValueFrom(this.http.get<PageResult<PhotoFeedPost>>(this.url,
      { params: { userId, pageSize: query.pageSize, ...(query.cursor ? { cursor: query.cursor } : {}) } }));
  }
  create(request: CreatePhotoFeedPost): Promise<PhotoFeedPost> {
    return firstValueFrom(this.http.post<PhotoFeedPost>(this.url, request));
  }
}
