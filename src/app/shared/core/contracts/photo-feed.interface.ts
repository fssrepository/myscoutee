import type { ImageDetailsMap, ImageEventReference } from './image-gallery.interface';
import type { ListQuery, PageResult } from './list.interface';
import type { ModerationStatus } from './content-moderation.interface';
export type PhotoFeedStatusFilter = 'public' | 'seen' | ModerationStatus;
export interface PhotoFeedFilters { status: PhotoFeedStatusFilter; }
export interface PhotoFeedCounters { revision: number; counts: Partial<Record<ModerationStatus, number>>; }

export interface PhotoFeedPost {
  id: string;
  creatorUserId: string;
  creatorName: string;
  creatorAvatarUrl: string;
  createdAtIso: string;
  imageUrls: string[];
  imageDetails: ImageDetailsMap;
  distanceKm: number;
  feedCounters?: PhotoFeedCounters;
  moderationStatus?: import('./content-moderation.interface').ModerationStatus;
}
export interface CreatePhotoFeedPost {
  userId: string;
  id: string;
  imageUrls: string[];
  imageDetails: ImageDetailsMap;
}
export interface IPhotoFeedService {
  events(userId: string, query: ListQuery): Promise<PageResult<PhotoFeedEventOption>>;
  page(userId: string, query: ListQuery<PhotoFeedFilters>, signal?: AbortSignal, seenPostIds?: string[]): Promise<PageResult<PhotoFeedPost, PhotoFeedCounters>>;
  create(request: CreatePhotoFeedPost): Promise<PhotoFeedPost>;
  remove(userId: string, id: string): Promise<PhotoFeedCounters>;
  seen(userId: string, postIds: string[]): Promise<string[]>;
}
export interface PhotoFeedEventOption { event: ImageEventReference; imageUrl?: string | null; startAtIso?: string | null; }
