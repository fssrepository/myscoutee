import { HTTP_ADAPTER, LOCAL_ADAPTER } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from '../platform/base-route-mode.service';

import type { CreatePhotoFeedPost, IPhotoFeedService, PhotoFeedFilters } from '../../../contracts/content/photo-feed.interface';
import type { ListQuery } from '@fssrepository/myscoutee-components';
@Injectable({ providedIn: 'root' })
export class PhotoFeedService extends BaseRouteModeService implements IPhotoFeedService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly http = this.transportAdapters.reference(HTTP_ADAPTER.PHOTO_FEED);
  private readonly local = this.transportAdapters.reference(LOCAL_ADAPTER.PHOTO_FEED);
  private get source(): IPhotoFeedService { return this.resolveRouteService('/activities/feed', this.local, this.http); }
  page(userId: string, query: ListQuery<PhotoFeedFilters>, signal?: AbortSignal, seenPostIds?: string[]) { return this.source.page(userId, query, signal, seenPostIds); }
  create(request: CreatePhotoFeedPost) { return this.source.create(request); }
  remove(userId: string, id: string) { return this.source.remove(userId, id); }
  seen(userId: string, postIds: string[]) { return this.source.seen(userId, postIds); }
  events(userId: string, query: ListQuery) { return this.source.events(userId, query); }
}
