import type { EventMenuItem, HostingMenuItem, InvitationMenuItem } from '../../../demo-data';
import type {
  DemoEventRecord,
  DemoEventRecordCollection,
  DemoRepositoryEventItemType
} from '../models/events.model';

export class DemoEventsRepositoryBuilder {
  static buildRecordCollection(options: {
    invitationsByUser: Record<string, readonly InvitationMenuItem[]>;
    eventsByUser: Record<string, readonly EventMenuItem[]>;
    hostingByUser: Record<string, readonly HostingMenuItem[]>;
    publishedById?: Record<string, boolean>;
  }): DemoEventRecordCollection {
    const byId: Record<string, DemoEventRecord> = {};
    const ids: string[] = [];

    for (const [userId, items] of Object.entries(options.invitationsByUser)) {
      for (const item of items) {
        const recordKey = this.buildRecordKey(userId, 'invitations', item.id);
        byId[recordKey] = {
          id: item.id,
          userId,
          type: 'invitations',
          avatar: item.avatar,
          title: item.description,
          subtitle: item.inviter,
          timeframe: item.when,
          inviter: item.inviter,
          unread: item.unread,
          activity: 0,
          isAdmin: false,
          isInvitation: true,
          isHosting: false,
          isTrashed: false,
          published: true,
          trashedAtIso: null
        };
        ids.push(recordKey);
      }
    }

    for (const [userId, items] of Object.entries(options.eventsByUser)) {
      for (const item of items) {
        const recordKey = this.buildRecordKey(userId, 'events', item.id);
        byId[recordKey] = {
          id: item.id,
          userId,
          type: 'events',
          avatar: item.avatar,
          title: item.title,
          subtitle: item.shortDescription,
          timeframe: item.timeframe,
          inviter: null,
          unread: 0,
          activity: item.activity,
          isAdmin: item.isAdmin,
          isInvitation: false,
          isHosting: false,
          isTrashed: false,
          published: options.publishedById?.[item.id] !== false,
          trashedAtIso: null
        };
        ids.push(recordKey);
      }
    }

    for (const [userId, items] of Object.entries(options.hostingByUser)) {
      for (const item of items) {
        const recordKey = this.buildRecordKey(userId, 'hosting', item.id);
        byId[recordKey] = {
          id: item.id,
          userId,
          type: 'hosting',
          avatar: item.avatar,
          title: item.title,
          subtitle: item.shortDescription,
          timeframe: item.timeframe,
          inviter: null,
          unread: 0,
          activity: item.activity,
          isAdmin: true,
          isInvitation: false,
          isHosting: true,
          isTrashed: false,
          published: options.publishedById?.[item.id] !== false,
          trashedAtIso: null
        };
        ids.push(recordKey);
      }
    }

    return { byId, ids };
  }

  static cloneRecord(record: DemoEventRecord): DemoEventRecord {
    return { ...record };
  }

  static buildRecordKey(
    userId: string,
    type: DemoRepositoryEventItemType,
    sourceId: string
  ): string {
    return `${userId}:${type}:${sourceId}`;
  }
}
