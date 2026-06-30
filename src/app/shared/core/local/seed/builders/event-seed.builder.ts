import { AppUtils } from '../../../../app-utils';
import { environment } from '../../../../../../environments/environment';
import type * as ContractTypes from '../../../contracts';
import type {
  ActivityEventSeedItem,
  ActivityHostingSeedItem,
  SeedActivityDateTimeRange
} from '../entity';
import type { UserDto } from '../../../contracts/user.interface';

export class SeedEventBuilder {
  static seededTournamentGroupIdForUser<TGroup extends { id: string }>(
    eventId: string,
    subEventId: string,
    groups: TGroup[],
    userId: string
  ): string {
    if (groups.length === 0) {
      return '';
    }
    const index = AppUtils.hashText(`group-chat-member:${eventId}:${subEventId}:${userId}`) % groups.length;
    return groups[index]?.id ?? groups[0]?.id ?? '';
  }

  static seededEventMemberIds(
    eventId: string,
    targetCount: number,
    users: readonly UserDto[],
    activeUserId: string
  ): string[] {
    const normalizedActiveUserId = activeUserId.trim();
    if (!normalizedActiveUserId) {
      return [];
    }
    const seedableUsers = [...users];
    const count = Math.max(4, Math.min(Math.max(4, targetCount), seedableUsers.length));
    const others = seedableUsers.filter(user => user.id !== normalizedActiveUserId);
    const seeded: string[] = [normalizedActiveUserId];
    if (others.length === 0) {
      return seeded;
    }
    const seed = AppUtils.hashText(`event-members:${eventId}`);
    for (let index = 0; index < others.length && seeded.length < count; index += 1) {
      const candidate = others[(seed + (index * 3)) % others.length];
      if (!seeded.includes(candidate.id)) {
        seeded.push(candidate.id);
      }
    }
    return seeded;
  }

  static seededEventCapacityRange(
    eventId: string,
    activityCapacityById: Record<string, string>
  ): ContractTypes.EventCapacityRange {
    const source = activityCapacityById[eventId];
    if (source) {
      const parts = source.split('/').map(part => Number.parseInt(part.trim(), 10));
      if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        const min = Math.max(0, Math.min(parts[0], parts[1]));
        const max = Math.max(min, parts[1]);
        return { min, max };
      }
    }
    const seed = AppUtils.hashText(`event-capacity:${eventId}`);
    const max = 10 + (seed % 24);
    const min = Math.max(0, Math.floor(max * 0.45));
    return { min, max };
  }

  static buildSeededSubEventDefinitionsForEvent(
    source: ActivityEventSeedItem | ActivityHostingSeedItem,
    options: {
      isHosting: boolean;
      activityDateTimeRangeById: Record<string, SeedActivityDateTimeRange>;
      hostingDatesById: Record<string, string>;
      eventDatesById: Record<string, string>;
      eventCapacityById: Record<string, ContractTypes.EventCapacityRange>;
      activityCapacityById: Record<string, string>;
      defaultStartIso: string;
    }
  ): ContractTypes.SubEventDefinitionDTO[] {
    const dateSource = options.activityDateTimeRangeById[source.id];
    const fallbackStartIso = options.isHosting
      ? (options.hostingDatesById[source.id] ?? options.defaultStartIso)
      : (options.eventDatesById[source.id] ?? options.defaultStartIso);
    const start = new Date(dateSource?.startIso ?? fallbackStartIso);
    const end = new Date(
      dateSource?.endIso
      ?? new Date(start.getTime() + (4 * 60 * 60 * 1000)).toISOString().slice(0, 19)
    );
    const startMs = Number.isNaN(start.getTime()) ? AppUtils.anchorDate(environment.bootstrapOffsetInDays).getTime() : start.getTime();
    const endMs = Number.isNaN(end.getTime()) || end.getTime() <= startMs
      ? (startMs + (4 * 60 * 60 * 1000))
      : end.getTime();
    const seed = AppUtils.hashText(`event-subevents:${source.id}:${source.title}:${source.shortDescription}`);
    const tournamentMode = (seed % 3) === 0;
    const eventCapacity = options.eventCapacityById[source.id]
      ?? this.seededEventCapacityRange(source.id, options.activityCapacityById);
    const eventMax = this.normalizedEventCapacityValue(eventCapacity.max) ?? 0;
    if (tournamentMode) {
      return this.buildSeededTournamentSubEventDefinitions(source, startMs, endMs, seed, eventMax);
    }
    return this.buildSeededCasualSubEventDefinitions(source, startMs, endMs, seed, eventMax);
  }

  static inferredEventModeFromDefinitions(items: readonly ContractTypes.SubEventDefinitionDTO[]): ContractTypes.EventMode {
    if (items.some(item => !item.optional && (
      (item.tournamentGroupCapacityMin ?? 0) > 0
      || (item.tournamentGroupCapacityMax ?? 0) > 0
      || item.tournamentLeaderboardType === 'Score'
      || item.tournamentLeaderboardType === 'Fifa'
    ))) {
      return 'Tournament';
    }
    return 'Casual';
  }

  private static buildSeededCasualSubEventDefinitions(
    source: ActivityEventSeedItem | ActivityHostingSeedItem,
    startMs: number,
    endMs: number,
    seed: number,
    eventMax: number
  ): ContractTypes.SubEventDefinitionDTO[] {
    const count = 2 + (seed % 3);
    const totalMs = Math.max(2 * 60 * 60 * 1000, endMs - startMs);
    const slotMs = Math.max(45 * 60 * 1000, Math.floor(totalMs / count));
    const names = ['Kickoff', 'Main Session', 'Side Activity', 'Wrap-up'];
    const items: ContractTypes.SubEventDefinitionDTO[] = [];
    for (let index = 0; index < count; index += 1) {
      const optional = index > 0 && ((seed + index) % 2 === 0);
      const stageStartMs = startMs + (index * slotMs);
      const stageEndMs = index === count - 1 ? endMs : Math.min(endMs, stageStartMs + slotMs);
      const slice = 0.45 + (((seed + index) % 4) * 0.12);
      const capacityMax = Math.max(0, Math.round(eventMax * slice));
      const capacityMin = optional ? 0 : Math.max(0, Math.min(capacityMax, Math.floor(capacityMax * 0.55)));
      const durationMinutes = Math.max(30, Math.round((Math.max(stageStartMs + (30 * 60 * 1000), stageEndMs) - stageStartMs) / 60000));
      items.push({
        id: `seed-${source.id}-casual-${index + 1}`,
        name: `${names[index] ?? `Session ${index + 1}`}`,
        description: `${source.shortDescription} (${index + 1}/${count})`,
        timing: index === 0 ? 'During' : 'After',
        offsetMinutes: 0,
        durationMinutes,
        optional,
        capacityMin,
        capacityMax,
        icon: null
      });
    }
    return items;
  }

  private static buildSeededTournamentSubEventDefinitions(
    source: ActivityEventSeedItem | ActivityHostingSeedItem,
    startMs: number,
    endMs: number,
    seed: number,
    eventMax: number
  ): ContractTypes.SubEventDefinitionDTO[] {
    const stageNames = ['Qualifiers', 'Semifinals', 'Finals'];
    const stageCount = 3;
    const totalMs = Math.max(3 * 60 * 60 * 1000, endMs - startMs);
    const slotMs = Math.max(60 * 60 * 1000, Math.floor(totalMs / stageCount));
    const items: ContractTypes.SubEventDefinitionDTO[] = [];

    for (let index = 0; index < stageCount; index += 1) {
      const groupCount = Math.max(1, 4 >> index);
      const basePerGroupMax = Math.max(2, Math.ceil(Math.max(2, eventMax) / Math.max(1, groupCount * (index + 1))));
      const groupCapacityMax = basePerGroupMax;
      const groupCapacityMin = Math.max(0, Math.floor(groupCapacityMax * 0.6));
      const capacityMin = groupCount * groupCapacityMin;
      const capacityMax = groupCount * groupCapacityMax;
      const stageStartMs = startMs + (index * slotMs);
      const stageEndMs = index === stageCount - 1 ? endMs : Math.min(endMs, stageStartMs + slotMs);
      const durationMinutes = Math.max(45, Math.round((Math.max(stageStartMs + (45 * 60 * 1000), stageEndMs) - stageStartMs) / 60000));
      items.push({
        id: `seed-${source.id}-tournament-${index + 1}`,
        name: `${stageNames[index]}`,
        description: `${source.shortDescription} (${stageNames[index]})`,
        timing: index === 0 ? 'During' : 'After',
        offsetMinutes: 0,
        durationMinutes,
        tournamentGroupCapacityMin: groupCapacityMin,
        tournamentGroupCapacityMax: groupCapacityMax,
        tournamentLeaderboardType: (seed + index) % 2 === 0 ? 'Score' : 'Fifa',
        tournamentAdvancePerGroup: index === stageCount - 1 ? 0 : Math.max(1, 2 - index),
        optional: false,
        capacityMin,
        capacityMax,
        icon: 'emoji_events'
      });
    }
    return items;
  }

  private static normalizedEventCapacityValue(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(0, Math.trunc(parsed));
  }

}
