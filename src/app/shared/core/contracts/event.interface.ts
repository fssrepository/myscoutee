import type * as AppConstants from '../common/constants';
import type * as PricingContracts from './pricing.interface';

export interface EventPolicyItem {
  id: string;
  title: string;
  description: string;
  required: boolean;
}

export type SubEventsDisplayMode = 'Casual' | 'Tournament';
export type TournamentLeaderboardType = 'Score' | 'Fifa';
export type TournamentStageStatus = 'A' | 'RS' | 'SR' | 'F' | 'S';
export type EventEditorMode = 'edit' | 'create';
export type EventEditorTarget = 'events' | 'hosting';
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
  visibility: AppConstants.EventVisibility;
  blindMode: EventBlindMode;
  autoInviter: boolean;
  ticketing: boolean;
  pricing?: PricingContracts.PricingConfig | null;
  policies?: EventPolicyItem[];
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
  pricing?: PricingContracts.PricingConfig | null;
  carsCapacityMin?: number;
  carsCapacityMax?: number;
  accommodationCapacityMin?: number;
  accommodationCapacityMax?: number;
  suppliesCapacityMin?: number;
  suppliesCapacityMax?: number;
  slotStartOffsetMinutes?: number;
  slotDurationMinutes?: number;
  stageStatus?: TournamentStageStatus | string;
  stageStatusReason?: string | null;
  stageStatusUpdatedAt?: string | null;
  stageFinalizedAt?: string | null;
  stageFinalizedByUserId?: string | null;
}

export interface SubEventGroupItem {
  id: string;
  name: string;
  capacityMin?: number;
  capacityMax?: number;
  source?: 'manual' | 'generated';
}

export interface EventCapacityRange {
  min: number | null;
  max: number | null;
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

export interface SubEventLeaderboardGroupState {
  groupId: string;
  title: string;
  memberCount: number;
  advancePerGroup: number;
  advancingMemberIds: string[];
  members: SubEventLeaderboardMember[];
  scoreEntries: SubEventLeaderboardScoreEntry[];
  fifaMatches: SubEventLeaderboardFifaMatch[];
  scoreRows: SubEventLeaderboardScoreStandingRow[];
  fifaRows: SubEventLeaderboardFifaStandingRow[];
}

export interface SubEventLeaderboardState {
  eventId: string;
  subEventId: string;
  title: string;
  leaderboardType: 'Score' | 'Fifa' | string;
  groups: SubEventLeaderboardGroupState[];
}
