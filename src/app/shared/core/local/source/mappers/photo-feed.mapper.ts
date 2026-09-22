import type { PhotoFeedPost } from '../../../contracts/photo-feed.interface';
import type { PhotoFeedRecord } from '../entity/photo-feed.entity';
import { normalizeImageDetails } from '../../../contracts/image-gallery.interface';

export class LocalPhotoFeedMapper {
  static toDto(record: PhotoFeedRecord, origin: { latitude: number; longitude: number }): PhotoFeedPost {
    const radians = Math.PI / 180;
    const point = record.locationCoordinates;
    const haversine = Math.sin((point.latitude - origin.latitude) * radians / 2) ** 2
      + Math.cos(origin.latitude * radians) * Math.cos(point.latitude * radians)
      * Math.sin((point.longitude - origin.longitude) * radians / 2) ** 2;
    const distanceKm = 6378.137 * 2 * Math.asin(Math.min(1, Math.sqrt(haversine)));
    return { id: record.id, creatorUserId: record.creatorUserId, creatorName: record.creatorName,
      creatorAvatarUrl: record.creatorAvatarUrl, createdAtIso: record.createdAtIso,
      imageUrls: [...record.imageUrls], imageDetails: normalizeImageDetails(record.imageDetails, record.imageUrls), distanceKm, moderationStatus: record.moderationStatus };
  }
}
