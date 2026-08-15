export interface TournamentGroupCountInput {
  groupCapacityMin?: number | null;
  groupCapacityMax?: number | null;
  incomingCapacityMax?: number | null;
  stageCapacityMax?: number | null;
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

function nonNegativeInteger(value: unknown): number {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
