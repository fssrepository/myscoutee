import type { SubmittedFeedbackAnswer } from '../../../../contracts/feedback/feedback.interface';
import { APP_INDEXED_DB_KEYS } from '../../../../common/storage-scope';
import type { FeedbackEvaluation } from '../../../../contracts/feedback/feedback.interface';
export const FEEDBACK_EVALUATIONS_TABLE_NAME = 'feedbackEvaluations' as const;
export interface FeedbackEvaluationBatch {
  id: string;
  feedback: FeedbackEvaluation[];
  feedbackCounterOwners?: Record<string, number>;
  feedbackCounterBuckets?: Record<string, Record<string, number>>;
}
export interface FeedbackEvaluationsMemorySchema {
  [FEEDBACK_EVALUATIONS_TABLE_NAME]: { ids: string[]; byId: Record<string, FeedbackEvaluationBatch> };
}

export const FEEDBACK_STATES_TABLE_NAME = APP_INDEXED_DB_KEYS.feedbackStates;
export interface FeedbackStateRecord {
  id: string;
  userId: string;
  eventId: string;
  removed: boolean;
  submittedAtIso: string | null;
  removedAtIso?: string | null;
  organizerNote: string;
  answersByCardId: Record<string, SubmittedFeedbackAnswer>;
}

export interface FeedbackStateCollection {
  byId: Record<string, FeedbackStateRecord>;
  ids: string[];
}

export interface FeedbackStatRecord {
  eventId: string;
  viewerUserId: string;
  submittedAtIso: string;
  updatedAtIso: string;
  overallValue: string;
  improveValue: string;
  personalityTraitIds: string[];
}

export type FeedbackStatesMemorySchema = Record<typeof FEEDBACK_STATES_TABLE_NAME, FeedbackStateCollection>;

