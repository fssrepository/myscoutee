import { AppUtils } from '../../../app-utils';
import { APP_STATIC_DATA } from '../../../app-static-data';
import { LocalSeedScheduleBuilder } from './seed-schedule.builder';
import type {
  UserDto,
  UserImpressionsDto,
  UserImpressionsSectionDto,
  UserPersonalityTraitDto
} from '../../base/interfaces/user.interface';

export class LocalUserImpressionsSeedBuilder {
  private static readonly personalityTraitCatalog = APP_STATIC_DATA.personalityTraitCatalog;

  static withSeededImpressions(user: UserDto): UserDto {
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

  private static hasImpressionsData(impressions: UserImpressionsDto | undefined): boolean {
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

  private static seededMetric(
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
      lastRatedAtIso: LocalSeedScheduleBuilder
        .shiftDate(new Date(Date.UTC(2026, 2, this.seededMetric(user, 120 + index + (scope === 'host' ? 0 : 13), 1, 24), 12, 0, 0)))
        .toISOString()
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
