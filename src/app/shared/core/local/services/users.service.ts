import { Injectable, inject } from '@angular/core';

import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalBootstrapService, type LocalBootstrapProgressState } from './bootstrap.service';
import type {
  UserDto,
  UserByIdQueryResponse,
  UserDeleteRequestDto,
  UserFeedbackSubmitRequestDto,
  UserLocationEligibilityResponseDto,
  UserLogoutRequestDto,
  UserReportUserSubmitRequestDto,
  UserRealtimeLongPollResponseDto,
  UserService,
  UserSubmitActionResponseDto,
  UsersListQueryResponse
} from '../../base/interfaces/user.interface';
import type { UserGameFilterPreferencesDto } from '../../base/interfaces/game.interface';
import type { LocationCoordinates } from '../../base/interfaces/location.interface';
import {
  LocalUserFilterPreferencesBuilder,
  LocalUserImpressionsBuilder,
  LocalUserMenuCountersBuilder
} from '../builders';
import { LocalActivityMembersRepository } from '../repositories/activity-members.repository';
import { LocalCountryPartitionsRepository } from '../repositories/country-partitions.repository';
import { APP_STORAGE_KEYS } from '../../base/storage-scope';

@Injectable({
  providedIn: 'root'
})
export class LocalUsersService extends LocalRouteDelayService implements UserService {
  private static readonly INELIGIBLE_REGION_MESSAGE = 'Unavailable in your country';
  private static readonly DEMO_COUNTRY_CODE_STORAGE_KEY = APP_STORAGE_KEYS.demoCountryCode;
  private static readonly DEMO_USERS_ROUTE = '/auth/demo-users';
  private static readonly USER_BY_ID_ROUTE = '/auth/me';
  private static readonly USER_FEEDBACK_ROUTE = '/auth/me/feedback';
  private static readonly USER_REPORT_USER_ROUTE = '/auth/me/report-user';
  private static readonly USER_REALTIME_LONG_POLL_ROUTE = '/auth/me/realtime/long-poll';
  private static readonly USER_FILTER_PREFERENCES_ROUTE = '/auth/me/preferences';
  private static readonly USER_REALTIME_LONG_POLL_SIMULATION_STEP_MS = 30000;
  private static readonly DELETED_ACCOUNT_PURGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  private readonly activityMembersRepository = inject(LocalActivityMembersRepository);
  private readonly bootstrapService = inject(LocalBootstrapService);
  private readonly countryPartitionsRepository = inject(LocalCountryPartitionsRepository);
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly realtimeCursorByUserId: Record<string, number> = {};
  private readonly realtimeLastAdvanceAtByUserId: Record<string, number> = {};

  async queryAvailableDemoUsers(
    _requestTimeoutMs?: number,
    onProgress?: (state: LocalBootstrapProgressState) => void
  ): Promise<UsersListQueryResponse> {
    let routeDelaySettled = false;
    let pendingReadyProgress: LocalBootstrapProgressState | null = null;
    const routeDelayPromise = this.waitForRouteDelay(LocalUsersService.DEMO_USERS_ROUTE)
      .finally(() => {
        routeDelaySettled = true;
      });
    const reportProgress = onProgress
      ? (state: LocalBootstrapProgressState): void => {
          if (state.stage === 'ready' && !routeDelaySettled) {
            pendingReadyProgress = state;
            onProgress({
              percent: 98,
              label: 'Loading demo users',
              stage: 'indexedDb'
            });
            return;
          }
          pendingReadyProgress = null;
          onProgress(state);
        }
      : undefined;

    await this.bootstrapService.ensureReady(reportProgress);
    await routeDelayPromise;
    if (pendingReadyProgress) {
      onProgress?.(pendingReadyProgress);
    }
    return {
      users: this.usersRepository.queryAvailableDemoUsers()
    };
  }

  async prepareUserSession(
    userId: string,
    onProgress?: (state: LocalBootstrapProgressState) => void
  ): Promise<void> {
    await this.bootstrapService.ensureUserReady(userId, onProgress);
  }

  peekCachedUsers(): UserDto[] {
    return this.usersRepository.queryAllUsers().map(user => ({ ...user }));
  }

  peekCachedUserById(userId: string): UserDto | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const user = this.usersRepository.queryUserById(normalizedUserId);
    return user ? { ...user } : null;
  }

  async checkLocationEligibility(coordinates?: LocationCoordinates | null): Promise<UserLocationEligibilityResponseDto> {
    const overrideCountryCode = this.readDemoCountryCodeOverride();
    if (!coordinates && !overrideCountryCode) {
      return {
        eligible: true,
        partitionKey: null,
        message: null,
        securityGateEnabled: false,
        locationRequired: false
      };
    }

    const partitionKey = coordinates
      ? this.countryPartitionsRepository.resolvePartitionKeyByCoordinates(coordinates)
      : this.countryPartitionsRepository.resolvePartitionKeyByCountryCode(overrideCountryCode);
    if (partitionKey) {
      return {
        eligible: true,
        partitionKey,
        message: null,
        securityGateEnabled: true,
        locationRequired: false
      };
    }

    return {
      eligible: false,
      partitionKey: null,
      message: LocalUsersService.INELIGIBLE_REGION_MESSAGE,
      securityGateEnabled: true,
      locationRequired: false
    };
  }

  private readDemoCountryCodeOverride(): string {
    if (typeof localStorage === 'undefined') {
      return '';
    }
    try {
      return this.normalizeCountryCode(localStorage.getItem(LocalUsersService.DEMO_COUNTRY_CODE_STORAGE_KEY));
    } catch {
      return '';
    }
  }

  private normalizeCountryCode(countryCode: string | null | undefined): string {
    return `${countryCode ?? ''}`
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
  }

  async queryUserById(userId?: string, _requestTimeoutMs?: number): Promise<UserByIdQueryResponse> {
    await this.usersRepository.whenReady();
    await this.waitForRouteDelay(LocalUsersService.USER_BY_ID_ROUTE);
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
    if (!normalizedUserId) {
      return {
        user: null,
        filterPreferences: null
      };
    }
    const loadedUser = this.usersRepository.queryUserById(normalizedUserId);
    if (loadedUser?.profileStatus === 'deleted' && this.isDeletedAccountPastPurgeWindow(loadedUser)) {
      this.usersRepository.purgeUser(normalizedUserId);
      await this.usersRepository.flushToIndexedDb();
      return {
        user: null,
        filterPreferences: null
      };
    }
    const counterOverrides = loadedUser ? this.buildInitialMenuCounterOverrides(loadedUser) : null;
    const user = loadedUser
      ? LocalUserImpressionsBuilder.withResolvedImpressions(this.withSeededActivityCounts(loadedUser, counterOverrides))
      : null;
    const allUsers = this.usersRepository.queryGameStackUsers(normalizedUserId);
    const filterCount = allUsers.length;
    const persistedFilterPreferences = this.usersRepository.queryUserFilterPreferences(normalizedUserId);
    return {
      user,
      filterCount,
      counterOverrides,
      filterPreferences: user
        ? (persistedFilterPreferences ?? LocalUserFilterPreferencesBuilder.buildDefaultFilterPreferences(user))
        : null
    };
  }

  async queryUserRealtimeLongPoll(
    userId: string,
    cursor?: string | null,
    _requestTimeoutMs?: number
  ): Promise<UserRealtimeLongPollResponseDto | null> {
    await this.waitForRouteDelay(LocalUsersService.USER_REALTIME_LONG_POLL_ROUTE);
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const loadedUser = this.usersRepository.queryUserById(normalizedUserId);
    if (!loadedUser) {
      return null;
    }
    const user = LocalUserImpressionsBuilder.withResolvedImpressions(loadedUser);
    const nextCursor = this.resolveRealtimeCursor(normalizedUserId, this.parseRealtimeCursor(cursor));
    const counters = LocalUserImpressionsBuilder.buildSimulatedRealtimeCounters(user, nextCursor);
    const impressions = LocalUserImpressionsBuilder.buildSimulatedRealtimeImpressions(user.impressions, counters, nextCursor);
    return {
      userId: normalizedUserId,
      counters,
      impressions,
      cursor: String(nextCursor),
      serverTsIso: new Date().toISOString()
    };
  }

  private parseRealtimeCursor(cursor: string | null | undefined): number | null {
    const normalized = cursor?.trim() ?? '';
    if (!normalized) {
      return null;
    }
    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return Math.trunc(parsed);
  }

  private isDeletedAccountPastPurgeWindow(user: UserDto): boolean {
    const deletedAtMs = Date.parse(`${user.deletedAtIso ?? ''}`.trim());
    if (!Number.isFinite(deletedAtMs)) {
      return false;
    }
    return Date.now() - deletedAtMs > LocalUsersService.DELETED_ACCOUNT_PURGE_WINDOW_MS;
  }

  private resolveRealtimeCursor(userId: string, cursor: number | null): number {
    const now = Date.now();
    if (cursor === null) {
      this.realtimeCursorByUserId[userId] = 0;
      this.realtimeLastAdvanceAtByUserId[userId] = 0;
    }
    const storedCursor = this.realtimeCursorByUserId[userId] ?? 0;
    const currentCursor = cursor !== null
      ? Math.max(storedCursor, cursor)
      : storedCursor;
    this.realtimeCursorByUserId[userId] = currentCursor;

    const lastAdvanceAt = this.realtimeLastAdvanceAtByUserId[userId] ?? 0;
    const shouldAdvance = currentCursor <= 0
      || (now - lastAdvanceAt) >= LocalUsersService.USER_REALTIME_LONG_POLL_SIMULATION_STEP_MS;
    if (!shouldAdvance) {
      return currentCursor;
    }

    const nextCursor = currentCursor + 1;
    this.realtimeCursorByUserId[userId] = nextCursor;
    this.realtimeLastAdvanceAtByUserId[userId] = now;
    return nextCursor;
  }

  async saveUserFilterPreferences(userId: string, preferences: UserGameFilterPreferencesDto): Promise<void> {
    this.usersRepository.upsertUserFilterPreferences(userId, preferences);
    await this.usersRepository.flushToIndexedDb();
    await this.waitForRouteDelay(LocalUsersService.USER_FILTER_PREFERENCES_ROUTE);
  }

  async saveUserProfile(user: UserDto, _requestTimeoutMs?: number): Promise<UserDto | null> {
    if (!user?.id?.trim()) {
      return null;
    }
    const savedUser = this.usersRepository.upsertUser(user);
    await this.usersRepository.flushToIndexedDb();
    return savedUser;
  }

  async submitUserFeedback(
    _request: UserFeedbackSubmitRequestDto,
    signal?: AbortSignal,
    _requestTimeoutMs?: number
  ): Promise<UserSubmitActionResponseDto> {
    await this.waitForRouteDelay(LocalUsersService.USER_FEEDBACK_ROUTE, signal);
    return {
      submitted: true,
      message: 'Feedback sent successfully. Thank you for helping improve MyScoutee.'
    };
  }

  async submitReportUser(
    request: UserReportUserSubmitRequestDto,
    signal?: AbortSignal,
    _requestTimeoutMs?: number
  ): Promise<UserSubmitActionResponseDto> {
    await this.waitForRouteDelay(LocalUsersService.USER_REPORT_USER_ROUTE, signal);
    const normalizedActiveUserId = `${request.userId ?? ''}`.trim();
    const normalizedTargetUserId = `${request.targetUserId ?? ''}`.trim();
    const normalizedEventId = `${request.eventId ?? ''}`.trim();
    if (
      !normalizedActiveUserId
      || !normalizedTargetUserId
      || !normalizedEventId
      || normalizedActiveUserId === normalizedTargetUserId
    ) {
      return {
        submitted: false,
        message: 'Reports can only be submitted for members you shared an event with.'
      };
    }
    const members = this.activityMembersRepository.peekMembersByOwner({
      ownerType: 'event',
      ownerId: normalizedEventId
    });
    const activeMember = members.find(member => member.userId === normalizedActiveUserId && member.status === 'accepted');
    const targetMember = members.find(member => member.userId === normalizedTargetUserId && member.status === 'accepted');
    const normalizedMemberEntryId = `${request.memberEntryId ?? ''}`.trim();
    if (
      !activeMember
      || !targetMember
      || (normalizedMemberEntryId && normalizedMemberEntryId !== targetMember.id)
    ) {
      return {
        submitted: false,
        message: 'Reports can only be submitted for members you shared an event with.'
      };
    }
    const normalizedTarget = request.handle.trim();
    return {
      submitted: true,
      message: `Report submitted successfully for ${normalizedTarget || 'the selected user'}. Our moderation team will review it.`
    };
  }

  async logoutUser(
    _request: UserLogoutRequestDto,
    signal?: AbortSignal,
    _requestTimeoutMs?: number
  ): Promise<UserSubmitActionResponseDto> {
    await this.waitForRouteDelay(LocalUsersService.USER_BY_ID_ROUTE, signal);
    return {
      submitted: true,
      message: null
    };
  }

  async deleteUser(
    request: UserDeleteRequestDto,
    signal?: AbortSignal,
    _requestTimeoutMs?: number
  ): Promise<UserSubmitActionResponseDto> {
    await this.waitForRouteDelay(LocalUsersService.USER_BY_ID_ROUTE, signal);
    const normalizedUserId = request.userId.trim();
    const user = this.usersRepository.queryUserById(normalizedUserId);
    if (user) {
      const previousProfileStatus = user.profileStatus === 'deleted'
        ? (user.previousProfileStatus ?? 'public')
        : user.profileStatus;
      this.usersRepository.upsertUser({
        ...user,
        profileStatus: 'deleted',
        previousProfileStatus,
        deletedAtIso: new Date().toISOString()
      });
    }
    return {
      submitted: true,
      message: null
    };
  }

  private buildInitialMenuCounterOverrides(user: UserDto) {
    return LocalUserMenuCountersBuilder.buildInitialMenuCounterOverrides(user, {
      cars: user.activities.cars ?? 0,
      accommodation: user.activities.accommodation ?? 0,
      supplies: user.activities.supplies ?? 0,
      tickets: user.activities.tickets ?? 0,
      contacts: user.activities.contacts ?? 0,
      feedback: user.activities.feedback ?? 0
    });
  }

  private withSeededActivityCounts(
    user: UserDto,
    counters: ReturnType<LocalUsersService['buildInitialMenuCounterOverrides']> | null
  ): UserDto {
    if (!counters) {
      return user;
    }
    return {
      ...user,
      activities: {
        ...user.activities,
        game: counters.game ?? user.activities.game,
        chat: counters.chat ?? user.activities.chat,
        invitations: counters.invitations ?? user.activities.invitations,
        events: counters.events ?? user.activities.events,
        hosting: counters.hosting ?? user.activities.hosting,
        cars: counters.cars ?? user.activities.cars,
        accommodation: counters.accommodation ?? user.activities.accommodation,
        supplies: counters.supplies ?? user.activities.supplies,
        tickets: counters.tickets ?? user.activities.tickets,
        contacts: counters.contacts ?? user.activities.contacts,
        feedback: counters.feedback ?? user.activities.feedback,
        event: counters.event ?? user.activities.event,
        asset: counters.asset ?? user.activities.asset,
        eventFeedback: counters.eventFeedback ?? user.activities.eventFeedback,
        adminJobs: counters.adminJobs ?? user.activities.adminJobs,
        adminMetrics: counters.adminMetrics ?? user.activities.adminMetrics
      }
    };
  }

}
