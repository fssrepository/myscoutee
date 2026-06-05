import { AppUtils } from '../../../app-utils';
import { APP_STATIC_DATA } from '../../../app-static-data';
import type {
  UserDto,
  UserImpressionsDto,
  UserImpressionsSectionDto,
  UserPersonalityTraitDto,
  UserRealtimeCountersDto
} from '../../base/interfaces/user.interface';

export interface LocalUserRealtimeSnapshotState {
  sourceUser: UserDto;
  cursor: number;
  counters: UserRealtimeCountersDto;
  impressions?: UserImpressionsDto;
}

export class LocalUserRealtimeSnapshotBuilder {
  private static readonly personalityTraitCatalog = APP_STATIC_DATA.personalityTraitCatalog;

  static buildInitialState(user: UserDto): LocalUserRealtimeSnapshotState {
    return {
      sourceUser: user,
      cursor: 0,
      counters: this.buildInitialRealtimeCounters(user),
      impressions: this.cloneUserImpressions(user.impressions)
    };
  }

  static resetState(state: LocalUserRealtimeSnapshotState): LocalUserRealtimeSnapshotState {
    return this.buildInitialState(state.sourceUser);
  }

  static advanceState(
    state: LocalUserRealtimeSnapshotState,
    nextCursor: number
  ): LocalUserRealtimeSnapshotState {
    const delta = this.buildSimulatedRealtimeCounterDelta(
      state.sourceUser,
      state.cursor,
      nextCursor
    );
    return {
      ...state,
      cursor: nextCursor,
      counters: this.buildSimulatedRealtimeCounters(state.counters, delta),
      impressions: this.buildSimulatedRealtimeImpressions(state.impressions, delta, nextCursor)
    };
  }

  static buildSnapshotCounters(
    state: LocalUserRealtimeSnapshotState,
    options: { suppressImpressionChangeFlags?: boolean } = {}
  ): UserRealtimeCountersDto {
    if (!options.suppressImpressionChangeFlags) {
      return state.counters;
    }
    return {
      ...state.counters,
      impressionsHostChanged: false,
      impressionsMemberChanged: false
    };
  }

  private static buildSimulatedRealtimeCounterDelta(
    user: UserDto,
    previousCursor: number,
    nextCursor: number
  ): UserRealtimeCountersDto {
    if (!this.hasImpressionActivity(user) && !this.hasImpressionsData(user.impressions)) {
      return {
        game: 0,
        chat: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        cars: 0,
        accommodation: 0,
        supplies: 0,
        tickets: 0,
        contacts: 0,
        feedback: 0,
        impressionsHostChanged: false,
        impressionsMemberChanged: false
      };
    }
    const buildPendingTotal = (
      seedSuffix: string,
      stepMax: number,
      cadenceMax: number
    ): number => {
      const stableSeed = AppUtils.hashText(`${user.id}:pending:${seedSuffix}`);
      const step = 1 + (stableSeed % Math.max(1, stepMax));
      const cadence = 1 + ((stableSeed >>> 3) % Math.max(1, cadenceMax));
      const offset = stableSeed % 2;
      const buildTotalAtCursor = (cursor: number): number => {
        if (cursor <= 0) {
          return 0;
        }
        const pollIndex = Math.max(0, cursor - 1);
        return offset + (Math.floor(pollIndex / cadence) * step);
      };
      return Math.max(0, buildTotalAtCursor(nextCursor) - buildTotalAtCursor(previousCursor));
    };
    const eventsPending = buildPendingTotal('events', 2, 2);
    const hostingPending = buildPendingTotal('hosting', 2, 3);
    const gamePending = buildPendingTotal('game', 2, 2);
    const chatPending = buildPendingTotal('chat', 3, 2);
    const invitationsPending = buildPendingTotal('invitations', 2, 3);
    const feedbackPending = buildPendingTotal('feedback', 2, 3);
    return {
      game: gamePending,
      chat: chatPending,
      invitations: invitationsPending,
      events: eventsPending,
      hosting: hostingPending,
      cars: 0,
      accommodation: 0,
      supplies: 0,
      tickets: Math.max(0, Math.trunc((eventsPending + hostingPending) / 2)),
      contacts: 0,
      feedback: feedbackPending,
      impressionsHostChanged: AppUtils.hashText(`${user.id}:${nextCursor}:imp-host`) % 3 === 0,
      impressionsMemberChanged: AppUtils.hashText(`${user.id}:${nextCursor}:imp-member`) % 3 === 0
    };
  }

  private static buildInitialRealtimeCounters(user: UserDto): UserRealtimeCountersDto {
    const base = user.activities ?? {};
    return {
      game: this.normalizeCounter(base.game),
      chat: this.normalizeCounter(base.chat),
      invitations: this.normalizeCounter(base.invitations),
      events: this.normalizeCounter(base.events),
      hosting: this.normalizeCounter(base.hosting),
      cars: this.normalizeCounter(base.cars),
      accommodation: this.normalizeCounter(base.accommodation),
      supplies: this.normalizeCounter(base.supplies),
      tickets: this.normalizeCounter(base.tickets),
      contacts: this.normalizeCounter(base.contacts),
      feedback: this.normalizeCounter(base.feedback),
      adminJobs: this.normalizeCounter(base.adminJobs),
      adminMetrics: this.normalizeCounter(base.adminMetrics),
      impressionsHostChanged: false,
      impressionsMemberChanged: false
    };
  }

  private static buildSimulatedRealtimeCounters(
    current: UserRealtimeCountersDto,
    delta: UserRealtimeCountersDto
  ): UserRealtimeCountersDto {
    const withBase = (baseValue: unknown, deltaValue: unknown): number => {
      return this.normalizeCounter(baseValue) + this.normalizeCounter(deltaValue);
    };
    return {
      game: withBase(current.game, delta.game),
      chat: withBase(current.chat, delta.chat),
      invitations: withBase(current.invitations, delta.invitations),
      events: withBase(current.events, delta.events),
      hosting: withBase(current.hosting, delta.hosting),
      cars: withBase(current.cars, delta.cars),
      accommodation: withBase(current.accommodation, delta.accommodation),
      supplies: withBase(current.supplies, delta.supplies),
      tickets: withBase(current.tickets, delta.tickets),
      contacts: withBase(current.contacts, delta.contacts),
      feedback: withBase(current.feedback, delta.feedback),
      adminJobs: this.normalizeCounter(current.adminJobs),
      adminMetrics: this.normalizeCounter(current.adminMetrics),
      impressionsHostChanged: delta.impressionsHostChanged === true,
      impressionsMemberChanged: delta.impressionsMemberChanged === true
    };
  }

  private static buildSimulatedRealtimeImpressions(
    impressions: UserImpressionsDto | undefined,
    delta: UserRealtimeCountersDto,
    cursor: number
  ): UserImpressionsDto | undefined {
    if (!impressions) {
      return undefined;
    }
    const normalizeCount = (value: number | undefined): number => {
      if (!Number.isFinite(value)) {
        return 0;
      }
      return Math.max(0, Math.trunc(Number(value)));
    };
    const hostPendingUnread = Math.max(0, Math.trunc(((delta.events ?? 0) + (delta.hosting ?? 0)) / 2));
    const memberPendingUnread = Math.max(0, Math.trunc(((delta.game ?? 0) + (delta.chat ?? 0) + (delta.invitations ?? 0)) / 3));
    const host = impressions.host
      ? {
        ...impressions.host,
        unreadCount: normalizeCount(impressions.host.unreadCount) + hostPendingUnread,
        averageRating: this.simulatedRatingValue(impressions.host.averageRating, cursor, 2),
        peopleMet: this.simulatedMetricValue(impressions.host.peopleMet, cursor, 2),
        totalEvents: this.simulatedMetricValue(impressions.host.totalEvents, cursor, 1),
        repeatCount: this.simulatedMetricValue(impressions.host.repeatCount, cursor, 1),
        noShowCount: this.simulatedMetricValue(impressions.host.noShowCount, cursor, 1),
        vibeBadges: this.simulatedBadgeList(impressions.host.vibeBadges, cursor, 2),
        personalityTraits: this.simulatedTraitList(impressions.host.personalityTraits, cursor, `${userScopeKey(delta, 'host')}:${cursor}`),
        personalityBadges: this.toPersonalityBadges(
          this.simulatedTraitList(impressions.host.personalityTraits, cursor, `${userScopeKey(delta, 'host')}:${cursor}`)
          ?? impressions.host.personalityTraits
        ),
        categoryBadges: this.simulatedBadgeList(impressions.host.categoryBadges, cursor, 2)
      }
      : undefined;
    const member = impressions.member
      ? {
        ...impressions.member,
        unreadCount: normalizeCount(impressions.member.unreadCount) + memberPendingUnread,
        averageRating: this.simulatedRatingValue(impressions.member.averageRating, cursor, 2),
        peopleMet: this.simulatedMetricValue(impressions.member.peopleMet, cursor, 2),
        totalEvents: this.simulatedMetricValue(impressions.member.totalEvents, cursor, 1),
        repeatCount: this.simulatedMetricValue(impressions.member.repeatCount, cursor, 1),
        noShowCount: this.simulatedMetricValue(impressions.member.noShowCount, cursor, 1),
        vibeBadges: this.simulatedBadgeList(impressions.member.vibeBadges, cursor, 2),
        personalityTraits: this.simulatedTraitList(impressions.member.personalityTraits, cursor, `${userScopeKey(delta, 'member')}:${cursor}`),
        personalityBadges: this.toPersonalityBadges(
          this.simulatedTraitList(impressions.member.personalityTraits, cursor, `${userScopeKey(delta, 'member')}:${cursor}`)
          ?? impressions.member.personalityTraits
        ),
        categoryBadges: this.simulatedBadgeList(impressions.member.categoryBadges, cursor, 2)
      }
      : undefined;
    return {
      host,
      member
    };
  }

  private static hasImpressionActivity(user: UserDto): boolean {
    const activities = user.activities ?? {};
    return [
      activities.chat,
      activities.invitations,
      activities.events,
      activities.hosting,
      activities.tickets,
      activities.feedback
    ].some(value => Number.isFinite(value) && Math.trunc(Number(value)) > 0);
  }

  private static hasImpressionsData(impressions: UserImpressionsDto | undefined): boolean {
    return this.hasImpressionsSectionData(impressions?.host)
      || this.hasImpressionsSectionData(impressions?.member);
  }

  private static hasImpressionsSectionData(section: UserImpressionsSectionDto | undefined): boolean {
    if (!section) {
      return false;
    }
    const hasPositiveMetric = [
      section.averageRating,
      section.peopleMet,
      section.totalEvents,
      section.repeatCount,
      section.noShowCount
    ].some(value => Number.isFinite(value) && Number(value) > 0);
    const hasBadges = [
      section.vibeBadges,
      section.personalityBadges,
      section.categoryBadges
    ].some(items => (items ?? []).some(item => item.trim().length > 0));
    const hasTraits = (section.personalityTraits ?? []).some(trait =>
      `${trait.id ?? trait.label ?? ''}`.trim().length > 0
      && (
        (Number.isFinite(trait.percent) && Number(trait.percent) > 0)
        || (Number.isFinite(trait.evidenceCount) && Number(trait.evidenceCount) > 0)
      )
    );
    return hasPositiveMetric || hasBadges || hasTraits;
  }

  private static cloneUserImpressions(impressions: UserImpressionsDto | undefined): UserImpressionsDto | undefined {
    if (!impressions) {
      return undefined;
    }
    return {
      host: impressions.host
        ? {
          ...impressions.host,
          vibeBadges: [...(impressions.host.vibeBadges ?? [])],
          personalityBadges: [...(impressions.host.personalityBadges ?? [])],
          personalityTraits: (impressions.host.personalityTraits ?? []).map(trait => ({ ...trait })),
          categoryBadges: [...(impressions.host.categoryBadges ?? [])]
        }
        : undefined,
      member: impressions.member
        ? {
          ...impressions.member,
          vibeBadges: [...(impressions.member.vibeBadges ?? [])],
          personalityBadges: [...(impressions.member.personalityBadges ?? [])],
          personalityTraits: (impressions.member.personalityTraits ?? []).map(trait => ({ ...trait })),
          categoryBadges: [...(impressions.member.categoryBadges ?? [])]
        }
        : undefined
    };
  }

  private static simulatedMetricValue(baseValue: number | undefined, cursor: number, maxSwing: number): number | undefined {
    if (!Number.isFinite(baseValue)) {
      return undefined;
    }
    const seeded = AppUtils.hashText(`metric:${cursor}:${baseValue}`);
    const swing = (seeded % ((maxSwing * 2) + 1)) - maxSwing;
    return Math.max(0, Math.trunc(Number(baseValue)) + swing);
  }

  private static normalizeCounter(value: unknown): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }

  private static simulatedRatingValue(
    baseValue: number | undefined,
    cursor: number,
    maxSwingTenths: number
  ): number | undefined {
    if (!Number.isFinite(baseValue)) {
      return undefined;
    }
    const normalized = Math.round(Number(baseValue) * 10);
    const seeded = AppUtils.hashText(`rating:${cursor}:${normalized}`);
    const swing = (seeded % ((maxSwingTenths * 2) + 1)) - maxSwingTenths;
    const nextTenths = Math.max(0, Math.min(50, normalized + swing));
    return nextTenths / 10;
  }

  private static simulatedBadgeList(
    badges: readonly string[] | undefined,
    cursor: number,
    maxSwingPercent: number
  ): string[] | undefined {
    if (!Array.isArray(badges)) {
      return undefined;
    }
    return badges.map((badge, index) => this.simulatedBadgeValue(badge, cursor, index, maxSwingPercent));
  }

  private static simulatedBadgeValue(
    badge: string,
    cursor: number,
    index: number,
    maxSwingPercent: number
  ): string {
    const normalized = `${badge ?? ''}`.trim();
    if (!normalized) {
      return normalized;
    }
    const match = normalized.match(/^(.*?)(\d{1,3})%$/);
    if (!match) {
      return normalized;
    }
    const label = match[1].trim();
    const percent = Number.parseInt(match[2], 10);
    if (!Number.isFinite(percent)) {
      return normalized;
    }
    const seeded = AppUtils.hashText(`badge:${cursor}:${index}:${normalized}`);
    const swing = (seeded % ((maxSwingPercent * 2) + 1)) - maxSwingPercent;
    const nextPercent = Math.max(0, Math.min(100, percent + swing));
    return `${label} ${nextPercent}%`;
  }

  private static simulatedTraitList(
    traits: readonly UserPersonalityTraitDto[] | undefined,
    cursor: number,
    seedScope: string
  ): UserPersonalityTraitDto[] | undefined {
    if (!Array.isArray(traits) || traits.length === 0) {
      return undefined;
    }
    const adjusted = new Map<string, number>();
    for (const trait of traits) {
      const id = `${trait.id ?? ''}`.trim();
      if (!id) {
        continue;
      }
      const basePercent = Math.max(1, Math.trunc(Number(trait.percent) || 0));
      const swingSeed = AppUtils.hashText(`trait:${seedScope}:${cursor}:${id}`);
      const swing = (swingSeed % 7) - 3;
      adjusted.set(id, Math.max(1, basePercent + swing));
    }
    const total = Array.from(adjusted.values()).reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      return traits.map(trait => ({ ...trait }));
    }
    const ordered = this.personalityTraitCatalog
      .map(trait => ({ trait, score: adjusted.get(trait.id) ?? 0 }))
      .filter(entry => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.trait.label.localeCompare(right.trait.label));
    const normalizedPercents = ordered.map(entry => Math.max(1, Math.round((entry.score * 100) / total)));
    const percentDelta = 100 - normalizedPercents.reduce((sum, value) => sum + value, 0);
    if (normalizedPercents.length > 0 && percentDelta !== 0) {
      normalizedPercents[0] = Math.max(1, normalizedPercents[0] + percentDelta);
    }
    return ordered.map((entry, index) => {
      const existing = traits.find(trait => trait.id === entry.trait.id);
      return {
        id: entry.trait.id,
        label: entry.trait.label,
        percent: normalizedPercents[index],
        evidenceCount: Math.max(0, Math.trunc(Number(existing?.evidenceCount) || 0)),
        lastRatedAtIso: existing?.lastRatedAtIso ?? null
      };
    });
  }

  private static toPersonalityBadges(
    traits: readonly UserPersonalityTraitDto[] | undefined
  ): string[] | undefined {
    if (!Array.isArray(traits) || traits.length === 0) {
      return undefined;
    }
    return [...traits]
      .sort((left, right) => (Number(right.percent) || 0) - (Number(left.percent) || 0) || left.label.localeCompare(right.label))
      .slice(0, 3)
      .map(trait => `${trait.label} ${Math.max(0, Math.trunc(Number(trait.percent) || 0))}%`);
  }
}

function userScopeKey(counters: UserRealtimeCountersDto, scope: 'host' | 'member'): string {
  const hostBias = scope === 'host'
    ? `${counters.events ?? 0}:${counters.hosting ?? 0}`
    : `${counters.game ?? 0}:${counters.chat ?? 0}`;
  return `${scope}:${hostBias}`;
}
