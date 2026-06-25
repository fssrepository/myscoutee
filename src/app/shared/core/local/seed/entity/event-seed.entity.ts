import type { LocationCoordinates } from '../../../contracts/user.interface';
import type { ActivityEventStatus, SubEventDefinitionDTO } from '../../../contracts/activity.interface';
import type {
  EventBlindMode,
  EventPolicyDTO,
  EventRecordKind,
  EventSlotOccurrenceDTO,
  EventSlotTemplateDTO,
  SubEventDTO,
  EventMode
} from '../../../contracts/event.interface';
import type { ActivityPendingReason, EventVisibility } from '../../../common/constants';
import type { PricingConfig } from '../../../contracts/pricing.interface';

export interface ActivityInvitationSeedItem {
  id: string;
  status?: ActivityEventStatus;
  avatar: string;
  inviter: string;
  description: string;
  when: string;
  unread: number;
  creatorUserId?: string;
  creatorName?: string;
  acceptedMembers?: number;
  pendingMembers?: number;
  capacityTotal?: number;
  capacityMin?: number | null;
  capacityMax?: number | null;
  acceptedMemberUserIds?: string[];
  pendingMemberUserIds?: string[];
  pendingReason?: ActivityPendingReason;
  startAt?: string;
  endAt?: string;
  distanceKm?: number;
  distanceMetersExact?: number;
  imageUrl?: string;
  sourceLink?: string;
  location?: string;
  locationCoordinates?: LocationCoordinates;
  policies?: EventPolicyDTO[];
}

export interface ActivityEventSeedItem {
  id: string;
  status?: ActivityEventStatus;
  avatar: string;
  title: string;
  shortDescription: string;
  timeframe: string;
  activity: number;
  isAdmin?: boolean;
  adminIds?: string[];
  creatorUserId?: string;
  creatorName?: string;
  startAt?: string;
  endAt?: string;
  distanceKm?: number;
  acceptedMembers?: number;
  pendingMembers?: number;
  capacityTotal?: number;
  acceptedMemberUserIds?: string[];
  pendingMemberUserIds?: string[];
  pendingReason?: ActivityPendingReason;
  visibility?: EventVisibility;
  blindMode?: EventBlindMode;
  imageUrl?: string;
  sourceLink?: string;
  location?: string;
  locationCoordinates?: LocationCoordinates;
  capacityMin?: number | null;
  capacityMax?: number | null;
  autoInviter?: boolean;
  frequency?: string;
  pricing?: PricingConfig | null;
  slotsEnabled?: boolean;
  slotTemplates?: EventSlotTemplateDTO[];
  parentEventId?: string | null;
  slotTemplateId?: string | null;
  generated?: boolean;
  eventType?: EventRecordKind;
  nextSlot?: EventSlotOccurrenceDTO | null;
  upcomingSlots?: EventSlotOccurrenceDTO[];
  topics?: string[];
  subEventsEnabled?: boolean;
  subEventDefinitions?: SubEventDefinitionDTO[];
  subEvents?: SubEventDTO[];
  mode?: EventMode;
  policies?: EventPolicyDTO[];
  rating?: number;
  boost?: number;
  affinity?: number;
  ticketing?: boolean;
}

export interface ActivityHostingSeedItem extends ActivityEventSeedItem {}
