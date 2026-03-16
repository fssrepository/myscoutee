import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { DemoChatRecord } from '../../demo/models/chats.model';

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
}
