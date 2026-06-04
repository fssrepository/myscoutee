import type { EventFeedbackPersistedState } from '../../base/models';
import { APP_INDEXED_DB_KEYS } from '../../base/storage-scope';

export const EVENT_FEEDBACK_TABLE_NAME = APP_INDEXED_DB_KEYS.eventFeedback;

export interface EventFeedbackRecordCollection {
  byId: Record<string, EventFeedbackPersistedState>;
  ids: string[];
}

export type DemoEventFeedbackMemorySchema = Record<typeof EVENT_FEEDBACK_TABLE_NAME, EventFeedbackRecordCollection>;
