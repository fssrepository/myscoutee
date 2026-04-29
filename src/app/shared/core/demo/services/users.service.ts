import { Injectable, inject } from '@angular/core';

import { AppMemoryDb } from '../../base/db';
import { DemoUsersRepository } from '../repositories/users.repository';
import { DemoRouteDelayService } from './demo-route-delay.service';
import type {
  UserByIdQueryResponse,
  UserDeleteRequestDto,
  UserFeedbackSubmitRequestDto,
  UserLocationEligibilityResponseDto,
  UserDto,
  UserLogoutRequestDto,
  UserReportUserSubmitRequestDto,
  UserRealtimeLongPollResponseDto,
  UserProfileImageUploadResult,
  UserService,
  UserSubmitActionResponseDto,
  UsersListQueryResponse
} from '../../base/interfaces/user.interface';
import type { UserGameFilterPreferencesDto } from '../../base/interfaces/game.interface';
import type { LocationCoordinates } from '../../base/interfaces/location.interface';
import {
  DemoUserFilterPreferencesBuilder,
  DemoUserImpressionsBuilder,
  DemoUserMenuCountersBuilder
} from '../builders';
import { DemoActivityMembersRepository } from '../repositories/activity-members.repository';
import { DemoChatsRepository } from '../repositories/chats.repository';
import { DemoEventsRepository } from '../repositories/events.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersService extends DemoRouteDelayService implements UserService {
  private static readonly DEMO_USERS_ROUTE = '/auth/demo-users';
  private static readonly USER_BY_ID_ROUTE = '/auth/me';
  private static readonly USER_FEEDBACK_ROUTE = '/auth/me/feedback';
  private static readonly USER_REPORT_USER_ROUTE = '/auth/me/report-user';
  private static readonly USER_REALTIME_LONG_POLL_ROUTE = '/auth/me/realtime/long-poll';
  private static readonly USER_REALTIME_LONG_POLL_SIMULATION_STEP_MS = 30000;
  private static readonly INITIAL_EVENT_FEEDBACK_UNLOCK_DELAY_MS = 2 * 60 * 60 * 1000;
  private static readonly MAX_PROFILE_IMAGE_SLOTS = 8;
  private static readonly FILTER_PREFERENCES_SAVE_DELAY_MS = 1500;
  private static readonly DELETED_ACCOUNT_PURGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  private readonly chatsRepository = inject(DemoChatsRepository);
  private readonly eventsRepository = inject(DemoEventsRepository);
  private readonly activityMembersRepository = inject(DemoActivityMembersRepository);
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly realtimeCursorByUserId: Record<string, number> = {};
  private readonly realtimeLastAdvanceAtByUserId: Record<string, number> = {};

  async queryAvailableDemoUsers(): Promise<UsersListQueryResponse> {
    await this.waitForRouteDelay(DemoUsersService.DEMO_USERS_ROUTE);
    return {
      users: this.usersRepository.queryAvailableDemoUsers()
    };
  }

  async checkLocationEligibility(_coordinates?: LocationCoordinates | null): Promise<UserLocationEligibilityResponseDto> {
    return {
      eligible: true,
      partitionKey: null,
      message: null,
      securityGateEnabled: false,
      locationRequired: false
    };
  }

  async queryUserById(userId?: string): Promise<UserByIdQueryResponse> {
    await this.memoryDb.whenReady();
    await this.waitForRouteDelay(DemoUsersService.USER_BY_ID_ROUTE);
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
      await this.memoryDb.flushToIndexedDb();
      return {
        user: null,
        filterPreferences: null
      };
    }
    const counterOverrides = loadedUser ? this.buildInitialMenuCounterOverrides(loadedUser) : null;
    const user = loadedUser
      ? DemoUserImpressionsBuilder.withResolvedImpressions(this.withSyncedActivityCounts(loadedUser, counterOverrides))
      : null;
    const allUsers = this.usersRepository.queryGameStackUsers(normalizedUserId);
    const filterCount = allUsers.length;
    const persistedFilterPreferences = this.usersRepository.queryUserFilterPreferences(normalizedUserId);
    return {
      user,
      filterCount,
      counterOverrides,
      filterPreferences: user
        ? (persistedFilterPreferences ?? DemoUserFilterPreferencesBuilder.buildDefaultFilterPreferences(user))
        : null
    };
  }

  async queryUserRealtimeLongPoll(
    userId: string,
    cursor?: string | null
  ): Promise<UserRealtimeLongPollResponseDto | null> {
    await this.waitForRouteDelay(DemoUsersService.USER_REALTIME_LONG_POLL_ROUTE);
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const loadedUser = this.usersRepository.queryUserById(normalizedUserId);
    if (!loadedUser) {
      return null;
    }
    const user = DemoUserImpressionsBuilder.withResolvedImpressions(loadedUser);
    const nextCursor = this.resolveRealtimeCursor(normalizedUserId, this.parseRealtimeCursor(cursor));
    const counters = DemoUserImpressionsBuilder.buildSimulatedRealtimeCounters(user, nextCursor);
    const impressions = DemoUserImpressionsBuilder.buildSimulatedRealtimeImpressions(user.impressions, counters, nextCursor);
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
    return Date.now() - deletedAtMs > DemoUsersService.DELETED_ACCOUNT_PURGE_WINDOW_MS;
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
      || (now - lastAdvanceAt) >= DemoUsersService.USER_REALTIME_LONG_POLL_SIMULATION_STEP_MS;
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
    await this.memoryDb.flushToIndexedDb();
    await this.waitForDelay(DemoUsersService.FILTER_PREFERENCES_SAVE_DELAY_MS);
  }

  async saveUserProfile(user: UserDto): Promise<UserDto | null> {
    if (!user?.id?.trim()) {
      return null;
    }
    return this.usersRepository.upsertUser(user);
  }

  async submitUserFeedback(
    _request: UserFeedbackSubmitRequestDto,
    signal?: AbortSignal
  ): Promise<UserSubmitActionResponseDto> {
    await this.waitForRouteDelay(DemoUsersService.USER_FEEDBACK_ROUTE, signal);
    return {
      submitted: true,
      message: 'Feedback sent successfully. Thank you for helping improve MyScoutee.'
    };
  }

  async submitReportUser(
    request: UserReportUserSubmitRequestDto,
    signal?: AbortSignal
  ): Promise<UserSubmitActionResponseDto> {
    await this.waitForRouteDelay(DemoUsersService.USER_REPORT_USER_ROUTE, signal);
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
    signal?: AbortSignal
  ): Promise<UserSubmitActionResponseDto> {
    await this.waitForRouteDelay(DemoUsersService.USER_BY_ID_ROUTE, signal);
    return {
      submitted: true,
      message: null
    };
  }

  async deleteUser(
    request: UserDeleteRequestDto,
    signal?: AbortSignal
  ): Promise<UserSubmitActionResponseDto> {
    await this.waitForRouteDelay(DemoUsersService.USER_BY_ID_ROUTE, signal);
    const normalizedUserId = request.userId.trim();
    const user = this.usersRepository.queryUserById(normalizedUserId);
    if (user) {
      this.usersRepository.upsertUser({
        ...user,
        profileStatus: 'deleted',
        deletedAtIso: new Date().toISOString()
      });
    }
    return {
      submitted: true,
      message: null
    };
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

  private buildInitialMenuCounterOverrides(user: UserDto) {
    const chatItems = this.chatsRepository.queryChatItemsByUser(user.id);
    const invitationItems = this.eventsRepository.queryInvitationItemsByUser(user.id)
      .filter(item => !item.isTrashed);
    const eventItems = this.eventsRepository.queryEventItemsByUser(user.id)
      .filter(item => !item.isTrashed)
      .filter(item => item.isAdmin !== true || item.published !== false);
    const hostingItems = this.eventsRepository.queryHostingItemsByUser(user.id)
      .filter(item => !item.isTrashed)
      .filter(item => item.isAdmin === true);
    const syncedUser: UserDto = {
      ...user,
      activities: {
        ...user.activities,
        chat: DemoUserMenuCountersBuilder.resolveSectionBadge(
          chatItems.map(item => item.unread),
          chatItems.length
        ),
        invitations: invitationItems.length,
        events: eventItems.length,
        hosting: hostingItems.length
      }
    };
    return DemoUserMenuCountersBuilder.buildInitialMenuCounterOverrides(syncedUser, {
      tickets: this.eventsRepository.countTicketItemsByUser(user.id),
      feedback: this.eventsRepository.countPendingEventFeedbackByUser(
        user.id,
        DemoUsersService.INITIAL_EVENT_FEEDBACK_UNLOCK_DELAY_MS
      )
    });
  }

  private withSyncedActivityCounts(
    user: UserDto,
    counters: ReturnType<DemoUsersService['buildInitialMenuCounterOverrides']> | null
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
        tickets: counters.tickets ?? user.activities.tickets,
        feedback: counters.feedback ?? user.activities.feedback
      }
    };
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
