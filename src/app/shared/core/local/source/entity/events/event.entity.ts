import type { ActivityEventRecord } from '../../../../contracts/common/activity.interface';
import { APP_INDEXED_DB_KEYS } from '../../../../common/storage-scope';

export const EVENTS_TABLE_NAME = APP_INDEXED_DB_KEYS.events;

export interface ActivityEventRecordCollection {
  byId: Record<string, ActivityEventRecord>;
  ids: string[];
}

export type ActivityEventsMemorySchema = Record<typeof EVENTS_TABLE_NAME, ActivityEventRecordCollection>;
