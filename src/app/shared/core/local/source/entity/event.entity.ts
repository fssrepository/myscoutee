import type { SubmittedEventFeedbackAnswer } from '../../../contracts/activity.interface';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

export const EVENT_FEEDBACK_TABLE_NAME = APP_INDEXED_DB_KEYS.eventFeedback;
export const EVENTS_TABLE_NAME = APP_INDEXED_DB_KEYS.events;

export interface EventFeedbackPersistedState {
  id: string;
  userId: string;
  eventId: string;
  removed: boolean;
  submittedAtIso: string | null;
  removedAtIso?: string | null;
  organizerNote: string;
  answersByCardId: Record<string, SubmittedEventFeedbackAnswer>;
}

export interface EventFeedbackRecordCollection {
  byId: Record<string, EventFeedbackPersistedState>;
  ids: string[];
}

export type EventFeedbackMemorySchema = Record<typeof EVENT_FEEDBACK_TABLE_NAME, EventFeedbackRecordCollection>;

export interface ActivityEventRecordCollection {
  byId: Record<string, ActivityEventRecord>;
  ids: string[];
}

export type ActivityEventsMemorySchema = Record<typeof EVENTS_TABLE_NAME, ActivityEventRecordCollection>;
