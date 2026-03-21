import type {
  ChatMenuItem,
  EventMenuItem,
  HostingMenuItem,
  InvitationMenuItem,
  RateMenuItem
} from '../interfaces/activity-feed.interface';

export type ActivitiesPrimaryFilter = 'chats' | 'invitations' | 'events' | 'hosting' | 'rates';
export type ActivitiesEventScope = 'all' | 'active-events' | 'invitations' | 'my-events' | 'drafts' | 'trash';
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

export interface ActivityRateDisplayUser {
  id: string;
  name: string;
  age: number;
  city: string;
  gender: 'woman' | 'man';
}

export interface ActivityRateDisplaySlide {
  imageUrl: string;
  primaryLine?: string;
  secondaryLine?: string;
  placeholderLabel?: string;
}

export interface ActivityRateDisplaySlot {
  key: 'woman' | 'man';
  label: string;
  tone?: 'woman' | 'man';
  slides: ActivityRateDisplaySlide[];
}

export interface ActivityRateDisplay {
  primaryUser: ActivityRateDisplayUser | null;
  imageUrls: string[];
  happenedOnLabel: string;
  pairSlots: ActivityRateDisplaySlot[];
}

export interface ActivityListRow {
  id: string;
  type: ActivitiesPrimaryFilter;
  title: string;
  subtitle: string;
  detail: string;
  dateIso: string;
  distanceKm: number;
  distanceMetersExact?: number;
  unread: number;
  metricScore: number;
  isAdmin?: boolean;
  rateDisplay?: ActivityRateDisplay | null;
  source: ChatMenuItem | InvitationMenuItem | EventMenuItem | HostingMenuItem | RateMenuItem;
}

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

export interface EventExploreCard {
  id: string;
  title: string;
  subtitle: string;
  timeframe: string;
  imageUrl: string;
  distanceKm: number;
  relevance: number;
  rating: number;
  startSort: number;
  isPast: boolean;
  sourceType: 'event' | 'hosting';
}

export interface EventExploreGroup {
  label: string;
  cards: EventExploreCard[];
}

