import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  AdminNotificationCenterState,
  AdminNotificationRule,
  AdminNotificationRuleLiveEvent,
  AdminNotificationRunResult
} from '../../contracts/admin.interface';
import { FirebaseAuthService } from '../../base/services/firebase-auth.service';
import { RouteDelayService } from '../../base/services/route-delay.service';

const ADMIN_NOTIFICATION_LOAD_ROUTE = '/admin/notifications';
const ADMIN_NOTIFICATION_SAVE_ROUTE = '/admin/notifications/save';
const ADMIN_NOTIFICATION_RUN_ROUTE = '/admin/notifications/run';

@Injectable({
  providedIn: 'root'
})
export class HttpAdminNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly firebaseAuthService = inject(FirebaseAuthService);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadNotificationCenter(adminUserId?: string | null): Promise<AdminNotificationCenterState> {
    const state = await this.routeDelay.withRequestTimeout(ADMIN_NOTIFICATION_LOAD_ROUTE, this.http
      .get<AdminNotificationCenterState>(`${this.apiBaseUrl}/admin/notifications`, {
        params: { adminUserId: `${adminUserId ?? ''}`.trim() }
      })
      .toPromise(), 'Notification rules request timed out.');
    if (!state) {
      throw new Error('Admin notification center is unavailable.');
    }
    return state;
  }

  async saveNotificationCenter(
    rules: readonly AdminNotificationRule[],
    adminUserId?: string | null
  ): Promise<AdminNotificationCenterState> {
    const state = await this.routeDelay.withRequestTimeout(ADMIN_NOTIFICATION_SAVE_ROUTE, this.http
      .post<AdminNotificationCenterState>(`${this.apiBaseUrl}/admin/notifications`, {
        adminUserId: `${adminUserId ?? ''}`.trim(),
        rules
      })
      .toPromise(), 'Notification rules request timed out.');
    if (!state) {
      throw new Error('Admin notification center save returned no state.');
    }
    return state;
  }

  async runNotificationRule(
    ruleKey: string,
    adminUserId?: string | null
  ): Promise<AdminNotificationRunResult | null> {
    const result = await this.routeDelay.withRequestTimeout(ADMIN_NOTIFICATION_RUN_ROUTE, this.http
      .post<AdminNotificationRunResult>(
        `${this.apiBaseUrl}/admin/notifications/${encodeURIComponent(ruleKey)}/run`,
        { adminUserId: `${adminUserId ?? ''}`.trim() }
      )
      .toPromise(), 'Notification rules request timed out.');
    return result ?? null;
  }

  async loadNotificationRuleRuntime(
    ruleKey: string,
    adminUserId?: string | null
  ): Promise<AdminNotificationRule | null> {
    const rule = await this.routeDelay.withRequestTimeout(ADMIN_NOTIFICATION_LOAD_ROUTE, this.http
      .get<AdminNotificationRule | null>(
        `${this.apiBaseUrl}/admin/notifications/${encodeURIComponent(ruleKey)}/runtime`,
        { params: { adminUserId: `${adminUserId ?? ''}`.trim() } }
      )
      .toPromise(), 'Notification rules request timed out.');
    return rule ?? null;
  }

  subscribeNotificationRuleUpdates(
    adminUserId: string | null | undefined,
    onEvent: (event: AdminNotificationRuleLiveEvent) => void
  ): () => void {
    if (typeof WebSocket === 'undefined' || typeof window === 'undefined') {
      return () => {};
    }
    let closed = false;
    let socket: WebSocket | null = null;
    void this.buildNotificationSocketUrl(adminUserId).then(socketUrl => {
      if (!socketUrl || closed) {
        return;
      }
      socket = new WebSocket(socketUrl);
      socket.onmessage = message => {
        try {
          const event = JSON.parse(`${message.data ?? ''}`) as AdminNotificationRuleLiveEvent;
          if (event?.type === 'rule-runtime' && `${event.ruleKey ?? ''}`.trim()) {
            onEvent(event);
          }
        } catch {
          // Ignore malformed admin notification socket events.
        }
      };
      socket.onerror = () => {
        socket?.close();
      };
    });
    return () => {
      closed = true;
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
    };
  }

  private async buildNotificationSocketUrl(adminUserId: string | null | undefined): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }
    const baseUrl = new URL(`${this.apiBaseUrl.replace(/\/+$/, '')}/admin/notifications/ws`, window.location.origin);
    baseUrl.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const normalizedAdminUserId = `${adminUserId ?? ''}`.trim();
    if (normalizedAdminUserId) {
      baseUrl.searchParams.set('adminUserId', normalizedAdminUserId);
      baseUrl.searchParams.set('userId', normalizedAdminUserId);
    }
    if (this.firebaseAuthService.enabled) {
      const token = await this.firebaseAuthService.getIdToken();
      if (!token) {
        return null;
      }
      baseUrl.searchParams.set('token', token);
    }
    return baseUrl.toString();
  }
}
