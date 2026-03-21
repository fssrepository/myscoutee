import { AppUtils } from '../../../app-utils';
import type { ChatMenuItem } from '../../base/interfaces/activity-feed.interface';
import type { DemoChatRecord, DemoChatRecordCollection } from '../models/chats.model';

const SEED_CHAT_ITEMS_BY_USER: Record<string, ChatMenuItem[]> = {
  u1: [
    {
      id: 'c1',
      avatar: 'MS',
      title: 'Driver Split - Alpine Weekend',
      lastMessage: 'I can take one extra seat from downtown pickup.',
      lastSenderId: 'u5',
      memberIds: ['u5', 'u4', 'u10', 'u7'],
      unread: 5
    },
    {
      id: 'c2',
      avatar: 'NH',
      title: 'Padel Night Pair Room',
      lastMessage: 'Pair mode starts in 20 mins.',
      lastSenderId: 'u7',
      memberIds: ['u7', 'u6', 'u10', 'u3', 'u11'],
      unread: 2
    },
    {
      id: 'c3',
      avatar: 'LH',
      title: 'Host Circle Ops',
      lastMessage: '2 invites timed out. Should we rerun now?',
      lastSenderId: 'u10',
      memberIds: ['u10', 'u12', 'u8'],
      unread: 1
    }
  ],
  u2: [
    {
      id: 'c4',
      avatar: 'IB',
      title: 'City Brunch - Main Room',
      lastMessage: 'Table booked for 12:30.',
      lastSenderId: 'u6',
      memberIds: ['u6', 'u4', 'u1'],
      unread: 2
    }
  ],
  u3: [
    {
      id: 'c5',
      avatar: 'LP',
      title: 'Trail Group - Transport',
      lastMessage: 'Need one more car seat.',
      lastSenderId: 'u5',
      memberIds: ['u5', 'u7', 'u10', 'u1'],
      unread: 4
    }
  ]
};

export class DemoChatsRepositoryBuilder {
  static buildSeedRecordCollection(): DemoChatRecordCollection {
    return this.buildRecordCollection(
      Object.fromEntries(
        Object.entries(SEED_CHAT_ITEMS_BY_USER).map(([ownerUserId, items]) => [
          ownerUserId,
          items.map(item => ({
            ...item,
            memberIds: [...item.memberIds]
          }))
        ])
      )
    );
  }

  static buildRecordCollection(itemsByUser: Record<string, readonly ChatMenuItem[]>): DemoChatRecordCollection {
    const byId: Record<string, DemoChatRecord> = {};
    const ids: string[] = [];
    for (const [ownerUserId, items] of Object.entries(itemsByUser)) {
      for (const item of items) {
        const recordKey = this.buildRecordKey(ownerUserId, item.id);
        const dateIso = this.buildDateIso(ownerUserId, item);
        const distanceKm = this.buildDistanceKm(ownerUserId, item);
        byId[recordKey] = {
          ...item,
          memberIds: [...item.memberIds],
          ownerUserId,
          dateIso,
          distanceKm,
          distanceMetersExact: Math.max(0, Math.round(distanceKm * 1000))
        };
        ids.push(recordKey);
      }
    }
    return { byId, ids };
  }

  static cloneRecord(record: DemoChatRecord): DemoChatRecord {
    return {
      ...record,
      memberIds: [...record.memberIds]
    };
  }

  static buildRecordKey(ownerUserId: string, sourceId: string): string {
    return `${ownerUserId}:${sourceId}`;
  }

  private static buildDateIso(ownerUserId: string, item: ChatMenuItem): string {
    const seed = AppUtils.hashText(`chat-date:${ownerUserId}:${item.id}:${item.title}`);
    const value = new Date('2026-02-21T09:00:00');
    value.setDate(value.getDate() + (seed % 9));
    value.setHours(8 + (seed % 11), (seed % 4) * 15, 0, 0);
    return AppUtils.toIsoDateTime(value);
  }

  private static buildDistanceKm(ownerUserId: string, item: ChatMenuItem): number {
    return 2 + (AppUtils.hashText(`chat-distance:${ownerUserId}:${item.id}:${item.title}`) % 18);
  }
}
