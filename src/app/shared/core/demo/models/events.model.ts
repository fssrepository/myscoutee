import type * as AppTypes from '../../../app-types';
import type { LocationCoordinates } from '../../base/interfaces';

export const EVENTS_TABLE_NAME = 'events' as const;

export type DemoEventScopeFilter =
  | 'all'
  | 'active-events'
  | 'invitations'
  | 'my-events'
  | 'drafts'
  | 'trash';

export type DemoRepositoryEventItemType = 'events' | 'hosting' | 'invitations';

export interface DemoEventRecord {
  id: string;
  userId: string;
  type: DemoRepositoryEventItemType;
  avatar: string;
  title: string;
  subtitle: string;
  timeframe: string;
  inviter: string | null;
  unread: number;
  activity: number;
  isAdmin: boolean;
  isInvitation: boolean;
  isHosting: boolean;
  isTrashed: boolean;
  published: boolean;
  trashedAtIso: string | null;
  creatorUserId: string;
  creatorName: string;
  creatorInitials: string;
  creatorGender: 'woman' | 'man';
  creatorCity: string;
  visibility: AppTypes.EventVisibility;
  blindMode: AppTypes.EventBlindMode;
  startAtIso: string;
  endAtIso: string;
  distanceKm: number;
  imageUrl: string;
  sourceLink: string;
  location: string;
  locationCoordinates: LocationCoordinates | null;
  capacityMin: number | null;
  capacityMax: number | null;
  capacityTotal: number;
  acceptedMembers: number;
  pendingMembers: number;
  acceptedMemberUserIds: string[];
  pendingMemberUserIds: string[];
  topics: string[];
  rating: number;
  relevance: number;
}

export interface DemoEventRecordCollection {
  byId: Record<string, DemoEventRecord>;
  ids: string[];
}

export type DemoEventsMemorySchema = Record<typeof EVENTS_TABLE_NAME, DemoEventRecordCollection>;
