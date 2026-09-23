import { Injectable, inject } from '@angular/core';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalPhotoFeedRepository } from '../repositories/photo-feed.repository';
import { LocalPhotoFeedMapper } from '../mappers/photo-feed.mapper';
import { LocalEventsRepository } from '../repositories/events.repository';
import { normalizeImageDetails } from '../../../contracts/image-gallery.interface';
import type { CreatePhotoFeedPost, IPhotoFeedService, PhotoFeedFilters } from '../../../contracts/photo-feed.interface';
import type { ListQuery } from '../../../contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class LocalPhotoFeedService extends LocalRouteDelayService implements IPhotoFeedService {
  private readonly repository = inject(LocalPhotoFeedRepository);
  private readonly eventRepository = inject(LocalEventsRepository);
  private coordinates(userId: string) {
    const point = this.repository.user(userId)?.locationCoordinates;
    if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)
      || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) throw new Error('feed.locationRequired');
    return point;
  }
  async page(userId: string, query: ListQuery<PhotoFeedFilters>, signal?: AbortSignal) {
    await this.waitForRouteDelay('/activities/feed', signal);
    await this.repository.whenReady();
    return this.repository.page(userId, this.coordinates(userId), query, new Set(await this.repository.seenIds(userId)));
  }
  async create(request: CreatePhotoFeedPost) {
    await this.waitForRouteDelay('/activities/feed');
    await this.repository.whenReady();
    const user = this.repository.user(request.userId);
    const point = this.coordinates(request.userId);
    const existing = this.repository.find(request.id);
    if (existing) {
      if (existing.deleted || existing.creatorUserId !== request.userId) throw new Error('Invalid feed owner.');
      return { ...LocalPhotoFeedMapper.toDto(existing, point), feedCounters: this.repository.counters(request.userId) };
    }
    if (!user || request.imageUrls.length < 1 || request.imageUrls.length > 5 || new Set(request.imageUrls).size !== request.imageUrls.length) throw new Error('Invalid feed images.');
    const imageDetails = normalizeImageDetails(request.imageDetails, request.imageUrls);
    const options = new Map(this.eventRepository.queryFeedEventOptions(request.userId).map(option => [option.event.id, option.event]));
    for (const url of request.imageUrls) {
      const detail = imageDetails[url];
      const event = options.get(detail?.event?.id ?? '');
      if (!event) throw new Error('feed.eventRequired');
      imageDetails[url] = { location: event.location, caption: detail.caption, event };
    }
    const record = await this.repository.insert({ id: request.id, creatorUserId: request.userId, creatorName: user.name,
      creatorAvatarUrl: user.images?.[0] ?? '', createdAtIso: new Date().toISOString(),
      imageUrls: [...request.imageUrls], imageDetails, locationCoordinates: { ...point } });
    return { ...LocalPhotoFeedMapper.toDto(record, point), feedCounters: this.repository.counters(request.userId) };
  }
  async remove(userId: string, id: string) {
    await this.waitForRouteDelay('/activities/feed');
    await this.repository.whenReady();
    return this.repository.remove(userId, id);
  }
  async seen(userId: string, postIds: string[]) {
    await this.waitForRouteDelay('/activities/feed');
    await this.repository.whenReady();
    return this.repository.markSeen(userId, postIds);
  }
  async events(userId: string, query: ListQuery) {
    await this.waitForRouteDelay('/activities/feed');
    await this.repository.whenReady();
    const options = this.eventRepository.queryFeedEventOptions(userId);
    const index = query.cursor ? options.findIndex(option => option.event.id === query.cursor) : -1;
    if (query.cursor && index < 0) throw new Error('Invalid event cursor.');
    const start = index + 1;
    const size = Math.max(1, Math.min(50, query.pageSize || 10));
    const items = options.slice(start, start + size);
    return { items, total: options.length,
      nextCursor: start + items.length < options.length ? items.at(-1)!.event.id : null };
  }
}
