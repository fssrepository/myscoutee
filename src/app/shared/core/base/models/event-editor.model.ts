import type { EventBlindMode, EventVisibility, SubEventsDisplayMode } from './event.model';

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
  carsPending?: number;
  accommodationPending?: number;
  suppliesPending?: number;
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
  topics: string[];
  subEvents: EventEditorSubEventItem[];
  startAt: string;
  endAt: string;
}

export interface EventEditorFormState {
  form: EventEditorDraftForm;
  subEventsDisplayMode: SubEventsDisplayMode;
}
