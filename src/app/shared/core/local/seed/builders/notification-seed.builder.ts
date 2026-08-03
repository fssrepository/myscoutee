import type { NotificationCategory } from '../../../contracts/notification.interface';
import type { NotificationRecord } from '../../source/entity/notification.entity';
import type { UserRecord } from '../../source/entity/user.entity';
import type { ActivityInvitationSeedItem } from '../entity';
import { SeedEventsBuilder } from './events-seed.builder';

interface SeedNotificationDefinition {
  kind: string;
  category: NotificationCategory;
  title: string;
  message: (senderName: string) => string;
  sourceType: string;
  sourceId: string;
  sender: boolean;
}

const SEED_REFERENCE_TIME_MS = Date.parse('2026-07-27T18:30:00.000Z');
const INVITATION_REFERENCE_TIME_MS = Date.parse('2026-07-30T12:35:00.000Z');
const UNREAD_SEED_COUNT = 24;
const SEED_NOTIFICATION_DEFINITIONS: readonly SeedNotificationDefinition[] = [
  {
    kind: 'contact-requested',
    category: 'user',
    title: 'New contact request',
    message: sender => `${sender} would like to connect with you.`,
    sourceType: 'user',
    sourceId: 'demo-contact-request',
    sender: true
  },
  {
    kind: 'chat-message-received',
    category: 'chat',
    title: 'New message',
    message: sender => `${sender} sent you a message about the upcoming meetup.`,
    sourceType: 'chat',
    sourceId: 'demo-chat-meetup',
    sender: true
  },
  {
    kind: 'event-time-changed',
    category: 'event',
    title: 'Event time changed',
    message: () => 'The organizer moved Sunset Hike to 18:30. Your booking is still active.',
    sourceType: 'event',
    sourceId: 'demo-event-sunset-hike',
    sender: false
  },
  {
    kind: 'event-member-approved',
    category: 'event-admin',
    title: 'Member approved',
    message: sender => `${sender} accepted your request to join Weekend Board Games.`,
    sourceType: 'event',
    sourceId: 'demo-event-board-games',
    sender: true
  },
  {
    kind: 'asset-request-approved',
    category: 'asset',
    title: 'Transport approved',
    message: () => 'Your transport request for Lakeside Picnic was approved.',
    sourceType: 'asset',
    sourceId: 'demo-asset-transport',
    sender: false
  },
  {
    kind: 'random-groups-generated',
    category: 'scheduled',
    title: 'Random rooms generated',
    message: () => 'The scheduled room generator completed and placed every accepted member.',
    sourceType: 'event',
    sourceId: 'demo-event-random-rooms',
    sender: false
  },
  {
    kind: 'profile-review-completed',
    category: 'app-admin',
    title: 'Profile review completed',
    message: () => 'MyScoutee support reviewed your recent profile update.',
    sourceType: 'profile',
    sourceId: 'recipient',
    sender: false
  },
  {
    kind: 'event-reminder',
    category: 'scheduled',
    title: 'Event starts tomorrow',
    message: () => 'Sunset Hike starts tomorrow at 18:30. Remember to check the meeting point.',
    sourceType: 'event',
    sourceId: 'demo-event-sunset-hike',
    sender: false
  },
  {
    kind: 'asset-returned',
    category: 'asset',
    title: 'Supplies returned',
    message: sender => `${sender} marked your borrowed camping supplies as returned.`,
    sourceType: 'asset',
    sourceId: 'demo-asset-supplies',
    sender: true
  },
  {
    kind: 'event-published',
    category: 'event-admin',
    title: 'Event published',
    message: () => 'Your event is now visible to eligible members.',
    sourceType: 'event',
    sourceId: 'demo-event-published',
    sender: false
  },
  {
    kind: 'contact-accepted',
    category: 'user',
    title: 'Contact accepted',
    message: sender => `${sender} accepted your contact request.`,
    sourceType: 'user',
    sourceId: 'demo-contact-accepted',
    sender: true
  },
  {
    kind: 'chat-mentioned',
    category: 'chat',
    title: 'You were mentioned',
    message: sender => `${sender} mentioned you in Weekend Board Games.`,
    sourceType: 'chat',
    sourceId: 'demo-chat-board-games',
    sender: true
  },
  {
    kind: 'scheduled-maintenance',
    category: 'app-admin',
    title: 'Scheduled maintenance',
    message: () => 'A short maintenance window is planned for early tomorrow morning.',
    sourceType: 'application',
    sourceId: 'maintenance',
    sender: false
  },
  {
    kind: 'event-feedback-ready',
    category: 'event',
    title: 'Feedback is ready',
    message: () => 'You can now leave feedback for Lakeside Picnic.',
    sourceType: 'event',
    sourceId: 'demo-event-lakeside-picnic',
    sender: false
  },
  {
    kind: 'event-location-changed',
    category: 'event',
    title: 'Meeting point updated',
    message: () => 'City Photo Walk now meets at the north entrance of the station.',
    sourceType: 'event',
    sourceId: 'demo-event-photo-walk',
    sender: false
  },
  {
    kind: 'asset-requested',
    category: 'asset',
    title: 'New asset request',
    message: sender => `${sender} requested one seat in your car for Alpine Weekend.`,
    sourceType: 'asset',
    sourceId: 'demo-asset-car',
    sender: true
  },
  {
    kind: 'event-member-cancelled',
    category: 'event-admin',
    title: 'Member cancelled',
    message: sender => `${sender} cancelled their place at Creative Coffee Morning.`,
    sourceType: 'event',
    sourceId: 'demo-event-coffee',
    sender: true
  },
  {
    kind: 'chat-reply-received',
    category: 'chat',
    title: 'New reply',
    message: sender => `${sender} replied to your transport question.`,
    sourceType: 'chat',
    sourceId: 'demo-chat-transport',
    sender: true
  },
  {
    kind: 'contact-profile-updated',
    category: 'user',
    title: 'Contact profile updated',
    message: sender => `${sender} added new interests that match yours.`,
    sourceType: 'user',
    sourceId: 'demo-contact-profile',
    sender: true
  },
  {
    kind: 'event-cancelled',
    category: 'event',
    title: 'Event cancelled',
    message: () => 'Sunday Kayaking was cancelled by the organizer.',
    sourceType: 'event',
    sourceId: 'demo-event-kayaking',
    sender: false
  },
  {
    kind: 'asset-request-declined',
    category: 'asset',
    title: 'Asset request declined',
    message: () => 'The tent request for Forest Camp could not be accepted.',
    sourceType: 'asset',
    sourceId: 'demo-asset-tent',
    sender: false
  },
  {
    kind: 'event-capacity-warning',
    category: 'event-admin',
    title: 'Event is nearly full',
    message: () => 'Weekend Board Games has one remaining participant place.',
    sourceType: 'event',
    sourceId: 'demo-event-board-games',
    sender: false
  },
  {
    kind: 'scheduled-event-check-in',
    category: 'scheduled',
    title: 'Check-in is open',
    message: () => 'Check-in for Sunset Hike is now open.',
    sourceType: 'event',
    sourceId: 'demo-event-sunset-hike',
    sender: false
  },
  {
    kind: 'admin-security-notice',
    category: 'app-admin',
    title: 'Security notice',
    message: () => 'A new sign-in was confirmed for your demo account.',
    sourceType: 'application',
    sourceId: 'security',
    sender: false
  },
  {
    kind: 'chat-poll-closed',
    category: 'chat',
    title: 'Chat poll closed',
    message: () => 'The Weekend Board Games time poll has closed.',
    sourceType: 'chat',
    sourceId: 'demo-chat-board-games',
    sender: false
  },
  {
    kind: 'event-waitlist-promoted',
    category: 'event',
    title: 'You have a place',
    message: () => 'A place opened at Rooftop Yoga and your booking is now confirmed.',
    sourceType: 'event',
    sourceId: 'demo-event-yoga',
    sender: false
  },
  {
    kind: 'asset-handover-reminder',
    category: 'scheduled',
    title: 'Asset handover reminder',
    message: () => 'Your camping stove handover is scheduled for tomorrow at 09:00.',
    sourceType: 'asset',
    sourceId: 'demo-asset-stove',
    sender: false
  },
  {
    kind: 'event-cohost-added',
    category: 'event-admin',
    title: 'Co-host added',
    message: sender => `${sender} accepted the co-host role for Creative Coffee Morning.`,
    sourceType: 'event',
    sourceId: 'demo-event-coffee',
    sender: true
  },
  {
    kind: 'contact-birthday',
    category: 'user',
    title: 'A contact has a birthday',
    message: sender => `${sender} has a birthday today.`,
    sourceType: 'user',
    sourceId: 'demo-contact-birthday',
    sender: true
  },
  {
    kind: 'asset-capacity-changed',
    category: 'asset',
    title: 'Transport capacity changed',
    message: () => 'Two more seats are available for Alpine Weekend.',
    sourceType: 'asset',
    sourceId: 'demo-asset-car',
    sender: false
  },
  {
    kind: 'admin-policy-update',
    category: 'app-admin',
    title: 'Community guidelines updated',
    message: () => 'The community guidelines have a short new section about shared assets.',
    sourceType: 'application',
    sourceId: 'community-guidelines',
    sender: false
  },
  {
    kind: 'scheduled-weekly-summary',
    category: 'scheduled',
    title: 'Your weekly summary',
    message: () => 'You joined two events and met four new people this week.',
    sourceType: 'profile',
    sourceId: 'recipient',
    sender: false
  }
];

export class SeedNotificationsBuilder {
  static readonly unreadCount = UNREAD_SEED_COUNT;

  static buildForUser(
    recipientUserId: string,
    users: readonly UserRecord[]
  ): NotificationRecord[] {
    const normalizedRecipientUserId = recipientUserId.trim();
    if (!normalizedRecipientUserId) {
      return [];
    }
    const senders = users.filter(user =>
      user.id.trim()
      && user.id !== normalizedRecipientUserId
      && user.admin !== true
    );
    const invitations = SeedEventsBuilder
      .buildSeedInvitationItemsByUser()[normalizedRecipientUserId] ?? [];
    const invitationRecords = invitations.map((invitation, index) =>
      this.buildInvitationNotification(
        normalizedRecipientUserId,
        invitation,
        users,
        index
      )
    );

    const generalRecords = SEED_NOTIFICATION_DEFINITIONS.map((definition, index) => {
      const sender = definition.sender && senders.length > 0
        ? senders[index % senders.length]
        : null;
      const senderName = sender?.name?.trim() || 'A community member';
      const createdAtMs = SEED_REFERENCE_TIME_MS - index * 27 * 60_000;
      const sourceId = definition.sourceId === 'recipient'
        ? normalizedRecipientUserId
        : definition.sourceId;
      return {
        id: `${normalizedRecipientUserId}:notification-demo-v2:${String(index + 1).padStart(2, '0')}`,
        recipientUserId: normalizedRecipientUserId,
        kind: definition.kind,
        category: definition.category,
        title: definition.title,
        message: definition.message(senderName),
        createdAtIso: new Date(createdAtMs).toISOString(),
        readAtIso: index < UNREAD_SEED_COUNT
          ? null
          : new Date(createdAtMs + 12 * 60_000).toISOString(),
        senderUserId: sender?.id ?? null,
        senderName: sender?.name?.trim() || null,
        senderAvatarUrl: sender?.images?.[0]?.trim() || null,
        actionPath: '/game',
        sourceType: definition.sourceType,
        sourceId,
        payload: {
          demo: 'true',
          seedVersion: '2'
        }
      };
    });
    return [...invitationRecords, ...generalRecords];
  }

  private static buildInvitationNotification(
    recipientUserId: string,
    invitation: ActivityInvitationSeedItem,
    users: readonly UserRecord[],
    index: number
  ): NotificationRecord {
    const inviterName = invitation.inviter.trim() || 'An event organizer';
    const sender = this.resolveInvitationSender(invitation, users, recipientUserId);
    const eventTitle = invitation.description.trim() || 'Event invitation';
    const createdAtMs = INVITATION_REFERENCE_TIME_MS - index * 15 * 60_000;
    return {
      id: `${recipientUserId}:notification-event-invite:${invitation.id}`,
      recipientUserId,
      kind: 'event-invite',
      category: 'event',
      title: eventTitle,
      message: `${inviterName} invited you to ${eventTitle}.`,
      createdAtIso: new Date(createdAtMs).toISOString(),
      readAtIso: invitation.unread > 0
        ? null
        : new Date(createdAtMs + 12 * 60_000).toISOString(),
      senderUserId: sender?.id ?? (invitation.creatorUserId?.trim() || null),
      senderName: sender?.name?.trim() || inviterName,
      senderAvatarUrl: sender?.images?.[0]?.trim() || null,
      actionPath: '/game',
      sourceType: 'event',
      sourceId: invitation.id,
      payload: {
        demo: 'true',
        seedVersion: '3',
        eventId: invitation.id,
        eventTitle,
        eventScope: 'invitations',
        ...(sender?.id ? { senderUserId: sender.id } : {})
      }
    };
  }

  private static resolveInvitationSender(
    invitation: ActivityInvitationSeedItem,
    users: readonly UserRecord[],
    recipientUserId: string
  ): UserRecord | null {
    const explicitCreatorUserId = invitation.creatorUserId?.trim() || '';
    if (explicitCreatorUserId) {
      return users.find(user => user.id === explicitCreatorUserId) ?? null;
    }
    const normalizedInviter = invitation.inviter.trim().toLocaleLowerCase();
    if (!normalizedInviter) {
      return null;
    }
    return users.find(user => {
      if (!user.id.trim() || user.id === recipientUserId || user.admin === true) {
        return false;
      }
      const normalizedName = user.name.trim().toLocaleLowerCase();
      const firstName = normalizedName.split(/\s+/)[0] ?? '';
      return normalizedName === normalizedInviter || firstName === normalizedInviter;
    }) ?? null;
  }
}
