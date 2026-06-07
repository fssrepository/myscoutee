import type { AdminSeedHelpTarget } from './admin-seed.models';

export class AdminHelpSeedBuilder {
  static demoAdminHelpTargets(): AdminSeedHelpTarget[] {
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
        title: 'Alpine Weekend 2.0',
        subtitle: 'Feb 27 - Mar 1',
        description: 'Multi-day ski meetup with social dinner and pair game.',
        previewUrl: 'https://picsum.photos/seed/demo-event-events%3Au1%3Ae1%3Aalpine-weekend-2.0/1200/700',
        text: 'Please check what I see on this event screen.',
        targetUrl: '/game?supportTarget=event&eventId=e1'
      },
      {
        key: 'asset-supplies',
        messageId: 'm-admin-help-u1-asset-supplies',
        attachmentId: 'admin-help:u1:asset-supplies',
        attachmentType: 'asset',
        attachmentEntityId: 'asset-sup-2',
        assetType: 'Supplies',
        title: 'Game Night Box',
        subtitle: 'Supplies - Austin',
        description: 'Board games, cards, and speakers ready for the venue.',
        previewUrl: 'https://picsum.photos/seed/supplies-gear-asset-sup-2/1200/700',
        text: 'Please check this shared asset screen.',
        targetUrl: '/game?supportTarget=asset&assetFilter=Supplies&assetId=asset-sup-2&assetTitle=Game%20Night%20Box&assetSubtitle=Board%20games%20%2B%20cards%20%2B%20speakers&assetCity=Austin&assetDetails=Board%20games%2C%20cards%2C%20and%20speakers%20ready%20for%20the%20venue.&assetPreview=https%3A%2F%2Fpicsum.photos%2Fseed%2Fsupplies-gear-asset-sup-2%2F1200%2F700'
      }
    ];
  }
}
