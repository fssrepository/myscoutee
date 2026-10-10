import { AppUtils } from '../../../core/base/app-utils';
import { contentModerationBadge } from './content-moderation-badge';
import type { PhotoFeedPost } from '../../../core/contracts/photo-feed.interface';
import type { InfoCardData } from '@fssrepository/myscoutee-components';

export class PhotoFeedConverter {
  static convert(post: PhotoFeedPost, viewerId?: string | null): InfoCardData<PhotoFeedPost> {
    const bucket = Math.floor(post.distanceKm / 5);
    return { id: post.id, title: post.imageDetails?.[post.imageUrls[0]]?.caption || post.creatorName,
      imageUrl: post.imageUrls[0], imageUrls: post.imageUrls, mediaFit: 'contain', clickable: false,
      hasMenuOptions: !!viewerId && (post.creatorUserId === viewerId || post.imageUrls.some(url => {
        const organizerId = post.imageDetails[url]?.event?.organizerId;
        return !!organizerId && organizerId !== viewerId;
      })), menuPosition: 'bottom-right',
      groupLabel: AppUtils.activityGroupLabel({ distanceMetersExact: post.distanceKm * 1000 }, 'distance',
        { dateUnavailable: '', weekPrefix: '' }),
      localSortKey: [bucket, -Date.parse(post.createdAtIso), post.id],
      metaRows: [`${post.distanceKm.toFixed(1)} km`], i18nIgnoreContent: true,
      mediaStart: { variant: 'badge', layout: 'avatar-metric', tone: 'cool',
        leadingAccessory: { label: AppUtils.initialsFromText(post.creatorName), tone: 'default' },
        ariaLabel: `View ${post.creatorName} profile`, interactive: !!post.creatorUserId },
      mediaEnd: { variant: 'badge', label: `${post.imageUrls.length} / 5`,
        ariaLabel: 'image.carousel.expand', interactive: true },
      mediaBottomEnd: contentModerationBadge(post.moderationStatus),
      eagerDetail: post };
  }
  static convertList(posts: readonly PhotoFeedPost[], viewerId?: string | null) {
    return posts.map(post => this.convert(post, viewerId));
  }
}
