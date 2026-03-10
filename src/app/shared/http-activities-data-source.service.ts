import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../environments/environment';
import type * as AppTypes from './app-types';
import { AppUtils } from './app-utils';
import type { ActivitiesEventSyncPayload, ActivitiesPageRequest, ActivitiesPageResult } from './activities-models';
import type { ActivitiesDataSource } from './activities-data-source';
import type { ChatMenuItem } from './demo-data';

interface HttpChatMessageDto {
  id: string;
  senderId: string;
  senderName: string;
  senderInitials: string;
  senderGender: 'woman' | 'man';
  text: string;
  sentAtIso: string;
  readBy?: Array<{
    id: string;
    initials: string;
    gender: 'woman' | 'man';
  }>;
}

interface HttpActivitiesPageDto {
  rows: AppTypes.ActivityListRow[];
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class HttpActivitiesDataSourceService implements ActivitiesDataSource {
  readonly mode = 'http' as const;

  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async syncEvent(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    await this.http.post<void>(`${this.apiBaseUrl}/activities/events/sync`, payload).toPromise();
  }

  async loadChatMessages(chat: ChatMenuItem): Promise<AppTypes.ChatPopupMessage[]> {
    const response = await this.http
      .get<HttpChatMessageDto[]>(`${this.apiBaseUrl}/activities/chats/${encodeURIComponent(chat.id)}/messages`)
      .toPromise();

    const messages = (response ?? []).map(message => {
      const sentAt = new Date(message.sentAtIso);
      return {
        id: message.id,
        sender: message.senderName,
        senderAvatar: {
          id: message.senderId,
          initials: message.senderInitials,
          gender: message.senderGender
        },
        text: message.text,
        time: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        sentAtIso: message.sentAtIso,
        mine: false,
        readBy: (message.readBy ?? []).map(reader => ({
          id: reader.id,
          initials: reader.initials,
          gender: reader.gender
        }))
      } satisfies AppTypes.ChatPopupMessage;
    });

    return messages.sort((first, second) => AppUtils.toSortableDate(first.sentAtIso) - AppUtils.toSortableDate(second.sentAtIso));
  }

  async loadActivitiesPage(request: ActivitiesPageRequest): Promise<ActivitiesPageResult | null> {
    const response = await this.http
      .post<HttpActivitiesPageDto>(`${this.apiBaseUrl}/activities/feed`, request)
      .toPromise();
    if (!response) {
      return null;
    }
    return {
      rows: response.rows ?? [],
      total: Number.isFinite(response.total) ? Math.max(0, Math.trunc(response.total)) : 0
    };
  }
}
