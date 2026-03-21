import type { LocationCoordinates } from './location.interface';
import type { SubEventFormItem, SubEventsDisplayMode } from '../models';

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
  channelType?: 'general' | 'mainEvent' | 'optionalSubEvent' | 'groupSubEvent';
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
  startAt?: string;
  endAt?: string;
  distanceKm?: number;
  distanceMetersExact?: number;
  imageUrl?: string;
  sourceLink?: string;
  location?: string;
  locationCoordinates?: LocationCoordinates;
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
  topics?: string[];
  subEvents?: SubEventFormItem[];
  subEventsDisplayMode?: SubEventsDisplayMode;
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
  topics?: string[];
  subEvents?: SubEventFormItem[];
  subEventsDisplayMode?: SubEventsDisplayMode;
  rating?: number;
  relevance?: number;
  affinity?: number;
  ticketing?: boolean;
  published?: boolean;
}

export interface RateMenuItem {
  id: string;
  userId: string;
  secondaryUserId?: string;
  mode: 'individual' | 'pair';
  direction: 'given' | 'received' | 'mutual' | 'met';
  scoreGiven: number;
  scoreReceived: number;
  eventName: string;
  happenedAt: string;
  distanceKm: number;
  distanceMetersExact?: number;
}
