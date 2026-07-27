import { Injectable, inject } from '@angular/core';

import type {
  NotificationListFilters,
  NotificationPageResultDto,
  NotificationPreferencesResponseDto,
  NotificationReadResponseDto
} from '../../contracts/notification.interface';
import type { ListQuery } from '../../contracts/list.interface';
import { LocalNotificationsService } from '../../local/source/services/notifications.service';
import { HttpNotificationsService } from '../../http/services/notifications.service';
import { RouteDelayService } from './route-delay.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService extends BaseRouteModeService {
  static readonly ROUTE = '/notifications';

  private readonly localNotificationsService = inject(LocalNotificationsService);
  private readonly httpNotificationsService = inject(HttpNotificationsService);
  private readonly routeDelay = inject(RouteDelayService);

  async queryPage(
    userId: string,
    query: ListQuery<NotificationListFilters>,
    signal?: AbortSignal
  ): Promise<NotificationPageResultDto> {
    const page = await this.notificationService.queryPage(userId, query, signal);
    return {
      items: page.items.map(item => ({
        ...item,
        payload: item.payload ? { ...item.payload } : null
      })),
      total: Math.max(0, Math.trunc(Number(page.total) || 0)),
      nextCursor: `${page.nextCursor ?? ''}`.trim() || null,
      context: {
        unreadCount: Math.max(0, Math.trunc(Number(page.context?.unreadCount) || 0)),
        muted: page.context?.muted === true
      }
    };
  }

  async markRead(
    userId: string,
    notificationId: string,
    signal?: AbortSignal
  ): Promise<NotificationReadResponseDto> {
    const result = await this.notificationService.markRead(userId, notificationId, signal);
    return {
      notification: {
        ...result.notification,
        payload: result.notification.payload ? { ...result.notification.payload } : null
      },
      unreadCount: Math.max(0, Math.trunc(Number(result.unreadCount) || 0))
    };
  }

  async setMuted(
    userId: string,
    muted: boolean,
    signal?: AbortSignal
  ): Promise<NotificationPreferencesResponseDto> {
    return this.notificationService.updatePreferences(userId, { muted }, signal);
  }

  pollIntervalMs(): number {
    return this.routeDelay.resolveIntervalMs(NotificationsService.ROUTE, 30_000);
  }

  private get notificationService(): LocalNotificationsService | HttpNotificationsService {
    return this.resolveRouteService(
      NotificationsService.ROUTE,
      this.localNotificationsService,
      this.httpNotificationsService
    );
  }
}
