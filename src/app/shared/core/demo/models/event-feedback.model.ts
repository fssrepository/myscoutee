import type { EventFeedbackPersistedState } from '../../base/models';

export const EVENT_FEEDBACK_TABLE_NAME = 'eventFeedback' as const;

export interface EventFeedbackRecordCollection {
  byId: Record<string, EventFeedbackPersistedState>;
  ids: string[];
}

export type DemoEventFeedbackMemorySchema = Record<typeof EVENT_FEEDBACK_TABLE_NAME, EventFeedbackRecordCollection>;
