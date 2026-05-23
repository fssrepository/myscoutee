import type { ImageCardData, InfoCardData, SingleRowData } from '../../../ui';
import type { EventVisibility } from './event.model';

export type ActivitiesPrimaryFilter = 'chats' | 'invitations' | 'events' | 'hosting' | 'rates';
export type ActivitiesEventScope = 'all' | 'active-events' | 'pending' | 'invitations' | 'my-events' | 'drafts' | 'trash';
export type ActivitiesSecondaryFilter = 'recent' | 'relevant' | 'past';
export type HostingPublicationFilter = 'all' | 'drafts';
export type ActivitiesView = 'month' | 'week' | 'day' | 'distance';
export type EventExploreView = 'day' | 'distance';
export type EventExploreOrder = 'upcoming' | 'past-events' | 'nearby' | 'most-relevant' | 'top-rated';
export type RateFilterKey =
  | 'individual-given'
  | 'individual-received'
  | 'individual-mutual'
  | 'individual-met'
  | 'pair-given'
  | 'pair-received';

export type RateFilterEntry =
  | { kind: 'group'; label: string }
  | { kind: 'item'; key: RateFilterKey; label: string };

export interface ActivityListItemBase<TDetailRecord = unknown> {
  id: string;
  type: ActivitiesPrimaryFilter;
  title: string;
  subtitle?: string | null;
  detail?: string | null;
  dateIso: string;
  distanceMetersExact?: number;
  unread: number;
  metricScore: number;
  isAdmin?: boolean;
  detailRecord?: TDetailRecord | null;
  startAt?: string | null;
  endAt?: string | null;
  boost?: number | null;
  imageUrl?: string | null;
  visibility?: EventVisibility | null;
  avatarInitials?: string | null;
  creatorInitials?: string | null;
  acceptedMembers?: number | null;
  pendingMembers?: number | null;
  capacityTotal?: number | null;
  capacityMin?: number | null;
  capacityMax?: number | null;
  isTrashed?: boolean;
  published?: boolean;
  memberCount?: number | null;
}

export type ActivityInfoCardRow<TDetailRecord = unknown> =
  InfoCardData<TDetailRecord>
  & ActivityListItemBase<TDetailRecord>
  & { type: 'events' | 'hosting' | 'invitations'; subtitle: string; detail: string };

export type ActivityImageCardRow<TDetailRecord = unknown> =
  ImageCardData<TDetailRecord>
  & ActivityListItemBase<TDetailRecord>
  & { type: 'rates'; subtitle: string; detail: string };

export type ActivitySingleRow<TDetailRecord = unknown> =
  SingleRowData<TDetailRecord>
  & ActivityListItemBase<TDetailRecord>
  & { type: 'chats'; subtitle: string; detail: string };

export type ActivityListRow<TDetailRecord = unknown> =
  | ActivityInfoCardRow<TDetailRecord>
  | ActivityImageCardRow<TDetailRecord>
  | ActivitySingleRow<TDetailRecord>;

export interface ActivityGroup {
  label: string;
  rows: ActivityListRow[];
}

export interface CalendarDayCell {
  key: string;
  date: Date;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  rows: ActivityListRow[];
}

export interface CalendarMonthPage {
  key: string;
  label: string;
  weeks: CalendarMonthWeek[];
}

export interface CalendarMonthWeek {
  start: Date;
  end: Date;
  days: CalendarDayCell[];
  spans: CalendarMonthSpan[];
}

export interface CalendarMonthSpan {
  key: string;
  row: ActivityListRow;
  startCol: number;
  endCol: number;
  lane: number;
}

export interface CalendarWeekPage {
  key: string;
  label: string;
  days: CalendarDayCell[];
}

export interface ActivityDateTimeRange {
  startIso: string;
  endIso: string;
}

export interface CalendarTimedBadge {
  row: ActivityListRow;
  topPct: number;
  heightPct: number;
}
