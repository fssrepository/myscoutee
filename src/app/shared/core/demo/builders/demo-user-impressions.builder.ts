import { AppUtils } from '../../../app-utils';
import { APP_STATIC_DATA } from '../../../app-static-data';
import type {
  UserDto,
  UserImpressionsDto,
  UserImpressionsSectionDto,
  UserPersonalityTraitDto,
  UserRealtimeCountersDto
} from '../../base/interfaces/user.interface';

export class DemoUserImpressionsBuilder {
  private static readonly personalityTraitCatalog = APP_STATIC_DATA.personalityTraitCatalog;

  static withResolvedImpressions(user: UserDto): UserDto {
    if (!this.hasImpressionActivity(user) && !this.hasImpressionsData(user.impressions)) {
      return {
        ...user,
        impressions: undefined
      };
    }
    const defaults = this.buildDefaultImpressions(user);
    const current = user.impressions ?? {};
    return {
      ...user,
      impressions: {
        host: this.mergeImpressionsSection(defaults.host, current.host),
        member: this.mergeImpressionsSection(defaults.member, current.member)
      }
    };
  }

  static buildSimulatedRealtimeCounters(user: UserDto, cursor: number): UserRealtimeCountersDto {
    if (!this.hasImpressionActivity(user) && !this.hasImpressionsData(user.impressions)) {
      return {
        game: 0,
        chat: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        tickets: 0,
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
      const pollIndex = Math.max(0, cursor - 1);
      return offset + (Math.floor(pollIndex / cadence) * step);
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
      tickets: Math.max(0, Math.trunc((eventsPending + hostingPending) / 2)),
      feedback: feedbackPending,
      impressionsHostChanged: AppUtils.hashText(`${user.id}:${cursor}:imp-host`) % 3 === 0,
      impressionsMemberChanged: AppUtils.hashText(`${user.id}:${cursor}:imp-member`) % 3 === 0
    };
  }

  static buildSimulatedRealtimeImpressions(
    impressions: UserImpressionsDto | undefined,
    counters: UserRealtimeCountersDto,
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
    const hostPendingUnread = Math.max(0, Math.trunc(((counters.events ?? 0) + (counters.hosting ?? 0)) / 2));
    const memberPendingUnread = Math.max(0, Math.trunc(((counters.game ?? 0) + (counters.chat ?? 0) + (counters.invitations ?? 0)) / 3));
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
        personalityTraits: this.simulatedTraitList(impressions.host.personalityTraits, cursor, `${userScopeKey(counters, 'host')}:${cursor}`),
        personalityBadges: this.toPersonalityBadges(
          this.simulatedTraitList(impressions.host.personalityTraits, cursor, `${userScopeKey(counters, 'host')}:${cursor}`)
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
        personalityTraits: this.simulatedTraitList(impressions.member.personalityTraits, cursor, `${userScopeKey(counters, 'member')}:${cursor}`),
        personalityBadges: this.toPersonalityBadges(
          this.simulatedTraitList(impressions.member.personalityTraits, cursor, `${userScopeKey(counters, 'member')}:${cursor}`)
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

  static hasImpressionsData(impressions: UserImpressionsDto | undefined): boolean {
    return this.hasImpressionsSectionData(impressions?.host)
      || this.hasImpressionsSectionData(impressions?.member);
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

  static seededMetric(
    user: Pick<UserDto, 'id' | 'name' | 'city'>,
    offset: number,
    min: number,
    max: number
  ): number {
    const source = `${user.id}-${user.name}-${user.city}-${offset}`;
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
      hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
    }
    return min + (hash % (max - min + 1));
  }

  private static buildDefaultImpressions(user: UserDto): UserImpressionsDto {
    const hostTotalEvents = this.seededMetric(user, 9, 12, 80);
    const hostAttendanceTotal = hostTotalEvents * this.seededMetric(user, 18, 8, 14);
    const hostAttendanceAttended = Math.floor(hostAttendanceTotal * (this.seededMetric(user, 2, 74, 96) / 100));
    const hostNoShowCount = Math.max(0, hostAttendanceTotal - hostAttendanceAttended);
    const hostPeopleMet = this.seededMetric(user, 32, 90, 520);
    const hostRepeatCount = Math.floor(
      this.seededMetric(user, 19, 60, 220) * (this.seededMetric(user, 4, 36, 84) / 100)
    );

    const memberTotalEvents = hostTotalEvents;
    const memberPeopleMet = this.seededMetric(user, 24, 80, 460);
    const memberAttendanceTotal = 100;
    const memberAttendanceAttended = this.seededMetric(user, 23, 4, 96);
    const memberNoShowCount = Math.max(0, memberAttendanceTotal - memberAttendanceAttended);
    const memberRepeatCount = Math.floor(memberPeopleMet * (this.seededMetric(user, 33, 18, 72) / 100));

    return {
      host: {
        unreadCount: Math.max(0, Math.trunc((user.activities.hosting + user.activities.events) / 2)),
        averageRating: this.seededMetric(user, 1, 38, 50) / 10,
        peopleMet: hostPeopleMet,
        totalEvents: hostTotalEvents,
        repeatCount: hostRepeatCount,
        noShowCount: hostNoShowCount,
        vibeBadges: [`Music ${this.seededMetric(user, 20, 18, 86)}%`],
        personalityTraits: this.buildSeededTraitList(user, 'host'),
        personalityBadges: this.toPersonalityBadges(this.buildSeededTraitList(user, 'host')),
        categoryBadges: [
          `Sports ${this.seededMetric(user, 21, 8, 48)}%`,
          `Road Trip ${this.seededMetric(user, 22, 6, 36)}%`
        ]
      },
      member: {
        unreadCount: Math.max(0, Math.trunc((user.activities.game + user.activities.chat + user.activities.invitations) / 3)),
        peopleMet: memberPeopleMet,
        totalEvents: memberTotalEvents,
        repeatCount: memberRepeatCount,
        noShowCount: memberNoShowCount,
        vibeBadges: [
          `Outdoors ${this.seededMetric(user, 29, 40, 95)}%`,
          `Games ${this.seededMetric(user, 30, 35, 95)}%`
        ],
        personalityTraits: this.buildSeededTraitList(user, 'member'),
        personalityBadges: this.toPersonalityBadges(this.buildSeededTraitList(user, 'member')),
        categoryBadges: [`Culture ${this.seededMetric(user, 31, 25, 90)}%`]
      }
    };
  }

  private static mergeImpressionsSection(
    defaults: UserImpressionsSectionDto | undefined,
    incoming: UserImpressionsSectionDto | undefined
  ): UserImpressionsSectionDto | undefined {
    if (!defaults && !incoming) {
      return undefined;
    }
    const next: UserImpressionsSectionDto = {
      ...(defaults ?? {}),
      ...(incoming ?? {})
    };
    next.vibeBadges = [...(incoming?.vibeBadges ?? defaults?.vibeBadges ?? [])];
    next.personalityBadges = [...(incoming?.personalityBadges ?? defaults?.personalityBadges ?? [])];
    next.personalityTraits = (incoming?.personalityTraits ?? defaults?.personalityTraits ?? []).map(trait => ({ ...trait }));
    next.categoryBadges = [...(incoming?.categoryBadges ?? defaults?.categoryBadges ?? [])];
    return next;
  }

  private static simulatedMetricValue(baseValue: number | undefined, cursor: number, maxSwing: number): number | undefined {
    if (!Number.isFinite(baseValue)) {
      return undefined;
    }
    const seeded = AppUtils.hashText(`metric:${cursor}:${baseValue}`);
    const swing = (seeded % ((maxSwing * 2) + 1)) - maxSwing;
    return Math.max(0, Math.trunc(Number(baseValue)) + swing);
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

  private static buildSeededTraitList(
    user: UserDto,
    scope: 'host' | 'member'
  ): UserPersonalityTraitDto[] {
    const baseScores = new Map<string, number>();
    for (const trait of this.personalityTraitCatalog) {
      baseScores.set(trait.id, 3);
    }
    const dominantTraitId = this.resolveTraitId(user.traitLabel) ?? this.personalityTraitCatalog[0]?.id ?? 'social-charmer';
    const dominantIndex = Math.max(0, this.personalityTraitCatalog.findIndex(trait => trait.id === dominantTraitId));
    const scopeOffset = scope === 'host' ? 37 : 61;
    const secondaryIndex = (dominantIndex + 2 + (this.seededMetric(user, scopeOffset, 0, 1))) % this.personalityTraitCatalog.length;
    const tertiaryIndex = (dominantIndex + 5 + (this.seededMetric(user, scopeOffset + 1, 0, 2))) % this.personalityTraitCatalog.length;
    baseScores.set(dominantTraitId, (baseScores.get(dominantTraitId) ?? 0) + (scope === 'host' ? 34 : 42));
    baseScores.set(this.personalityTraitCatalog[secondaryIndex]?.id ?? dominantTraitId, (baseScores.get(this.personalityTraitCatalog[secondaryIndex]?.id ?? dominantTraitId) ?? 0) + 18);
    baseScores.set(this.personalityTraitCatalog[tertiaryIndex]?.id ?? dominantTraitId, (baseScores.get(this.personalityTraitCatalog[tertiaryIndex]?.id ?? dominantTraitId) ?? 0) + 10);
    return this.toTraitList(user, scope, baseScores);
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

  private static toTraitList(
    user: Pick<UserDto, 'id' | 'name' | 'city' | 'traitLabel'>,
    scope: 'host' | 'member',
    scores: Map<string, number>
  ): UserPersonalityTraitDto[] {
    const ordered = this.personalityTraitCatalog
      .map(trait => ({ trait, score: scores.get(trait.id) ?? 0 }))
      .sort((left, right) => right.score - left.score || left.trait.label.localeCompare(right.trait.label));
    const total = ordered.reduce((sum, entry) => sum + entry.score, 0);
    const percents = ordered.map(entry => Math.max(1, Math.round((entry.score * 100) / Math.max(1, total))));
    const delta = 100 - percents.reduce((sum, value) => sum + value, 0);
    if (percents.length > 0 && delta !== 0) {
      percents[0] = Math.max(1, percents[0] + delta);
    }
    return ordered.map((entry, index) => ({
      id: entry.trait.id,
      label: entry.trait.label,
      percent: percents[index],
      evidenceCount: this.seededMetric(user, 90 + index + (scope === 'host' ? 0 : 13), 2, 12),
      lastRatedAtIso: new Date(Date.UTC(2026, 2, this.seededMetric(user, 120 + index + (scope === 'host' ? 0 : 13), 1, 24), 12, 0, 0)).toISOString()
    }));
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

  private static resolveTraitId(label: string | undefined): string | null {
    const normalized = `${label ?? ''}`.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    const direct = this.personalityTraitCatalog.find(trait =>
      trait.id === normalized
      || trait.label.toLowerCase() === normalized
      || trait.aliases.some(alias => alias.toLowerCase() === normalized)
    );
    if (direct) {
      return direct.id;
    }
    const byWordTail = this.personalityTraitCatalog.find(trait =>
      normalized.endsWith(trait.label.toLowerCase())
      || trait.aliases.some(alias => normalized.endsWith(alias.toLowerCase()))
    );
    return byWordTail?.id ?? null;
  }
}

function userScopeKey(counters: UserRealtimeCountersDto, scope: 'host' | 'member'): string {
  const hostBias = scope === 'host'
    ? `${counters.events ?? 0}:${counters.hosting ?? 0}`
    : `${counters.game ?? 0}:${counters.chat ?? 0}`;
  return `${scope}:${hostBias}`;
}
