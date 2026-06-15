import type { EventVisibility, UserGender } from '../../core/common/constants';
import type { ActivityEventStatus } from '../../core/contracts/activity.interface';
import type { EventBlindMode, EventPolicyItem, EventRecordKind, EventSlotTemplate, SubEventsDisplayMode } from '../../core/contracts/event.interface';
import type { PricingConfig } from '../../core/contracts/pricing.interface';
import type { LocationCoordinates } from '../../core/contracts/user.interface';

export interface EventFormSubEventGroupItem {
  id?: string;
  name?: string;
  source?: string;
  membersPending?: number;
  capacityMin?: number;
  capacityMax?: number;
}

export interface EventFormSubEventItem {
  description?: string;
  id?: string;
  name?: string;
  title?: string;
  location?: string;
  optional?: boolean;
  startAt?: string;
  endAt?: string;
  capacityMin?: number;
  capacityMax?: number;
  groups?: EventFormSubEventGroupItem[];
  membersPending?: number;
  membersAccepted?: number;
  pricing?: PricingConfig | null;
  carsPending?: number;
  accommodationPending?: number;
  suppliesPending?: number;
  slotStartOffsetMinutes?: number;
  slotDurationMinutes?: number;
  [key: string]: unknown;
}

export interface EventForm {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  activity?: number;
  isAdmin?: boolean;
  distanceKm?: number;
  status?: ActivityEventStatus;
  creatorUserId?: string;
  creatorName?: string;
  creatorInitials?: string;
  creatorGender?: UserGender;
  creatorCity?: string;
  locationCoordinates?: LocationCoordinates | null;
  sourceLink?: string;
  parentEventId?: string | null;
  slotTemplateId?: string | null;
  generated?: boolean;
  eventType?: EventRecordKind;
  visibility: EventVisibility;
  frequency: string;
  location: string;
  capacityMin: number | null;
  capacityMax: number | null;
  blindMode: EventBlindMode;
  autoInviter: boolean;
  ticketing: boolean;
  pricing: PricingConfig;
  policies: EventPolicyItem[];
  topics: string[];
  slotsEnabled: boolean;
  slotTemplates: EventSlotTemplate[];
  subEvents: EventFormSubEventItem[];
  subEventsDisplayMode?: SubEventsDisplayMode;
  startAt: string;
  endAt: string;
}
