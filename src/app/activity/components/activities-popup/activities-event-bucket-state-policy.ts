import type {
  ActivitiesEventScope,
  ActivitiesPrimaryFilter
} from '../../../shared/core/contracts/activity.interface';

export interface ActivitiesEventBucketLoadContext {
  currentPrimaryFilter: ActivitiesPrimaryFilter;
  currentEventScope: ActivitiesEventScope;
  queryPrimaryFilter: ActivitiesPrimaryFilter;
  queryEventScope: ActivitiesEventScope;
  aborted: boolean;
  currentView: string | null;
}

export function shouldApplyActivitiesEventBucketLoad(
  context: ActivitiesEventBucketLoadContext
): boolean {
  return !context.aborted
    && context.currentView !== 'week'
    && context.currentView !== 'month'
    && context.currentPrimaryFilter === 'events'
    && context.queryPrimaryFilter === context.currentPrimaryFilter
    && context.queryEventScope === context.currentEventScope;
}
