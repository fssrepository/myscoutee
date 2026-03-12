import { Injectable, inject } from '@angular/core';

import { AppDemoGenerators } from '../../../app-demo-generators';
import { DemoUsersRepository } from '../repositories/users.repository';
import { resolveAdditionalDelayMsForRoute } from '../config';
import type {
  UserByIdQueryResponse,
  UserDto,
  UserImpressionsDto,
  UserImpressionsSectionDto,
  UserRealtimeLongPollResponseDto,
  UserRealtimeCountersDto,
  UserProfileImageUploadResult,
  UserService,
  UsersListQueryResponse
} from '../../base/interfaces/user.interface';
import type { UserGameFilterPreferencesDto } from '../../base/interfaces/game.interface';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersService implements UserService {
  private static readonly DEMO_USERS_ROUTE = '/auth/demo-users';
  private static readonly USER_BY_ID_ROUTE = '/auth/me';
  private static readonly USER_REALTIME_LONG_POLL_ROUTE = '/auth/me/realtime/long-poll';
  private static readonly MAX_PROFILE_IMAGE_SLOTS = 8;
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly realtimeCursorByUserId: Record<string, number> = {};

  async queryAvailableDemoUsers(): Promise<UsersListQueryResponse> {
    const additionalDelayMs = resolveAdditionalDelayMsForRoute(DemoUsersService.DEMO_USERS_ROUTE);
    if (additionalDelayMs > 0) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), additionalDelayMs);
      });
    }
    return {
      users: this.usersRepository.queryAvailableDemoUsers()
    };
  }

  async queryUserById(userId: string): Promise<UserByIdQueryResponse> {
    const additionalDelayMs = resolveAdditionalDelayMsForRoute(DemoUsersService.USER_BY_ID_ROUTE);
    if (additionalDelayMs > 0) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), additionalDelayMs);
      });
    }
    const normalizedUserId = userId.trim();
    const loadedUser = this.usersRepository.queryUserById(normalizedUserId);
    const user = loadedUser ? this.withResolvedImpressions(loadedUser) : null;
    const allUsers = this.usersRepository.queryGameStackUsers(normalizedUserId);
    const filterCount = allUsers.length;
    const persistedFilterPreferences = this.usersRepository.queryUserFilterPreferences(normalizedUserId);
    return {
      user,
      filterCount,
      filterPreferences: user
        ? (persistedFilterPreferences ?? this.buildDefaultFilterPreferences(user))
        : null
    };
  }

  async queryUserRealtimeLongPoll(
    userId: string,
    _cursor?: string | null
  ): Promise<UserRealtimeLongPollResponseDto | null> {
    const additionalDelayMs = resolveAdditionalDelayMsForRoute(DemoUsersService.USER_REALTIME_LONG_POLL_ROUTE);
    if (additionalDelayMs > 0) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), additionalDelayMs);
      });
    }
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const loadedUser = this.usersRepository.queryUserById(normalizedUserId);
    if (!loadedUser) {
      return null;
    }
    const user = this.withResolvedImpressions(loadedUser);
    const nextCursor = (this.realtimeCursorByUserId[normalizedUserId] ?? 0) + 1;
    this.realtimeCursorByUserId[normalizedUserId] = nextCursor;
    const counters = this.buildSimulatedRealtimeCounters(user, nextCursor);
    const impressions = this.buildSimulatedRealtimeImpressions(user.impressions, counters, nextCursor);
    return {
      userId: normalizedUserId,
      counters,
      impressions,
      cursor: String(nextCursor),
      serverTsIso: new Date().toISOString()
    };
  }

  async saveUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): Promise<void> {
    this.usersRepository.upsertUserFilterPreferences(userId, preferences);
  }

  async saveUserProfile(user: UserDto): Promise<UserDto | null> {
    if (!user?.id?.trim()) {
      return null;
    }
    return this.usersRepository.upsertUser(user);
  }

  async uploadUserProfileImage(
    userId: string,
    file: File,
    slotIndex: number
  ): Promise<UserProfileImageUploadResult> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return {
        uploaded: false,
        imageUrl: null
      };
    }
    const normalizedSlotIndex = this.resolveSlotIndex(slotIndex);
    if (normalizedSlotIndex === null) {
      return {
        uploaded: false,
        imageUrl: null
      };
    }
    const user = this.usersRepository.queryUserById(normalizedUserId);
    if (!user) {
      return {
        uploaded: false,
        imageUrl: null
      };
    }
    const imageDataUrl = await this.readFileAsDataUrl(file);
    if (!imageDataUrl) {
      return {
        uploaded: false,
        imageUrl: null
      };
    }
    const slots: Array<string | null> = Array.from(
      { length: DemoUsersService.MAX_PROFILE_IMAGE_SLOTS },
      (_, index) => user.images?.[index] ?? null
    );
    slots[normalizedSlotIndex] = imageDataUrl;
    this.usersRepository.upsertUser({
      ...user,
      images: slots
        .map(value => value?.trim() ?? '')
        .filter(value => value.length > 0)
    });
    return {
      uploaded: true,
      imageUrl: imageDataUrl
    };
  }

  private buildDefaultFilterPreferences(user: UserDto): UserGameFilterPreferencesDto {
    const parsedHeight = this.parseHeightCm(user.height);
    return {
      ageMin: Math.max(18, user.age - 5),
      ageMax: Math.min(120, user.age + 5),
      heightMinCm: Math.max(40, (parsedHeight ?? 170) - 10),
      heightMaxCm: Math.min(250, (parsedHeight ?? 170) + 10),
      interests: [],
      values: [],
      physiques: [],
      languages: [],
      genders: [],
      horoscopes: [],
      traitLabels: [],
      smoking: [],
      drinking: [],
      workout: [],
      pets: [],
      familyPlans: [],
      children: [],
      loveStyles: [],
      communicationStyles: [],
      sexualOrientations: [],
      religions: []
    };
  }

  private parseHeightCm(value: string): number | null {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(40, Math.min(250, parsed));
  }

  private withResolvedImpressions(user: UserDto): UserDto {
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

  private buildDefaultImpressions(user: UserDto): UserImpressionsDto {
    const hostTotalEvents = AppDemoGenerators.seededMetric(user, 9, 12, 80);
    const hostAttendanceTotal = hostTotalEvents * AppDemoGenerators.seededMetric(user, 18, 8, 14);
    const hostAttendanceAttended = Math.floor(hostAttendanceTotal * (AppDemoGenerators.seededMetric(user, 2, 74, 96) / 100));
    const hostNoShowCount = Math.max(0, hostAttendanceTotal - hostAttendanceAttended);
    const hostPeopleMet = AppDemoGenerators.seededMetric(user, 32, 90, 520);
    const hostRepeatCount = Math.floor(
      AppDemoGenerators.seededMetric(user, 19, 60, 220) * (AppDemoGenerators.seededMetric(user, 4, 36, 84) / 100)
    );

    const memberTotalEvents = hostTotalEvents;
    const memberPeopleMet = AppDemoGenerators.seededMetric(user, 24, 80, 460);
    const memberAttendanceTotal = 100;
    const memberAttendanceAttended = AppDemoGenerators.seededMetric(user, 23, 4, 96);
    const memberNoShowCount = Math.max(0, memberAttendanceTotal - memberAttendanceAttended);
    const memberRepeatCount = Math.floor(memberPeopleMet * (AppDemoGenerators.seededMetric(user, 33, 18, 72) / 100));

    return {
      host: {
        unreadCount: Math.max(0, Math.trunc((user.activities.hosting + user.activities.events) / 2)),
        averageRating: AppDemoGenerators.seededMetric(user, 1, 38, 50) / 10,
        peopleMet: hostPeopleMet,
        totalEvents: hostTotalEvents,
        repeatCount: hostRepeatCount,
        noShowCount: hostNoShowCount,
        vibeBadges: [`Music ${AppDemoGenerators.seededMetric(user, 20, 18, 86)}%`],
        personalityBadges: ['Communication 60%', 'Coordination 40%'],
        categoryBadges: [
          `Sports ${AppDemoGenerators.seededMetric(user, 21, 8, 48)}%`,
          `Road Trip ${AppDemoGenerators.seededMetric(user, 22, 6, 36)}%`
        ]
      },
      member: {
        unreadCount: Math.max(0, Math.trunc((user.activities.game + user.activities.chat + user.activities.invitations) / 3)),
        peopleMet: memberPeopleMet,
        totalEvents: memberTotalEvents,
        repeatCount: memberRepeatCount,
        noShowCount: memberNoShowCount,
        vibeBadges: [
          `Outdoors ${AppDemoGenerators.seededMetric(user, 29, 40, 95)}%`,
          `Games ${AppDemoGenerators.seededMetric(user, 30, 35, 95)}%`
        ],
        personalityBadges: ['Adventurer 60%', 'Deep Thinker 30%', 'Empath 10%'],
        categoryBadges: [`Culture ${AppDemoGenerators.seededMetric(user, 31, 25, 90)}%`]
      }
    };
  }

  private mergeImpressionsSection(
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
    next.categoryBadges = [...(incoming?.categoryBadges ?? defaults?.categoryBadges ?? [])];
    return next;
  }

  private buildSimulatedRealtimeCounters(
    user: UserDto,
    cursor: number
  ): UserRealtimeCountersDto {
    const buildPendingTotal = (
      seedSuffix: string,
      stepMax: number,
      cadenceMax: number
    ): number => {
      const stableSeed = AppDemoGenerators.hashText(`${user.id}:pending:${seedSuffix}`);
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
    return {
      game: gamePending,
      chat: chatPending,
      invitations: invitationsPending,
      events: eventsPending,
      hosting: hostingPending,
      tickets: Math.max(0, Math.trunc((eventsPending + hostingPending) / 2)),
      impressionsHostChanged: AppDemoGenerators.hashText(`${user.id}:${cursor}:imp-host`) % 3 === 0,
      impressionsMemberChanged: AppDemoGenerators.hashText(`${user.id}:${cursor}:imp-member`) % 3 === 0
    };
  }

  private buildSimulatedRealtimeImpressions(
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
        personalityBadges: this.simulatedBadgeList(impressions.host.personalityBadges, cursor, 2),
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
        personalityBadges: this.simulatedBadgeList(impressions.member.personalityBadges, cursor, 2),
        categoryBadges: this.simulatedBadgeList(impressions.member.categoryBadges, cursor, 2)
      }
      : undefined;
    return {
      host,
      member
    };
  }

  private simulatedMetricValue(baseValue: number | undefined, cursor: number, maxSwing: number): number | undefined {
    if (!Number.isFinite(baseValue)) {
      return undefined;
    }
    const seeded = AppDemoGenerators.hashText(`metric:${cursor}:${baseValue}`);
    const swing = (seeded % ((maxSwing * 2) + 1)) - maxSwing;
    return Math.max(0, Math.trunc(Number(baseValue)) + swing);
  }

  private simulatedRatingValue(baseValue: number | undefined, cursor: number, maxSwingTenths: number): number | undefined {
    if (!Number.isFinite(baseValue)) {
      return undefined;
    }
    const normalized = Math.round(Number(baseValue) * 10);
    const seeded = AppDemoGenerators.hashText(`rating:${cursor}:${normalized}`);
    const swing = (seeded % ((maxSwingTenths * 2) + 1)) - maxSwingTenths;
    const nextTenths = Math.max(0, Math.min(50, normalized + swing));
    return nextTenths / 10;
  }

  private simulatedBadgeList(
    badges: readonly string[] | undefined,
    cursor: number,
    maxSwingPercent: number
  ): string[] | undefined {
    if (!Array.isArray(badges)) {
      return undefined;
    }
    return badges.map((badge, index) => this.simulatedBadgeValue(badge, cursor, index, maxSwingPercent));
  }

  private simulatedBadgeValue(
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
    const seeded = AppDemoGenerators.hashText(`badge:${cursor}:${index}:${normalized}`);
    const swing = (seeded % ((maxSwingPercent * 2) + 1)) - maxSwingPercent;
    const nextPercent = Math.max(0, Math.min(100, percent + swing));
    return `${label} ${nextPercent}%`;
  }

  private resolveSlotIndex(slotIndex: number): number | null {
    if (!Number.isFinite(slotIndex)) {
      return null;
    }
    const normalized = Math.trunc(Number(slotIndex));
    if (normalized < 0 || normalized >= DemoUsersService.MAX_PROFILE_IMAGE_SLOTS) {
      return null;
    }
    return normalized;
  }

  private readFileAsDataUrl(file: File): Promise<string | null> {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string' || result.trim().length === 0) {
          resolve(null);
          return;
        }
        resolve(result);
      };
      reader.onerror = () => resolve(null);
      reader.onabort = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }
}
