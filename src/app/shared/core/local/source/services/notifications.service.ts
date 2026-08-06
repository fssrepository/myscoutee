import { Injectable, inject } from '@angular/core';

import type {
  NotificationListFilters,
  NotificationPageResultDto,
  NotificationPreferencesRequestDto,
  NotificationPreferencesResponseDto,
  NotificationReadResponseDto,
  NotificationService,
  NotificationSyncRequestDto,
  NotificationSyncResponseDto
} from '../../../contracts/notification.interface';
import type { ListQuery } from '../../../contracts/list.interface';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalNotificationMapper } from '../mappers/notification.mapper';
import { LocalNotificationsRepository } from '../repositories/notifications.repository';
import { LocalUsersService } from './users.service';

@Injectable({
  providedIn: 'root'
})
export class LocalNotificationsService extends LocalRouteDelayService implements NotificationService {
  private static readonly ROUTE = '/notifications';

  private readonly repository = inject(LocalNotificationsRepository);
  private readonly usersService = inject(LocalUsersService);

  async queryPage(
    userId: string,
    query: ListQuery<NotificationListFilters>,
    signal?: AbortSignal
  ): Promise<NotificationPageResultDto> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return {
        items: [],
        total: 0,
        nextCursor: null,
        context: { unreadCount: 0, muted: false }
      };
    }
    await this.repository.whenReady();
    await this.waitForRouteDelay(LocalNotificationsService.ROUTE, signal);
    const page = LocalNotificationMapper.toDtoPage(
      this.repository.queryPage(normalizedUserId, query)
    );
    return {
      items: page.records,
      total: page.total,
      nextCursor: page.nextCursor,
      context: {
        unreadCount: page.unreadCount,
        muted: page.muted
      }
    };
  }

  async markRead(
    userId: string,
    notificationId: string,
    signal?: AbortSignal
  ): Promise<NotificationReadResponseDto> {
    const normalizedUserId = userId.trim();
    const normalizedNotificationId = notificationId.trim();
    if (!normalizedUserId || !normalizedNotificationId) {
      throw new Error('Notification could not be marked as read.');
    }
    await this.repository.whenReady();
    await this.waitForRouteDelay(LocalNotificationsService.ROUTE, signal);
    const notification = this.repository.markRead(normalizedUserId, normalizedNotificationId);
    if (!notification) {
      throw new Error('Notification was not found.');
    }
    const unreadCount = this.repository.unreadCount(normalizedUserId);
    this.usersService.syncRealtimeNotificationCount(normalizedUserId, unreadCount);
    await this.repository.flushToIndexedDb();
    return {
      notification: LocalNotificationMapper.toDto(notification),
      unreadCount
    };
  }

  async sync(
    userId: string,
    request: NotificationSyncRequestDto,
    signal?: AbortSignal
  ): Promise<NotificationSyncResponseDto> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return {
        upserts: [],
        removedIds: [],
        total: 0,
        unreadCount: 0,
        muted: false
      };
    }
    await this.repository.whenReady();
    await this.waitForRouteDelay(LocalNotificationsService.ROUTE, signal);
    const result = this.repository.sync(normalizedUserId, request);
    return {
      upserts: LocalNotificationMapper.toDtoList(result.upserts),
      removedIds: result.removedIds,
      total: result.total,
      unreadCount: result.unreadCount,
      muted: result.muted
    };
  }

  async updatePreferences(
    userId: string,
    request: NotificationPreferencesRequestDto,
    signal?: AbortSignal
  ): Promise<NotificationPreferencesResponseDto> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      throw new Error('Notification preferences could not be updated.');
    }
    await this.repository.whenReady();
    await this.waitForRouteDelay(LocalNotificationsService.ROUTE, signal);
    const muted = this.repository.setMuted(normalizedUserId, request.muted === true);
    await this.repository.flushToIndexedDb();
    return { muted };
  }
}
