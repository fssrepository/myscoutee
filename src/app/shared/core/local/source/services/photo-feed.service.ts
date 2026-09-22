import { Injectable, inject } from '@angular/core';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalPhotoFeedRepository } from '../repositories/photo-feed.repository';
import { LocalPhotoFeedMapper } from '../mappers/photo-feed.mapper';
import { normalizeImageDetails } from '../../../contracts/image-gallery.interface';
import type { CreatePhotoFeedPost, IPhotoFeedService } from '../../../contracts/photo-feed.interface';
import type { ListQuery } from '../../../contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class LocalPhotoFeedService extends LocalRouteDelayService implements IPhotoFeedService {
  private readonly repository = inject(LocalPhotoFeedRepository);
  private coordinates(userId: string) {
    const point = this.repository.user(userId)?.locationCoordinates;
    if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)
      || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) throw new Error('feed.locationRequired');
    return point;
  }
  async page(userId: string, query: ListQuery, signal?: AbortSignal) {
    await this.waitForRouteDelay('/activities/feed', signal);
    await this.repository.whenReady();
    return this.repository.page(userId, this.coordinates(userId), query);
  }
  async create(request: CreatePhotoFeedPost) {
    await this.waitForRouteDelay('/activities/feed');
    await this.repository.whenReady();
    const user = this.repository.user(request.userId);
    const point = this.coordinates(request.userId);
    const existing = this.repository.find(request.id);
    if (existing) {
      if (existing.creatorUserId !== request.userId) throw new Error('Invalid feed owner.');
      return LocalPhotoFeedMapper.toDto(existing, point);
    }
    if (!user || request.imageUrls.length < 1 || request.imageUrls.length > 5 || new Set(request.imageUrls).size !== request.imageUrls.length) throw new Error('Invalid feed images.');
    const imageDetails = normalizeImageDetails(request.imageDetails, request.imageUrls);
    const record = await this.repository.insert({ id: request.id, creatorUserId: request.userId, creatorName: user.name,
      creatorAvatarUrl: user.images?.[0] ?? '', createdAtIso: new Date().toISOString(),
      imageUrls: [...request.imageUrls], imageDetails, locationCoordinates: { ...point } });
    return LocalPhotoFeedMapper.toDto(record, point);
  }
}
