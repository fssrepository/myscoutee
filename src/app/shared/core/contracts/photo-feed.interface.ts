import type { ImageDetailsMap } from './image-gallery.interface';
import type { ListQuery, PageResult } from './list.interface';

export interface PhotoFeedPost {
  id: string;
  creatorUserId: string;
  creatorName: string;
  creatorAvatarUrl: string;
  createdAtIso: string;
  imageUrls: string[];
  imageDetails: ImageDetailsMap;
  distanceKm: number;
  moderationStatus?: import('./content-moderation.interface').ModerationStatus;
}
export interface CreatePhotoFeedPost {
  userId: string;
  id: string;
  imageUrls: string[];
  imageDetails: ImageDetailsMap;
}
export interface IPhotoFeedService {
  page(userId: string, query: ListQuery, signal?: AbortSignal): Promise<PageResult<PhotoFeedPost>>;
  create(request: CreatePhotoFeedPost): Promise<PhotoFeedPost>;
}
