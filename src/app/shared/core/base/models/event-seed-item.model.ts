import type { LocationCoordinates } from '../../contracts/user.interface';
import type {
  EventBlindMode,
  EventPolicyItem,
  EventRecordKind,
  EventSlotOccurrence,
  EventSlotTemplate,
  SubEventFormItem,
  SubEventsDisplayMode
} from '../../contracts/event.interface';
import type { ActivityPendingReason, EventVisibility } from '../../common/constants';
import type { PricingConfig } from '../../contracts/pricing.interface';

export interface ActivityInvitationSeedItem {
  id: string;
  status?: string;
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
  policies?: EventPolicyItem[];
}

export interface ActivityEventSeedItem {
  id: string;
  status?: string;
  avatar: string;
  title: string;
  shortDescription: string;
  timeframe: string;
  activity: number;
  isAdmin: boolean;
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
  slotTemplates?: EventSlotTemplate[];
  parentEventId?: string | null;
  slotTemplateId?: string | null;
  generated?: boolean;
  eventType?: EventRecordKind;
  nextSlot?: EventSlotOccurrence | null;
  upcomingSlots?: EventSlotOccurrence[];
  topics?: string[];
  subEvents?: SubEventFormItem[];
  subEventsDisplayMode?: SubEventsDisplayMode;
  policies?: EventPolicyItem[];
  rating?: number;
  boost?: number;
  affinity?: number;
  ticketing?: boolean;
  published?: boolean;
}

export interface ActivityHostingSeedItem extends Omit<ActivityEventSeedItem, 'isAdmin'> {
  isAdmin?: boolean;
}
