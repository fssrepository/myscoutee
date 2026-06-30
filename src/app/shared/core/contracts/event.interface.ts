import type * as PricingContracts from './pricing.interface';
import type { SubEventDefinitionDTO } from './activity.interface';

export interface EventPolicyDTO {
  id: string;
  title: string;
  description: string;
  required: boolean;
}

export type EventMode = 'Casual' | 'Tournament';
export type TournamentLeaderboardType = 'Score' | 'Fifa';
export type TournamentStageStatus = 'A' | 'RS' | 'SR' | 'F' | 'S';
export type EventEditorMode = 'edit' | 'create';
export type EventEditorTarget = 'events' | 'hosting';
export type EventBlindMode = 'Open Event' | 'Blind Event';
export type EventRecordKind = 'main' | 'slot';

export interface EventSlotTemplateDTO {
  id: string;
  startAt: string;
  overrideDate?: string | null;
  closed?: boolean;
  subEventDefinitions?: SubEventDefinitionDTO[];
}

export interface EventSlotOccurrenceDTO {
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

export interface SubEventDTO {
  id: string;
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  location?: string;
  createdByUserId?: string;
  groups?: SubEventGroupDTO[];
  tournamentGroupCount?: number;
  tournamentGroupCapacityMin?: number;
  tournamentGroupCapacityMax?: number;
  tournamentLeaderboardType?: TournamentLeaderboardType;
  tournamentAdvancePerGroup?: number;
  groupsCount?: number;
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

export interface SubEventGroupDTO {
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

export interface EventTournamentGroupDTO {
  id: string;
  name: string;
  source: 'manual' | 'generated' | string;
  capacityMin: number;
  capacityMax: number;
  membersAccepted: number;
  membersPending: number;
}

export interface EventTournamentStageDTO {
  subEventId: string;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  stageNumber: number;
  stageStatus?: TournamentStageStatus | string;
  leaderboardType: TournamentLeaderboardType | string;
  advancePerGroup: number;
  groups: EventTournamentGroupDTO[];
}

export interface EventTournamentGroupsStateDTO {
  eventId: string;
  title: string;
  subtitle: string;
  canManage: boolean;
  stages: EventTournamentStageDTO[];
}

export interface EventTournamentGroupsQueryDTO {
  userId: string;
  eventId: string;
}

export interface EventTournamentStageGroupsQueryDTO {
  eventId: string;
  slotId?: string | null;
  stageId: string;
}

export interface EventTournamentGroupUpsertRequestDTO {
  actorUserId: string;
  eventId: string;
  slotId?: string | null;
  subEventId: string;
  groupId?: string | null;
  name: string;
  capacityMin: number;
  capacityMax: number;
}

export interface EventTournamentGroupDeleteRequestDTO {
  actorUserId: string;
  eventId: string;
  slotId?: string | null;
  subEventId: string;
  groupId: string;
}

export interface SubEventLeaderboardEntryUpsertRequestDTO {
  actorUserId: string;
  eventId: string;
  subEventId: string;
  groupId: string;
  mode: TournamentLeaderboardType | string;
  memberId?: string | null;
  scoreValue?: number | null;
  note?: string | null;
  homeMemberId?: string | null;
  awayMemberId?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
}
