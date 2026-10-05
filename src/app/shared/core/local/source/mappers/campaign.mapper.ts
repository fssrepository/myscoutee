import type { Campaign } from '../../../contracts/campaign.interface';
import type { CampaignRecord } from '../entity/campaign.entity';
import type { UserRecord } from '../entity/user.entity';
import type { UserRateRecord } from '../entity/rate.entity';

export class LocalCampaignMapper {
  static toDto(record: CampaignRecord, owner: UserRecord, viewer: UserRecord, rating?: UserRateRecord): Campaign {
    return { ...structuredClone(record), attachments:structuredClone(record.attachments??[]), ownerName: owner.name, ownerAvatarUrl: owner.images?.[0] ?? null,
      ownerCity: owner.city, distanceKm: this.distance(owner, viewer), viewerRating: rating?.scoreGiven ?? rating?.rate ?? 0,
      viewerRatingSnapshot: rating?.ratingSnapshots?.[viewer.id] ?? rating?.ratingSnapshot };
  }
  static distance(owner: UserRecord, viewer: UserRecord): number | null {
    const a = owner.locationCoordinates; const b = viewer.locationCoordinates;
    let distanceKm: number | null = null;
    if (a && b) {
      const radians = Math.PI / 180;
      const h = Math.sin((b.latitude - a.latitude) * radians / 2) ** 2
        + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians)
        * Math.sin((b.longitude - a.longitude) * radians / 2) ** 2;
      distanceKm = Math.round(12742 * Math.asin(Math.sqrt(Math.min(1, h))) * 10) / 10;
    }
    return distanceKm;
  }
}
