import { contentModerationBadge } from './content-moderation-badge';
import type { PhotoFeedPost } from '../../core/contracts/photo-feed.interface';
import type { InfoCardData } from '../components/core/smart-list/card';

export class PhotoFeedConverter {
  static convert(post: PhotoFeedPost, viewerId?: string | null): InfoCardData<PhotoFeedPost> {
    const bucket = Math.floor(post.distanceKm / 5);
    return { id: post.id, title: post.imageDetails?.[post.imageUrls[0]]?.caption || post.creatorName,
      imageUrl: post.imageUrls[0], imageUrls: post.imageUrls, clickable: false,
      hasMenuOptions: !!viewerId && (post.creatorUserId === viewerId || post.imageUrls.some(url => {
        const organizerId = post.imageDetails[url]?.event?.organizerId;
        return !!organizerId && organizerId !== viewerId;
      })), menuPosition: 'bottom-right',
      groupLabel: `${(bucket + 1) * 5} km`,
      localSortKey: [bucket, -Date.parse(post.createdAtIso), post.id],
      metaRows: [`${post.distanceKm.toFixed(1)} km`], i18nIgnoreContent: true,
      mediaStart: { variant: 'avatar', imageUrl: post.creatorAvatarUrl, label: post.creatorName, interactive: false },
      mediaEnd: { variant: 'badge', label: `${post.imageUrls.length} / 5`,
        ariaLabel: 'image.carousel.expand', interactive: true },
      mediaBottomEnd: contentModerationBadge(post.moderationStatus),
      eagerDetail: post };
  }
  static convertList(posts: readonly PhotoFeedPost[], viewerId?: string | null) {
    return posts.map(post => this.convert(post, viewerId));
  }
}
