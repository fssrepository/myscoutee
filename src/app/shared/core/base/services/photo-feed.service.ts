import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from './base-route-mode.service';
import { HttpPhotoFeedService } from '../../http/services/photo-feed.service';
import { LocalPhotoFeedService } from '../../local/source/services/photo-feed.service';
import type { CreatePhotoFeedPost, IPhotoFeedService } from '../../contracts/photo-feed.interface';
import type { ListQuery } from '../../contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class PhotoFeedService extends BaseRouteModeService implements IPhotoFeedService {
  private readonly http = inject(HttpPhotoFeedService);
  private readonly local = inject(LocalPhotoFeedService);
  private get source(): IPhotoFeedService { return this.resolveRouteService('/activities/feed', this.local, this.http); }
  page(userId: string, query: ListQuery, signal?: AbortSignal) { return this.source.page(userId, query, signal); }
  create(request: CreatePhotoFeedPost) { return this.source.create(request); }
}
