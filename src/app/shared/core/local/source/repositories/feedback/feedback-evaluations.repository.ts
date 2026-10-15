import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../../common/app.db';
import type { AppMemorySchema } from '../../../common/memory.schema';
import { COMMUNITY_BASE_GROUP_ID } from '../../../../contracts/groups/group-type';
import { FEEDBACK_EVALUATIONS_TABLE_NAME, type FeedbackEvaluationBatch } from '../../entity/feedback/feedback.entity';

@Injectable({ providedIn: 'root' })
export class LocalFeedbackEvaluationsRepository {
  private readonly db = inject(LocalMemoryDb);
  rows() { const table = this.db.read()[FEEDBACK_EVALUATIONS_TABLE_NAME]; return table.ids.flatMap(id => table.byId[id].feedback); }
  save(id: string, feedback: FeedbackEvaluationBatch['feedback']): void {
    this.db.write(state => LocalFeedbackEvaluationsRepository.withCounterWrite(state, { id, feedback }));
  }
  private static withCounterWrite(state: AppMemorySchema, record: FeedbackEvaluationBatch): AppMemorySchema {
    const table = state[FEEDBACK_EVALUATIONS_TABLE_NAME], old = table.byId[record.id];
    const byId = { ...state.users.byId };
    const feedbackOwners: Record<string, number> = {};
    const feedbackBuckets: Record<string, Record<string, number>> = {};
    const contribute = (accountId: string, bucket: string) => {
      const values = feedbackBuckets[accountId] ??= {};
      values[bucket] = (values[bucket] ?? 0) + 1;
    };
    for (const feedback of record.feedback ?? []) {
      contribute(feedback.viewerAccountId, feedback.status);
      if (feedback.status === 'feedbacked') contribute(feedback.providerAccountId, 'received');
    }
    for (const id of new Set([...Object.keys(old?.feedbackCounterBuckets ?? {}), ...Object.keys(feedbackBuckets)])) {
      const user = byId[id];
      if (!user) continue;
      const values = { ...user.menuCounters };
      for (const bucket of ['pending', 'feedbacked', 'removed', 'received']) {
        const delta = (feedbackBuckets[id]?.[bucket] ?? 0) - (old?.feedbackCounterBuckets?.[id]?.[bucket] ?? 0);
        if (delta) values[`feedbackEvaluation_${bucket}`] = (values[`feedbackEvaluation_${bucket}`] ?? 0) + delta;
      }
      byId[id] = { ...user, menuCounters: values };
    }
    for (const feedback of record.feedback ?? []) if (feedback.status === 'pending')
      feedbackOwners[feedback.viewerAccountId] = (feedbackOwners[feedback.viewerAccountId] ?? 0) + 1;
    for (const id of new Set([...Object.keys(old?.feedbackCounterOwners ?? {}), ...Object.keys(feedbackOwners)])) {
      const profileId = `group:${COMMUNITY_BASE_GROUP_ID}:${id}`, user = byId[profileId];
      const delta = (feedbackOwners[id] ?? 0) - (old?.feedbackCounterOwners?.[id] ?? 0);
      const menuDelta = (feedbackOwners[id] ?? 0) - (old?.feedbackCounterBuckets ? old.feedbackCounterOwners?.[id] ?? 0 : 0);
      if (user && (delta || menuDelta)) byId[profileId] = { ...user, menuCounters: { ...user.menuCounters, feedback: (user.menuCounters?.['feedback'] ?? 0) + menuDelta },
        activities: { ...user.activities, feedback: (user.activities.feedback ?? 0) + delta } };
    }
    return { ...state, users: { ...state.users, byId }, [FEEDBACK_EVALUATIONS_TABLE_NAME]: {
      ids: old ? table.ids : [...table.ids, record.id],
      byId: { ...table.byId, [record.id]: { ...structuredClone(record), feedbackCounterOwners: feedbackOwners, feedbackCounterBuckets: feedbackBuckets } }
    } };
  }
}
