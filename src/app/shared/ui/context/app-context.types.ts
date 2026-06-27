import type {
  EventFeedbackDetailDto,
  UserGameFilterPreferencesDto
} from '../../core/contracts/activity.interface';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error' | 'timeout';
export type ActivityCounterKey =
  | 'game'
  | 'chat'
  | 'invitations'
  | 'events'
  | 'hosting'
  | 'cars'
  | 'accommodation'
  | 'supplies'
  | 'tickets'
  | 'contacts'
  | 'feedback'
  | 'adminJobs'
  | 'adminMetrics';
export type ConnectivityState = 'online' | 'offline';

export interface ActivityCounters {
  game: number;
  chat: number;
  invitations: number;
  events: number;
  hosting: number;
  cars: number;
  accommodation: number;
  supplies: number;
  tickets: number;
  contacts: number;
  feedback: number;
  event?: ActivityEventCounters;
  asset?: ActivityAssetCounters;
  eventFeedback?: ActivityEventFeedbackCounters;
  adminJobs: number;
  adminMetrics: number;
}

export interface ActivityEventCounters {
  all: number;
  active: number;
  pending: number;
  invitations: number;
  hosting: number;
  drafts: number;
  trash: number;
}

export interface ActivityAssetCounters {
  cars: number;
  accommodation: number;
  supplies: number;
  tickets: number;
}

export interface ActivityEventFeedbackCounters {
  ownEvents: number;
  pending: number;
  feedbacked: number;
  removed: number;
}

export interface LoadState {
  status: LoadStatus;
  error: string | null;
  loadedAtIso: string | null;
}

export interface UserImpressionChangeFlags {
  host: boolean;
  member: boolean;
}

export interface ActivityMembersSyncState {
  updatedMs: number;
  id: string;
  acceptedMembers: number;
  pendingMembers: number;
  capacityTotal: number;
}

export interface ActivityResourceSyncState {
  updatedMs: number;
  ownerId: string;
  subEventId: string;
  assetOwnerUserId: string;
}

export interface ActivityEventFeedbackSubmitSyncState {
  updatedMs: number;
  dto: EventFeedbackDetailDto;
}

export interface AppContextAdminUserDto {
  id: string;
  name: string;
  initials: string;
  email: string;
  headline?: string | null;
  about?: string | null;
  images?: string[] | null;
}

export const DEFAULT_LOAD_STATE: LoadState = {
  status: 'idle',
  error: null,
  loadedAtIso: null
};

export const DEFAULT_USER_IMPRESSION_CHANGE_FLAGS: UserImpressionChangeFlags = {
  host: false,
  member: false
};

export const ACTIVITY_COUNTER_KEYS: ActivityCounterKey[] = [
  'game',
  'chat',
  'invitations',
  'events',
  'hosting',
  'cars',
  'accommodation',
  'supplies',
  'tickets',
  'contacts',
  'feedback',
  'adminJobs',
  'adminMetrics'
];

export type { UserGameFilterPreferencesDto };
