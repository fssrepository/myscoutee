import notificationCatalog from './notification-seed.catalog.json';
import roleNotifications from '../../data/role-notifications.json';
import type { NotificationCategory } from '../../../../contracts/notifications/notification.interface';
import type { NotificationRecord } from '../../../source/entity/notifications/notification.entity';
import type { UserRecord } from '../../../source/entity/accounts/user.entity';
import type { ActivityInvitationSeedItem } from '../../entity';
import { SeedEventsBuilder } from '../events/events-seed.builder';

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
const SEED_NOTIFICATION_DEFINITIONS: readonly SeedNotificationDefinition[] = (notificationCatalog as Array<Omit<SeedNotificationDefinition, 'message'> & { message: string }>).map(definition => ({
  ...definition,
  message: sender => definition.message.replace('{{sender}}', () => sender)
}));

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
    const recipient = users.find(user => user.id === normalizedRecipientUserId);
    if (recipient?.operator || recipient?.admin) {
      const role = recipient.operator ? 'operator' : 'admin';
      return roleNotifications.filter(item => item.role === role).map(({ role: _role, ...item }, index) => ({
        ...item, id: `${normalizedRecipientUserId}:notification-role-v1:${item.kind}`,
        category: item.category as NotificationCategory, recipientUserId: normalizedRecipientUserId,
        createdAtIso: new Date(SEED_REFERENCE_TIME_MS - index * 60_000).toISOString(), readAtIso: null,
        payload: Object.fromEntries(Object.entries(item.payload).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      }));
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
      message: 'Event invitation',
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
