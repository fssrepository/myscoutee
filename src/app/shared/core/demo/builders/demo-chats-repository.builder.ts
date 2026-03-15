import type { ChatMenuItem } from '../../../demo-data';
import type { DemoChatRecord, DemoChatRecordCollection } from '../models/chats.model';

export class DemoChatsRepositoryBuilder {
  static buildRecordCollection(itemsByUser: Record<string, readonly ChatMenuItem[]>): DemoChatRecordCollection {
    const byId: Record<string, DemoChatRecord> = {};
    const ids: string[] = [];
    for (const [ownerUserId, items] of Object.entries(itemsByUser)) {
      for (const item of items) {
        const recordKey = this.buildRecordKey(ownerUserId, item.id);
        byId[recordKey] = {
          ...item,
          memberIds: [...item.memberIds],
          ownerUserId
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
}
