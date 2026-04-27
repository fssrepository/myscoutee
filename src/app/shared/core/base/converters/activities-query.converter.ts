import type * as AppTypes from '../../../core/base/models';
import type { ActivitiesFeedFilters, ActivitiesPageRequest } from '../models';
import type { ListQuery } from '../../../ui';

export function toActivitiesPageRequest(query: ListQuery<ActivitiesFeedFilters>): ActivitiesPageRequest {
  const filters = query.filters;
  const primaryFilter = normalizeActivitiesPrimaryFilter((filters?.primaryFilter ?? 'chats') as AppTypes.ActivitiesPrimaryFilter);
  const secondaryFilter = normalizeActivitiesSecondaryFilter(filters?.secondaryFilter, primaryFilter);
  const view = normalizeActivitiesView(query.view);

  return {
    primaryFilter,
    eventScopeFilter: normalizeActivitiesEventScopeFilter(filters?.eventScopeFilter),
    secondaryFilter,
    chatContextFilter: normalizeActivitiesChatContextFilter(filters?.chatContextFilter),
    hostingPublicationFilter: normalizeHostingPublicationFilter(filters?.hostingPublicationFilter),
    rateFilter: normalizeRateFilter(filters?.rateFilter),
    rateSocialBadgeEnabled: filters?.rateSocialBadgeEnabled === true,
    view,
    page: Math.max(0, Math.trunc(query.page)),
    pageSize: Math.max(1, Math.trunc(query.pageSize)),
    cursor: query.cursor ?? null,
    sort: resolveActivitiesPageSort(primaryFilter, secondaryFilter, view),
    direction: resolveActivitiesPageSortDirection(primaryFilter, secondaryFilter, view),
    groupBy: query.groupBy,
    anchorDate: query.anchorDate,
    rangeStart: query.rangeStart,
    rangeEnd: query.rangeEnd
  };
}

function normalizeActivitiesPrimaryFilter(filter: AppTypes.ActivitiesPrimaryFilter): AppTypes.ActivitiesPrimaryFilter {
  if (filter === 'hosting' || filter === 'invitations') {
    return 'events';
  }
  return filter;
}

function normalizeActivitiesEventScopeFilter(value: unknown): AppTypes.ActivitiesEventScope {
  return value === 'all'
    || value === 'invitations'
    || value === 'my-events'
    || value === 'drafts'
    || value === 'trash'
    ? value
    : 'active-events';
}

function normalizeActivitiesSecondaryFilter(
  value: unknown,
  primaryFilter?: AppTypes.ActivitiesPrimaryFilter
): AppTypes.ActivitiesSecondaryFilter {
  const normalized = value === 'relevant' || value === 'past' ? value : 'recent';
  return primaryFilter === 'events' && normalized === 'relevant'
    ? 'recent'
    : normalized;
}

function normalizeActivitiesChatContextFilter(value: unknown): AppTypes.ActivitiesChatContextFilter {
  return value === 'event' || value === 'subEvent' || value === 'group' ? value : 'all';
}

function normalizeHostingPublicationFilter(value: unknown): AppTypes.HostingPublicationFilter {
  return value === 'drafts' ? 'drafts' : 'all';
}

function normalizeRateFilter(value: unknown): AppTypes.RateFilterKey {
  return value === 'individual-received'
    || value === 'individual-mutual'
    || value === 'individual-met'
    || value === 'pair-given'
    || value === 'pair-received'
    ? value
    : 'individual-given';
}

function normalizeActivitiesView(value: unknown): AppTypes.ActivitiesView {
  return value === 'week' || value === 'month' || value === 'distance' ? value : 'day';
}

function resolveActivitiesPageSort(
  primaryFilter: AppTypes.ActivitiesPrimaryFilter,
  secondaryFilter: AppTypes.ActivitiesSecondaryFilter,
  view: AppTypes.ActivitiesView
): string {
  if (primaryFilter === 'rates') {
    if (view === 'distance') {
      return 'distance';
    }
    if (secondaryFilter === 'relevant') {
      return 'relevance';
    }
    return 'happenedAt';
  }

  if (primaryFilter === 'events') {
    if (view === 'distance') {
      return 'distance';
    }
    if (secondaryFilter === 'relevant') {
      return 'relevance';
    }
    return 'date';
  }

  return view === 'distance' ? 'distance' : 'date';
}

function resolveActivitiesPageSortDirection(
  primaryFilter: AppTypes.ActivitiesPrimaryFilter,
  secondaryFilter: AppTypes.ActivitiesSecondaryFilter,
  view: AppTypes.ActivitiesView
): 'asc' | 'desc' {
  if (primaryFilter === 'rates') {
    if (view === 'distance') {
      return 'asc';
    }
    if (secondaryFilter === 'relevant') {
      return 'desc';
    }
    return 'desc';
  }

  if (primaryFilter === 'events') {
    if (view === 'distance') {
      return 'asc';
    }
    if (secondaryFilter === 'past') {
      return 'desc';
    }
    if (secondaryFilter === 'relevant') {
      return 'asc';
    }
    return 'asc';
  }

  return view === 'distance' ? 'asc' : 'desc';
}
