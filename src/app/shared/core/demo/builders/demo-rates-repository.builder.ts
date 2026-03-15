import type { RateMenuItem } from '../../../demo-data';
import type { DemoRateRecord, DemoRateRecordCollection } from '../models/rates.model';

export class DemoRatesRepositoryBuilder {
  static buildRecordCollection(itemsByUser: Record<string, readonly RateMenuItem[]>): DemoRateRecordCollection {
    const byId: Record<string, DemoRateRecord> = {};
    const ids: string[] = [];
    for (const [ownerUserId, items] of Object.entries(itemsByUser)) {
      for (const item of items) {
        const recordKey = this.buildRecordKey(ownerUserId, item.id);
        byId[recordKey] = {
          ...item,
          ownerUserId
        };
        ids.push(recordKey);
      }
    }
    return { byId, ids };
  }

  static cloneRecord(record: DemoRateRecord): DemoRateRecord {
    return { ...record };
  }

  static buildRecordKey(ownerUserId: string, sourceId: string): string {
    return `${ownerUserId}:${sourceId}`;
  }
}
