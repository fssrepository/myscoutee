export interface TournamentGroupCountInput {
  groupCapacityMin?: number | null;
  groupCapacityMax?: number | null;
  incomingCapacityMax?: number | null;
  stageCapacityMax?: number | null;
}

interface TournamentStageSummaryInput {
  id?: string | null;
  name?: string | null;
  optional?: boolean | null;
  tournamentGroupCapacityMin?: number | null;
  tournamentGroupCapacityMax?: number | null;
  tournamentLeaderboardType?: string | null;
  stageStatus?: string | null;
}

export interface TournamentCurrentStageSummary {
  id: string;
  name: string;
  stageNumber: number;
  totalStages: number;
  status: string;
}

export function tournamentGroupCountForIncoming(input: TournamentGroupCountInput): number {
  const groupCapacityMin = nonNegativeInteger(input.groupCapacityMin);
  const groupCapacityMax = Math.max(groupCapacityMin, nonNegativeInteger(input.groupCapacityMax));
  if (groupCapacityMin <= 0 && groupCapacityMax <= 0) {
    return 0;
  }

  const incomingCapacityMax = nonNegativeInteger(input.incomingCapacityMax);
  const stageCapacityMax = nonNegativeInteger(input.stageCapacityMax);
  const effectiveCapacityMax = incomingCapacityMax > 0 && stageCapacityMax > 0
    ? Math.min(incomingCapacityMax, stageCapacityMax)
    : Math.max(incomingCapacityMax, stageCapacityMax);
  if (effectiveCapacityMax <= 0) {
    return 0;
  }

  const divisor = Math.max(1, groupCapacityMax > 0 ? groupCapacityMax : groupCapacityMin);
  const groupsNeededForMaximum = Math.ceil(effectiveCapacityMax / divisor);
  const groupsAllowedByMinimum = groupCapacityMin > 0
    ? Math.max(1, Math.floor(effectiveCapacityMax / groupCapacityMin))
    : groupsNeededForMaximum;
  return Math.min(groupsNeededForMaximum, groupsAllowedByMinimum);
}

export function tournamentCurrentStageFromSubEvents(
  items: readonly TournamentStageSummaryInput[] | null | undefined
): TournamentCurrentStageSummary | null {
  const stages = (items ?? []).filter(item => isTournamentStage(item));
  if (stages.length === 0) {
    return null;
  }
  let currentIndex = 0;
  while (currentIndex + 1 < stages.length && normalizeStageStatus(stages[currentIndex]?.stageStatus) === 'F') {
    currentIndex += 1;
  }
  const stage = stages[currentIndex];
  return {
    id: `${stage?.id ?? ''}`.trim(),
    name: `${stage?.name ?? ''}`.trim(),
    stageNumber: currentIndex + 1,
    totalStages: stages.length,
    status: normalizeStageStatus(stage?.stageStatus)
  };
}

function isTournamentStage(stage: TournamentStageSummaryInput | null | undefined): boolean {
  if (!stage || stage.optional === true) {
    return false;
  }
  const leaderboardType = `${stage.tournamentLeaderboardType ?? ''}`.trim().toLowerCase();
  return nonNegativeInteger(stage.tournamentGroupCapacityMin) > 0
    || nonNegativeInteger(stage.tournamentGroupCapacityMax) > 0
    || leaderboardType === 'score'
    || leaderboardType === 'fifa';
}

function normalizeStageStatus(value: unknown): string {
  const status = `${value ?? ''}`.trim().toUpperCase();
  return status === 'RS' || status === 'SR' || status === 'F' || status === 'S' || status === 'E'
    ? status
    : 'A';
}

function nonNegativeInteger(value: unknown): number {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
