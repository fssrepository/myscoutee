import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../core/base/models';
import { AppUtils } from '../../../app-utils';
import type { ChatMenuItem } from '../../../demo-data';
import type { DemoChatRecord } from '../../demo/models/chats.model';

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

@Injectable({
  providedIn: 'root'
})
export class HttpChatsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async queryChatItemsByUser(userId: string): Promise<DemoChatRecord[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<DemoChatRecord[] | null>(`${this.apiBaseUrl}/activities/chats`, {
          params: new HttpParams().set('userId', normalizedUserId)
        })
        .toPromise();
      if (!Array.isArray(response)) {
        return [];
      }
      return response.map(record => ({ ...record, memberIds: [...(record.memberIds ?? [])] }));
    } catch {
      return [];
    }
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
}
