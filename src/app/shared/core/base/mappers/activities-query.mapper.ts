import type * as ContractTypes from '../../contracts';
import type { ActivitiesFeedFilters, ActivitiesPageRequest, ActivityEventActivitiesQuery } from '../../contracts';
import type { ListQuery } from '../../../ui';

type ActivityChatContextFilterSource = Pick<ContractTypes.ChatDTO, 'channelType' | 'serviceContext'>;

export function toActivitiesPageRequest(query: ListQuery<ActivitiesFeedFilters>): ActivitiesPageRequest {
  const filters = query.filters;
  const primaryFilter = normalizeActivitiesPrimaryFilter((filters?.primaryFilter ?? 'chats') as ContractTypes.ActivitiesPrimaryFilter);
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
    adminServiceOnly: filters?.adminServiceOnly === true,
    supportCaseFilter: normalizeSupportCaseFilter(filters?.supportCaseFilter),
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

export function toActivityEventActivitiesQuery(
  request: ActivitiesPageRequest,
  userId: string
): ActivityEventActivitiesQuery {
  return {
    userId,
    filter: request.eventScopeFilter ?? 'active-events',
    hostingPublicationFilter: request.hostingPublicationFilter,
    secondaryFilter: request.secondaryFilter,
    sort: normalizeActivityEventActivitiesSort(request.sort),
    view: request.view,
    limit: request.pageSize,
    cursor: request.cursor ?? null,
    anchorDate: request.anchorDate,
    rangeStart: request.rangeStart,
    rangeEnd: request.rangeEnd
  };
}

function normalizeActivitiesPrimaryFilter(filter: ContractTypes.ActivitiesPrimaryFilter): ContractTypes.ActivitiesPrimaryFilter {
  if (filter === 'hosting' || filter === 'invitations') {
    return 'events';
  }
  return filter;
}

function normalizeActivitiesEventScopeFilter(value: unknown): ContractTypes.ActivitiesEventScope {
  return value === 'all'
    || value === 'pending'
    || value === 'invitations'
    || value === 'my-events'
    || value === 'drafts'
    || value === 'trash'
    ? value
    : 'active-events';
}

function normalizeActivitiesSecondaryFilter(
  value: unknown,
  primaryFilter?: ContractTypes.ActivitiesPrimaryFilter
): ContractTypes.ActivitiesSecondaryFilter {
  const normalized = value === 'relevant' || value === 'past' ? value : 'recent';
  return primaryFilter === 'events' && normalized === 'relevant'
    ? 'recent'
    : normalized;
}

function normalizeActivitiesChatContextFilter(value: unknown): ContractTypes.ActivitiesChatContextFilter {
  return value === 'event' || value === 'subEvent' || value === 'group' || value === 'service' ? value : 'all';
}

function normalizeSupportCaseFilter(value: unknown): ContractTypes.SupportCaseFilter {
  return value === 'pending' || value === 'picked' || value === 'solved' || value === 'blocked' ? value : 'all';
}

function normalizeHostingPublicationFilter(value: unknown): ContractTypes.HostingPublicationFilter {
  return value === 'drafts' ? 'drafts' : 'all';
}

function normalizeRateFilter(value: unknown): ContractTypes.RateFilterKey {
  return value === 'individual-received'
    || value === 'individual-mutual'
    || value === 'individual-met'
    || value === 'pair-given'
    || value === 'pair-received'
    ? value
    : 'individual-given';
}

function normalizeActivitiesView(value: unknown): ContractTypes.ActivitiesView {
  return value === 'week' || value === 'month' || value === 'distance' ? value : 'day';
}

export function activityChatContextFilterKey(
  item: ActivityChatContextFilterSource
): ContractTypes.ActivitiesChatContextFilter {
  if (item.channelType === 'serviceEvent' || item.serviceContext) {
    return 'service';
  }
  if (item.channelType === 'groupSubEvent') {
    return 'group';
  }
  if (item.channelType === 'optionalSubEvent') {
    return 'subEvent';
  }
  if (item.channelType === 'mainEvent') {
    return 'event';
  }
  return 'all';
}

function resolveActivitiesPageSort(
  primaryFilter: ContractTypes.ActivitiesPrimaryFilter,
  secondaryFilter: ContractTypes.ActivitiesSecondaryFilter,
  view: ContractTypes.ActivitiesView
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
  primaryFilter: ContractTypes.ActivitiesPrimaryFilter,
  secondaryFilter: ContractTypes.ActivitiesSecondaryFilter,
  view: ContractTypes.ActivitiesView
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

function normalizeActivityEventActivitiesSort(value: string | undefined): ContractTypes.ActivityEventActivitiesSort {
  return value === 'distance' || value === 'relevance' ? value : 'date';
}
