import type { PricingConfig } from './pricing.model';

export interface EventFeedbackOption {
  value: string;
  label: string;
  icon: string;
  impressionTag?: string;
}

export interface EventFeedbackTraitOption {
  id: string;
  label: string;
  icon: string;
  coreVibe: string;
}

export interface EventFeedbackCard {
  id: string;
  eventId: string;
  kind: 'event' | 'attendee';
  attendeeUserId?: string;
  targetUserId?: string;
  targetRole?: 'Admin' | 'Manager' | 'Member';
  icon: string;
  imageUrl: string;
  toneClass: string;
  heading: string;
  subheading: string;
  identityTitle?: string;
  identitySubtitle?: string;
  identityStatusClass?: string;
  identityStatusIcon?: string;
  questionPrimary: string;
  questionSecondary: string;
  primaryOptions: EventFeedbackOption[];
  secondaryOptions: EventFeedbackOption[];
  traitQuestion: string;
  traitOptions: EventFeedbackTraitOption[];
  selectedTraitIds: string[];
  answerPrimary: string;
  answerSecondary: string;
}

export interface SubmittedEventFeedbackAnswer {
  cardId: string;
  eventId: string;
  kind: 'event' | 'attendee';
  targetUserId: string | null;
  targetRole: 'Admin' | 'Manager' | 'Member';
  primaryValue: string;
  secondaryValue: string;
  personalityTraitIds: string[];
  tags: string[];
  submittedAtIso: string;
}

export interface EventFeedbackStateDto {
  eventId: string;
  removed: boolean;
  submittedAtIso: string;
  organizerNote: string;
  answersByCardId?: Record<string, SubmittedEventFeedbackAnswer>;
}

export interface EventFeedbackAnswerSubmitDto {
  cardId: string;
  kind: 'event' | 'attendee';
  targetUserId: string | null;
  targetRole: 'Admin' | 'Manager' | 'Member';
  primaryValue: string;
  secondaryValue: string;
  personalityTraitIds: string[];
  tags: string[];
  submittedAtIso: string;
}

export interface EventFeedbackSubmitRequestDto {
  userId: string;
  eventId: string;
  answers: EventFeedbackAnswerSubmitDto[];
}

export interface EventFeedbackNoteRequestDto {
  userId: string;
  eventId: string;
  text: string;
}

export interface EventFeedbackToggleRequestDto {
  userId: string;
  eventId: string;
}

export interface EventFeedbackPersistedState {
  id: string;
  userId: string;
  eventId: string;
  removed: boolean;
  submittedAtIso: string | null;
  organizerNote: string;
  answersByCardId: Record<string, SubmittedEventFeedbackAnswer>;
}

export type EventFeedbackListFilter = 'pending' | 'feedbacked' | 'removed';

export interface EventFeedbackEventCard {
  eventId: string;
  title: string;
  subtitle: string;
  timeframe: string;
  imageUrl: string;
  startAtMs: number;
  pendingCards: number;
  totalCards: number;
  isRemoved: boolean;
  isFeedbacked: boolean;
  feedbackedAtMs: number | null;
}

export interface SubEventCard {
  id: string;
  title: string;
  when: string;
  phase: string;
  requirements: {
    cars: string;
    accommodation: string;
    accessories: string;
  };
}
export type SubEventsDisplayMode = 'Casual' | 'Tournament';
export type TournamentLeaderboardType = 'Score' | 'Fifa';
export type EventEditorMode = 'edit' | 'create';
export type EventEditorTarget = 'events' | 'hosting';
export type EventVisibility = 'Public' | 'Friends only' | 'Invitation only';
export type EventBlindMode = 'Open Event' | 'Blind Event';
export type EventRecordKind = 'main' | 'slot';

export interface EventSlotTemplate {
  id: string;
  startAt: string;
  endAt: string;
  overrideDate?: string | null;
  closed?: boolean;
}

export interface EventSlotOccurrence {
  id: string;
  parentEventId: string;
  slotTemplateId: string;
  title: string;
  timeframe: string;
  startAtIso: string;
  endAtIso: string;
  capacityTotal: number;
  acceptedMembers: number;
  pendingMembers: number;
}

export interface EventEditorForm {
  title: string;
  description: string;
  imageUrl: string;
  capacityMin: number | null;
  capacityMax: number | null;
  startAt: string;
  endAt: string;
  location: string;
  frequency: string;
  visibility: EventVisibility;
  blindMode: EventBlindMode;
  autoInviter: boolean;
  ticketing: boolean;
  pricing?: PricingConfig | null;
  topics: string[];
  slotsEnabled: boolean;
  slotTemplates: EventSlotTemplate[];
  subEvents: SubEventFormItem[];
}

export interface SubEventFormItem {
  id: string;
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  location?: string;
  createdByUserId?: string;
  groups?: SubEventGroupItem[];
  tournamentGroupCount?: number;
  tournamentGroupCapacityMin?: number;
  tournamentGroupCapacityMax?: number;
  tournamentLeaderboardType?: TournamentLeaderboardType;
  tournamentAdvancePerGroup?: number;
  optional: boolean;
  capacityMin: number;
  capacityMax: number;
  membersAccepted: number;
  membersPending: number;
  carsPending: number;
  accommodationPending: number;
  suppliesPending: number;
  carsAccepted?: number;
  accommodationAccepted?: number;
  suppliesAccepted?: number;
  pricing?: PricingConfig | null;
  carsCapacityMin?: number;
  carsCapacityMax?: number;
  accommodationCapacityMin?: number;
  accommodationCapacityMax?: number;
  suppliesCapacityMin?: number;
  suppliesCapacityMax?: number;
  slotStartOffsetMinutes?: number;
  slotDurationMinutes?: number;
}

export interface SubEventGroupItem {
  id: string;
  name: string;
  capacityMin?: number;
  capacityMax?: number;
  source?: 'manual' | 'generated';
}

export interface SubEventGroupFormItem {
  id: string;
  stageId: string;
  stageTitle: string;
  name: string;
  capacityMin: number;
  capacityMax: number;
  source: 'manual' | 'generated';
}

export interface SubEventTournamentConfig {
  groupCount: number;
  groupCapacityMin: number;
  groupCapacityMax: number;
}

export interface SubEventTournamentGroup {
  key: string;
  id: string;
  groupNumber: number;
  groupLabel: string;
  source: 'manual' | 'generated';
  subEvent: SubEventFormItem;
}

export interface SubEventTournamentStage {
  key: string;
  stageNumber: number;
  title: string;
  subtitle: string;
  description: string;
  rangeLabel: string;
  subEvent: SubEventFormItem;
  groups: SubEventTournamentGroup[];
  isCurrent: boolean;
}

export interface SubEventLeaderboardMember {
  id: string;
  name: string;
}

export interface SubEventLeaderboardScoreEntry {
  id: string;
  stageId: string;
  groupId: string;
  memberId: string;
  value: number;
  note: string;
  createdAtMs: number;
}

export interface SubEventLeaderboardFifaMatch {
  id: string;
  stageId: string;
  groupId: string;
  homeMemberId: string;
  awayMemberId: string;
  homeScore: number;
  awayScore: number;
  note: string;
  createdAtMs: number;
}

export interface SubEventLeaderboardFormItem {
  groupId: string;
  memberId: string;
  scoreValue: number | null;
  note: string;
  homeMemberId: string;
  awayMemberId: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface SubEventLeaderboardScoreStandingRow {
  memberId: string;
  memberName: string;
  total: number;
  updates: number;
  isPlaceholder?: boolean;
}

export interface SubEventLeaderboardFifaStandingRow {
  memberId: string;
  memberName: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  isPlaceholder?: boolean;
}

export interface EventCapacityRange {
  min: number | null;
  max: number | null;
}
