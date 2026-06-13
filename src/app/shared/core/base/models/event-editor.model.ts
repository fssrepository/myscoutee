import type { EventVisibility } from '../../common/constants';
import type { EventBlindMode, EventPolicyItem, EventSlotTemplate, SubEventsDisplayMode } from '../../contracts/event.interface';
import type { PricingConfig } from '../../contracts/pricing.interface';

export interface EventEditorSubEventGroupItem {
  id?: string;
  name?: string;
  source?: string;
  membersPending?: number;
  capacityMin?: number;
  capacityMax?: number;
}

export interface EventEditorSubEventItem {
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
  groups?: EventEditorSubEventGroupItem[];
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

export interface EventEditorDraftForm {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
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
  subEvents: EventEditorSubEventItem[];
  startAt: string;
  endAt: string;
}

export interface EventEditorFormState {
  form: EventEditorDraftForm;
  subEventsDisplayMode: SubEventsDisplayMode;
}
