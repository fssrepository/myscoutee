import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import type {
  NotificationCategory,
  NotificationDto,
  NotificationListFilters,
  NotificationPageResponseDto,
  NotificationPageResultDto,
  NotificationPreferencesRequestDto,
  NotificationPreferencesResponseDto,
  NotificationReadResponseDto,
  NotificationService
} from '../../contracts/notification.interface';
import type { ListQuery } from '../../contracts/list.interface';
import { RouteDelayService } from '../../base/services/route-delay.service';

@Injectable({
  providedIn: 'root'
})
export class HttpNotificationsService implements NotificationService {
  private static readonly ROUTE = '/notifications';

  private readonly http = inject(HttpClient);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async queryPage(
    userId: string,
    query: ListQuery<NotificationListFilters>,
    signal?: AbortSignal
  ): Promise<NotificationPageResultDto> {
    const bucket = query.filters?.bucket === 'new' ? 'new' : 'all';
    let params = new HttpParams()
      .set('bucket', bucket)
      .set('limit', `${Math.max(1, Math.min(100, Math.trunc(Number(query.pageSize) || 20)))}`);
    const normalizedUserId = userId.trim();
    if (normalizedUserId) {
      params = params.set('userId', normalizedUserId);
    }
    const cursor = `${query.cursor ?? ''}`.trim();
    if (cursor) {
      params = params.set('cursor', cursor);
    }
    const response = await this.routeDelay.withRequestTimeout(
      HttpNotificationsService.ROUTE,
      this.requestWithAbort(
        this.http.get<Partial<NotificationPageResponseDto> | null>(
          `${this.apiBaseUrl}${HttpNotificationsService.ROUTE}`,
          { params }
        ),
        signal
      ),
      'Notification request timed out.'
    );
    const records = (Array.isArray(response?.records) ? response.records : [])
      .map(record => this.normalizeNotification(record))
      .filter((record): record is NotificationDto => Boolean(record));
    return {
      items: records,
      total: this.nonNegativeInteger(response?.total, records.length),
      nextCursor: `${response?.nextCursor ?? ''}`.trim() || null,
      context: {
        unreadCount: this.nonNegativeInteger(response?.unreadCount),
        muted: response?.muted === true
      }
    };
  }

  async markRead(
    userId: string,
    notificationId: string,
    signal?: AbortSignal
  ): Promise<NotificationReadResponseDto> {
    const normalizedNotificationId = notificationId.trim();
    if (!normalizedNotificationId) {
      throw new Error('Notification could not be marked as read.');
    }
    let params = new HttpParams();
    if (userId.trim()) {
      params = params.set('userId', userId.trim());
    }
    const response = await this.routeDelay.withRequestTimeout(
      HttpNotificationsService.ROUTE,
      this.requestWithAbort(
        this.http.post<Partial<NotificationReadResponseDto> | null>(
          `${this.apiBaseUrl}${HttpNotificationsService.ROUTE}/${encodeURIComponent(normalizedNotificationId)}/read`,
          {},
          { params }
        ),
        signal
      ),
      'Notification update timed out.'
    );
    const notification = this.normalizeNotification(response?.notification);
    if (!notification) {
      throw new Error('Notification update returned an invalid response.');
    }
    return {
      notification,
      unreadCount: this.nonNegativeInteger(response?.unreadCount)
    };
  }

  async updatePreferences(
    userId: string,
    request: NotificationPreferencesRequestDto,
    signal?: AbortSignal
  ): Promise<NotificationPreferencesResponseDto> {
    let params = new HttpParams();
    if (userId.trim()) {
      params = params.set('userId', userId.trim());
    }
    const response = await this.routeDelay.withRequestTimeout(
      HttpNotificationsService.ROUTE,
      this.requestWithAbort(
        this.http.put<Partial<NotificationPreferencesResponseDto> | null>(
          `${this.apiBaseUrl}${HttpNotificationsService.ROUTE}/preferences`,
          { muted: request.muted === true },
          { params }
        ),
        signal
      ),
      'Notification preference update timed out.'
    );
    return { muted: response?.muted === true };
  }

  private normalizeNotification(
    value: Partial<NotificationDto> | null | undefined
  ): NotificationDto | null {
    const id = `${value?.id ?? ''}`.trim();
    const recipientUserId = `${value?.recipientUserId ?? ''}`.trim();
    const title = `${value?.title ?? ''}`.trim();
    const message = `${value?.message ?? ''}`.trim();
    const createdAtIso = `${value?.createdAtIso ?? ''}`.trim();
    if (!id || !recipientUserId || !title || !message || !createdAtIso) {
      return null;
    }
    const payload = value?.payload && typeof value.payload === 'object'
      ? Object.fromEntries(
          Object.entries(value.payload)
            .map(([key, item]) => [key, `${item ?? ''}`])
        )
      : null;
    return {
      id,
      recipientUserId,
      kind: `${value?.kind ?? ''}`.trim() || 'notification',
      category: this.normalizeCategory(value?.category),
      title,
      message,
      createdAtIso,
      readAtIso: `${value?.readAtIso ?? ''}`.trim() || null,
      senderUserId: `${value?.senderUserId ?? ''}`.trim() || null,
      senderName: `${value?.senderName ?? ''}`.trim() || null,
      senderAvatarUrl: `${value?.senderAvatarUrl ?? ''}`.trim() || null,
      actionPath: `${value?.actionPath ?? ''}`.trim() || null,
      sourceType: `${value?.sourceType ?? ''}`.trim() || null,
      sourceId: `${value?.sourceId ?? ''}`.trim() || null,
      payload
    };
  }

  private normalizeCategory(value: unknown): NotificationCategory {
    const normalized = `${value ?? ''}`.trim();
    switch (normalized) {
      case 'user':
      case 'chat':
      case 'event':
      case 'event-admin':
      case 'asset':
      case 'app-admin':
      case 'scheduled':
        return normalized;
      default:
        return 'app-admin';
    }
  }

  private nonNegativeInteger(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? Math.max(0, Math.trunc(parsed))
      : Math.max(0, Math.trunc(Number(fallback) || 0));
  }

  private requestWithAbort<T>(request$: Observable<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(this.createAbortError());
        return;
      }
      let settled = false;
      let subscription: { unsubscribe: () => void } | null = null;
      const cleanup = () => signal?.removeEventListener('abort', onAbort);
      const onAbort = () => {
        if (settled) {
          return;
        }
        settled = true;
        subscription?.unsubscribe();
        cleanup();
        reject(this.createAbortError());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      subscription = request$.subscribe({
        next: value => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve(value);
        },
        error: error => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          reject(error);
        },
        complete: () => cleanup()
      });
    });
  }

  private createAbortError(): Error {
    const error = new Error('Request aborted.');
    error.name = 'AbortError';
    return error;
  }
}
