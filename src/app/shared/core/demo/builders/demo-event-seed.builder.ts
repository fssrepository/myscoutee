import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../../base/models';
import type { EventMenuItem, HostingMenuItem, DemoUser } from '../../../demo-data';

export class DemoEventSeedBuilder {
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
    users: readonly DemoUser[],
    activeUserId: string
  ): string[] {
    const count = Math.max(4, Math.min(Math.max(4, targetCount), users.length));
    const others = users.filter(user => user.id !== activeUserId);
    const seeded: string[] = [activeUserId];
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
  ): AppTypes.EventCapacityRange {
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

  static buildSeededSubEventsForEvent(
    source: EventMenuItem | HostingMenuItem,
    options: {
      isHosting: boolean;
      activityDateTimeRangeById: Record<string, AppTypes.ActivityDateTimeRange>;
      hostingDatesById: Record<string, string>;
      eventDatesById: Record<string, string>;
      eventCapacityById: Record<string, AppTypes.EventCapacityRange>;
      activityCapacityById: Record<string, string>;
      defaultStartIso: string;
      activeUserId: string;
    }
  ): AppTypes.SubEventFormItem[] {
    const dateSource = options.activityDateTimeRangeById[source.id];
    const fallbackStartIso = options.isHosting
      ? (options.hostingDatesById[source.id] ?? options.defaultStartIso)
      : (options.eventDatesById[source.id] ?? options.defaultStartIso);
    const start = new Date(dateSource?.startIso ?? fallbackStartIso);
    const end = new Date(
      dateSource?.endIso
      ?? new Date(start.getTime() + (4 * 60 * 60 * 1000)).toISOString().slice(0, 19)
    );
    const startMs = Number.isNaN(start.getTime()) ? Date.now() : start.getTime();
    const endMs = Number.isNaN(end.getTime()) || end.getTime() <= startMs
      ? (startMs + (4 * 60 * 60 * 1000))
      : end.getTime();
    const seed = AppUtils.hashText(`event-subevents:${source.id}:${source.title}:${source.shortDescription}`);
    const tournamentMode = (seed % 3) === 0;
    const eventCapacity = options.eventCapacityById[source.id]
      ?? this.seededEventCapacityRange(source.id, options.activityCapacityById);
    const eventMax = this.normalizedEventCapacityValue(eventCapacity.max) ?? 0;
    if (tournamentMode) {
      return this.buildSeededTournamentSubEvents(source, startMs, endMs, seed, options.activeUserId, eventMax);
    }
    return this.buildSeededCasualSubEvents(source, startMs, endMs, seed, options.activeUserId, eventMax);
  }

  static inferredSubEventsDisplayMode(items: readonly AppTypes.SubEventFormItem[]): AppTypes.SubEventsDisplayMode {
    if (items.some(item => !item.optional && (item.groups?.length ?? 0) > 0)) {
      return 'Tournament';
    }
    return 'Casual';
  }

  private static buildSeededCasualSubEvents(
    source: EventMenuItem | HostingMenuItem,
    startMs: number,
    endMs: number,
    seed: number,
    activeUserId: string,
    eventMax: number
  ): AppTypes.SubEventFormItem[] {
    const count = 2 + (seed % 3);
    const totalMs = Math.max(2 * 60 * 60 * 1000, endMs - startMs);
    const slotMs = Math.max(45 * 60 * 1000, Math.floor(totalMs / count));
    const names = ['Kickoff', 'Main Session', 'Side Activity', 'Wrap-up'];
    const items: AppTypes.SubEventFormItem[] = [];
    for (let index = 0; index < count; index += 1) {
      const optional = index > 0 && ((seed + index) % 2 === 0);
      const stageStartMs = startMs + (index * slotMs);
      const stageEndMs = index === count - 1 ? endMs : Math.min(endMs, stageStartMs + slotMs);
      const slice = 0.45 + (((seed + index) % 4) * 0.12);
      const capacityMax = Math.max(0, Math.round(eventMax * slice));
      const capacityMin = optional ? 0 : Math.max(0, Math.min(capacityMax, Math.floor(capacityMax * 0.55)));
      const accepted = Math.min(capacityMax, Math.max(0, Math.floor(capacityMin * 0.7)));
      items.push({
        id: `seed-${source.id}-casual-${index + 1}`,
        name: `${names[index] ?? `Session ${index + 1}`}`,
        description: `${source.shortDescription} (${index + 1}/${count})`,
        startAt: AppUtils.toIsoDateTimeLocal(new Date(stageStartMs)),
        endAt: AppUtils.toIsoDateTimeLocal(new Date(Math.max(stageStartMs + (30 * 60 * 1000), stageEndMs))),
        createdByUserId: activeUserId,
        groups: [],
        optional,
        capacityMin,
        capacityMax,
        membersAccepted: accepted,
        membersPending: Math.max(0, capacityMax - accepted),
        carsPending: (seed + index) % 3,
        accommodationPending: (seed + index + 1) % 3,
        suppliesPending: (seed + index + 2) % 4
      });
    }
    return this.sortSubEventsByStartAsc(items);
  }

  private static buildSeededTournamentSubEvents(
    source: EventMenuItem | HostingMenuItem,
    startMs: number,
    endMs: number,
    seed: number,
    activeUserId: string,
    eventMax: number
  ): AppTypes.SubEventFormItem[] {
    const stageNames = ['Qualifiers', 'Semifinals', 'Finals'];
    const stageCount = 3;
    const totalMs = Math.max(3 * 60 * 60 * 1000, endMs - startMs);
    const slotMs = Math.max(60 * 60 * 1000, Math.floor(totalMs / stageCount));
    const items: AppTypes.SubEventFormItem[] = [];

    for (let index = 0; index < stageCount; index += 1) {
      const groupCount = Math.max(1, 4 >> index);
      const basePerGroupMax = Math.max(2, Math.ceil(Math.max(2, eventMax) / Math.max(1, groupCount * (index + 1))));
      const groups: AppTypes.SubEventGroupItem[] = [];
      for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
        const groupMax = Math.max(2, basePerGroupMax - (groupIndex % 2));
        const groupMin = Math.max(0, Math.floor(groupMax * 0.6));
        groups.push({
          id: `seed-${source.id}-s${index + 1}-g${groupIndex + 1}`,
          name: `Group ${String.fromCharCode(65 + groupIndex)}`,
          capacityMin: groupMin,
          capacityMax: groupMax,
          source: 'generated'
        });
      }
      const totals = this.groupCapacityTotals(groups);
      const stageStartMs = startMs + (index * slotMs);
      const stageEndMs = index === stageCount - 1 ? endMs : Math.min(endMs, stageStartMs + slotMs);
      const accepted = Math.min(totals.max, Math.max(0, Math.floor(totals.min * 0.7)));
      items.push({
        id: `seed-${source.id}-tournament-${index + 1}`,
        name: `${stageNames[index]}`,
        description: `${source.shortDescription} (${stageNames[index]})`,
        startAt: AppUtils.toIsoDateTimeLocal(new Date(stageStartMs)),
        endAt: AppUtils.toIsoDateTimeLocal(new Date(Math.max(stageStartMs + (45 * 60 * 1000), stageEndMs))),
        createdByUserId: activeUserId,
        groups,
        tournamentGroupCount: groups.length,
        tournamentGroupCapacityMin: Math.max(0, ...groups.map(group => Number(group.capacityMin) || 0)),
        tournamentGroupCapacityMax: Math.max(0, ...groups.map(group => Number(group.capacityMax) || 0)),
        tournamentLeaderboardType: (seed + index) % 2 === 0 ? 'Score' : 'Fifa',
        tournamentAdvancePerGroup: index === stageCount - 1 ? 0 : Math.max(1, 2 - index),
        optional: false,
        capacityMin: totals.min,
        capacityMax: totals.max,
        membersAccepted: accepted,
        membersPending: Math.max(0, totals.max - accepted),
        carsPending: (seed + index) % 2,
        accommodationPending: (seed + index + 1) % 2,
        suppliesPending: (seed + index + 2) % 3
      });
    }
    return this.sortSubEventsByStartAsc(items);
  }

  private static sortSubEventsByStartAsc(items: readonly AppTypes.SubEventFormItem[]): AppTypes.SubEventFormItem[] {
    return [...items].sort((a, b) => AppUtils.toSortableDate(a.startAt) - AppUtils.toSortableDate(b.startAt));
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

  private static groupCapacityTotals(groups: readonly AppTypes.SubEventGroupItem[]): { min: number; max: number } {
    let min = 0;
    let max = 0;
    for (const group of groups) {
      const groupMin = Number(group.capacityMin);
      const groupMax = Number(group.capacityMax);
      const normalizedMin = Number.isFinite(groupMin) ? Math.max(0, Math.trunc(groupMin)) : 0;
      const normalizedMax = Number.isFinite(groupMax) ? Math.max(normalizedMin, Math.trunc(groupMax)) : normalizedMin;
      min += normalizedMin;
      max += normalizedMax;
    }
    return { min, max };
  }
}
