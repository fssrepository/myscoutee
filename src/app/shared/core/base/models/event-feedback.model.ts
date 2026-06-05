import type { EventFeedbackPersistedState } from '.';
import { APP_INDEXED_DB_KEYS } from '../storage-scope';

export const EVENT_FEEDBACK_TABLE_NAME = APP_INDEXED_DB_KEYS.eventFeedback;

export interface EventFeedbackRecordCollection {
  byId: Record<string, EventFeedbackPersistedState>;
  ids: string[];
}

export type EventFeedbackMemorySchema = Record<typeof EVENT_FEEDBACK_TABLE_NAME, EventFeedbackRecordCollection>;
