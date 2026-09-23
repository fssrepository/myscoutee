import type { PhotoFeedPost } from '../../../contracts/photo-feed.interface';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';
export const PHOTO_FEED_TABLE_NAME = APP_INDEXED_DB_KEYS.photoFeedPosts;
export interface PhotoFeedRecord extends Omit<PhotoFeedPost, 'distanceKm'> {
  deleted?: boolean;
  locationCoordinates: { latitude: number; longitude: number };
}
export interface PhotoFeedMemorySchema {
  [PHOTO_FEED_TABLE_NAME]: { byId: Record<string, PhotoFeedRecord>; ids: string[] };
}
