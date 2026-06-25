import { AppUtils } from '../../../app-utils';
import type { UserDto } from '../../contracts/user.interface';
import type { LocationCoordinates } from '../../contracts/user.interface';
import type { ActivityEventRecord, ActivityEventRepositoryItemType } from '../../contracts/activity.interface';
import { PricingBuilder } from './pricing.builder';
import { UserProfileStateBuilder } from './user-profile-state.builder';

export class ActivityEventRecordBuilder {
  static cloneRecord(record: ActivityEventRecord): ActivityEventRecord {
    return {
      ...record,
      adminIds: [...(record.adminIds ?? [])],
      locationCoordinates: this.cloneLocationCoordinates(record.locationCoordinates),
      pricing: record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : undefined,
      policies: (record.policies ?? []).map(item => ({ ...item })),
      slotTemplates: (record.slotTemplates ?? []).map(item => ({ ...item })),
      nextSlot: record.nextSlot ? { ...record.nextSlot } : null,
      upcomingSlots: (record.upcomingSlots ?? []).map(item => ({ ...item })),
      acceptedMemberUserIds: [...(record.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(record.pendingMemberUserIds ?? [])],
      invitedMemberUserIds: [...(record.invitedMemberUserIds ?? [])],
      pendingRequestMemberUserIds: [...(record.pendingRequestMemberUserIds ?? [])],
      topics: [...(record.topics ?? [])],
      subEventDefinitions: (record.subEventDefinitions ?? []).map(item => ({
        ...item,
        groups: (item.groups ?? []).map(group => ({ ...group })),
        pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing
      })),
      subEvents: (record.subEvents ?? []).map(item => ({
        ...item,
        pricing: item.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : item.pricing
      }))
    };
  }

  static buildRecordKey(
    userId: string,
    type: ActivityEventRepositoryItemType,
    sourceId: string
  ): string {
    return `${userId}:${type}:${sourceId}`;
  }

  static inferredEventMode(items: readonly { optional?: boolean; groups?: readonly unknown[] }[]): 'Casual' | 'Tournament' {
    if (items.some(item => !item.optional && (item.groups?.length ?? 0) > 0)) {
      return 'Tournament';
    }
    return 'Casual';
  }

  static normalizeEventMode(value: unknown): 'Casual' | 'Tournament' {
    return `${value ?? ''}`.trim().toLowerCase() === 'tournament' ? 'Tournament' : 'Casual';
  }

  static resolveEventAffinity(options: {
    id: string;
    title: string;
    subtitle?: string | null;
    topics: readonly string[];
    visibility: string;
    blindMode: string;
    creator?: Partial<UserDto> | null;
    acceptedUsers?: ReadonlyArray<Partial<UserDto> | null | undefined>;
    rating?: number | null;
    acceptedMembers?: number | null;
    capacityTotal?: number | null;
  }): number {
    const participantUsers = [options.creator ?? null, ...(options.acceptedUsers ?? [])]
      .filter((user): user is Partial<UserDto> => Boolean(user));
    const participantAffinities = participantUsers
      .filter(user => typeof user.id === 'string' && user.id.trim().length > 0)
      .map(user => UserProfileStateBuilder.resolveUserAffinity({
        id: `${user.id}`,
        name: `${user.name ?? 'Unknown User'}`,
        age: Math.max(18, Math.trunc(Number(user.age) || 30)),
        city: `${user.city ?? ''}`,
        height: `${user.height ?? '170 cm'}`,
        physique: `${user.physique ?? ''}`,
        languages: [...(user.languages ?? [])],
        horoscope: `${user.horoscope ?? ''}`,
        gender: user.gender === 'woman' ? 'woman' : 'man',
        hostTier: `${user.hostTier ?? ''}`,
        traitLabel: `${user.traitLabel ?? ''}`,
        completion: Math.max(0, Math.trunc(Number(user.completion) || 0))
      }));
    const averageParticipantAffinity = participantAffinities.length > 0
      ? Math.round(participantAffinities.reduce((total, value) => total + value, 0) / participantAffinities.length)
      : 0;
    const tokens = this.uniqueAffinityTokens([
      options.title,
      options.subtitle ?? '',
      ...options.topics,
      options.visibility,
      options.blindMode,
      ...participantUsers.flatMap(user => [
        `${user.city ?? ''}`,
        `${user.physique ?? ''}`,
        ...((user.languages ?? []) as string[]),
        `${user.horoscope ?? ''}`,
        `${user.gender ?? ''}`,
        `${user.hostTier ?? ''}`,
        `${user.traitLabel ?? ''}`
      ])
    ]);
    return (
      this.resolveAffinityTokenScore(tokens, `event:${options.id}`) * 89
      + averageParticipantAffinity
      + Math.round(AppUtils.clampNumber(Number(options.rating) || 0, 0, 10) * 100) * 29
      + Math.max(0, Math.trunc(Number(options.acceptedMembers) || 0)) * 19
      + Math.max(0, Math.trunc(Number(options.capacityTotal) || 0)) * 7
    );
  }

  private static cloneLocationCoordinates(
    value: LocationCoordinates | null | undefined
  ): LocationCoordinates | null {
    if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) {
      return null;
    }
    return {
      latitude: value.latitude,
      longitude: value.longitude
    };
  }

  private static uniqueAffinityTokens(values: readonly string[]): string[] {
    const seen = new Set<string>();
    for (const value of values) {
      const normalized = AppUtils.normalizeText(`${value ?? ''}`.replace(/^#+\s*/, '').trim());
      if (normalized) {
        seen.add(normalized);
      }
    }
    return [...seen];
  }

  private static resolveAffinityTokenScore(tokens: readonly string[], seedPrefix: string): number {
    return tokens.reduce((total, token) => total + ((AppUtils.hashText(`${seedPrefix}:${token}`) % 997) + 1), 0);
  }
}
