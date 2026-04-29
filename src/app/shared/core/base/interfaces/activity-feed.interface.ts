import type { LocationCoordinates } from './location.interface';
import type {
  EventRecordKind,
  EventPolicyItem,
  EventSlotOccurrence,
  EventSlotTemplate,
  PricingConfig,
  SubEventFormItem,
  SubEventsDisplayMode
} from '../models';

export interface ChatMenuItem {
  id: string;
  avatar: string;
  title: string;
  lastMessage: string;
  lastSenderId: string;
  memberIds: string[];
  unread: number;
  dateIso?: string;
  distanceKm?: number;
  distanceMetersExact?: number;
  channelType?: 'general' | 'mainEvent' | 'optionalSubEvent' | 'groupSubEvent' | 'serviceEvent';
  eventId?: string;
  subEventId?: string;
  groupId?: string;
}

export interface InvitationMenuItem {
  id: string;
  avatar: string;
  inviter: string;
  description: string;
  when: string;
  unread: number;
  acceptedMembers?: number;
  pendingMembers?: number;
  capacityTotal?: number;
  capacityMin?: number | null;
  capacityMax?: number | null;
  acceptedMemberUserIds?: string[];
  pendingMemberUserIds?: string[];
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

export interface EventMenuItem {
  id: string;
  avatar: string;
  title: string;
  shortDescription: string;
  timeframe: string;
  activity: number;
  isAdmin: boolean;
  creatorUserId?: string;
  startAt?: string;
  endAt?: string;
  distanceKm?: number;
  acceptedMembers?: number;
  pendingMembers?: number;
  capacityTotal?: number;
  acceptedMemberUserIds?: string[];
  pendingMemberUserIds?: string[];
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
  relevance?: number;
  affinity?: number;
  ticketing?: boolean;
  published?: boolean;
}

export interface HostingMenuItem {
  id: string;
  avatar: string;
  title: string;
  shortDescription: string;
  timeframe: string;
  activity: number;
  creatorUserId?: string;
  startAt?: string;
  endAt?: string;
  distanceKm?: number;
  acceptedMembers?: number;
  pendingMembers?: number;
  capacityTotal?: number;
  acceptedMemberUserIds?: string[];
  pendingMemberUserIds?: string[];
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
  relevance?: number;
  affinity?: number;
  ticketing?: boolean;
  published?: boolean;
  isAdmin?: boolean;
}

export interface RateMenuItem {
  id: string;
  userId: string;
  secondaryUserId?: string;
  mode: 'individual' | 'pair';
  direction: 'given' | 'received' | 'mutual' | 'met';
  socialContext?: 'separated-friends' | 'friends-in-common';
  bridgeUserId?: string;
  bridgeCount?: number;
  scoreGiven: number;
  scoreReceived: number;
  eventName: string;
  happenedAt: string;
  distanceKm: number;
  distanceMetersExact?: number;
}
