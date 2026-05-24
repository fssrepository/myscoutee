import type { LocationCoordinates } from '../../base/interfaces/location.interface';
import type {
  EventPolicyItem,
  EventRecordKind,
  EventSlotOccurrence,
  EventSlotTemplate,
  PricingConfig,
  SubEventFormItem,
  SubEventsDisplayMode
} from '../../base/models';

export interface DemoInvitationSeedItem {
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
  pendingReason?: 'approval' | 'waitlist' | null;
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

export interface DemoEventSeedItem {
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
  pendingReason?: 'approval' | 'waitlist' | null;
  visibility?: 'Public' | 'Friends only' | 'Invitation only';
  blindMode?: 'Open Event' | 'Blind Event';
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

export interface DemoHostingSeedItem extends Omit<DemoEventSeedItem, 'isAdmin'> {
  isAdmin?: boolean;
}
