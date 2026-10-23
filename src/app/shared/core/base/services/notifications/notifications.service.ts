import { HTTP_ADAPTER, LOCAL_ADAPTER, type AdapterInstance } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { Injectable, inject } from '@angular/core';

import type {
  NotificationListFilters,
  NotificationPageResultDto,
  NotificationPreferencesResponseDto,
  NotificationReadResponseDto,
  NotificationSyncRequestDto,
  NotificationSyncResponseDto
} from '@fssrepository/myscoutee-base/notifications/contracts';
import type { ListQuery } from '@fssrepository/myscoutee-components';

import { RouteDelayService } from '../platform/route-delay.service';
import { BaseRouteModeService } from '../platform/base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService extends BaseRouteModeService {
  private readonly transportAdapters = inject(AdapterProxyService);
  static readonly ROUTE = '/notifications';

  private readonly localNotificationsService = this.transportAdapters.reference(LOCAL_ADAPTER.NOTIFICATIONS);
  private readonly httpNotificationsService = this.transportAdapters.reference(HTTP_ADAPTER.NOTIFICATIONS);
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
      communityActivityDelta: result.communityActivityDelta,
      notification: {
        ...result.notification,
        payload: result.notification.payload ? { ...result.notification.payload } : null
      },
      unreadCount: Math.max(0, Math.trunc(Number(result.unreadCount) || 0))
    };
  }

  async sync(
    userId: string,
    request: NotificationSyncRequestDto,
    signal?: AbortSignal
  ): Promise<NotificationSyncResponseDto> {
    const result = await this.notificationService.sync(userId, request, signal);
    return {
      upserts: result.upserts.map(item => ({
        ...item,
        payload: item.payload ? { ...item.payload } : null
      })),
      removedIds: result.removedIds.map(id => `${id}`.trim()).filter(Boolean),
      total: Math.max(0, Math.trunc(Number(result.total) || 0)),
      unreadCount: Math.max(0, Math.trunc(Number(result.unreadCount) || 0)),
      muted: result.muted === true
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

  private get notificationService(): AdapterInstance<typeof LOCAL_ADAPTER.NOTIFICATIONS> | AdapterInstance<typeof HTTP_ADAPTER.NOTIFICATIONS> {
    return this.resolveRouteService(
      NotificationsService.ROUTE,
      this.localNotificationsService,
      this.httpNotificationsService
    );
  }
}
