import type { AdminSeedHelpTarget } from './admin-seed.models';
import * as AppConstants from '../../../../common/constants';
import { demoAssetPlaceholderUrl, demoEventPlaceholderUrl } from '../demo-image-pool';

export class AdminHelpSeedBuilder {
  static demoAdminHelpTargets(): AdminSeedHelpTarget[] {
    const eventPreviewUrl = demoEventPlaceholderUrl('demo-event-events:u1:e1:alpine-weekend-2.0');
    const assetPreviewUrl = demoAssetPlaceholderUrl('asset-sup-2');
    return [
      {
        key: 'current',
        messageId: 'm-admin-help-u1',
        attachmentId: 'admin-help:u1:current',
        attachmentType: 'link',
        attachmentEntityId: '',
        title: 'Open shared help view',
        subtitle: 'Limited-time support token',
        description: '',
        text: 'Please help me, I am sharing my current MyScoutee screen with support.',
        targetUrl: '/game'
      },
      {
        key: 'events',
        messageId: 'm-admin-help-u1-events',
        attachmentId: 'admin-help:u1:events',
        attachmentType: 'event',
        attachmentEntityId: 'e1',
        title: 'Alpine Cabin Supper',
        subtitle: 'Feb 27 - Mar 1',
        description: 'A small ski group winds down over soup while wet gloves and boots dry by the stove.',
        previewUrl: eventPreviewUrl,
        text: 'Please check what I see on this event screen.',
        targetUrl: '/game?supportTarget=event&eventId=e1'
      },
      {
        key: 'asset-supplies',
        messageId: 'm-admin-help-u1-asset-supplies',
        attachmentId: 'admin-help:u1:asset-supplies',
        attachmentType: 'asset',
        attachmentEntityId: 'asset-sup-2',
        assetType: AppConstants.ASSET_TYPE_SUPPLIES,
        title: 'Game Night Box',
        subtitle: `${AppConstants.ASSET_TYPE_SUPPLIES} - Austin`,
        description: 'Board games, cards, and speakers ready for the venue.',
        previewUrl: assetPreviewUrl,
        text: 'Please check this shared asset screen.',
        targetUrl: `/game?supportTarget=asset&assetFilter=${AppConstants.ASSET_TYPE_SUPPLIES}&assetId=asset-sup-2&assetTitle=Game%20Night%20Box&assetSubtitle=Board%20games%20%2B%20cards%20%2B%20speakers&assetCity=Austin&assetDetails=Board%20games%2C%20cards%2C%20and%20speakers%20ready%20for%20the%20venue.&assetPreview=${encodeURIComponent(assetPreviewUrl)}`
      }
    ];
  }
}
