import { AppUtils } from '../../../app-utils';
import type { ChatMenuItem } from '../../../demo-data';
import type { DemoChatRecord, DemoChatRecordCollection } from '../models/chats.model';

export class DemoChatsRepositoryBuilder {
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
