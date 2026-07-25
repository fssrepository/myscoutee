import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  ActivityInviteCandidatesPage,
  ActivityInviteCandidatesQuery,
  IActivityInviteCandidatesService
} from '../../contracts/activity.interface';

@Injectable({
  providedIn: 'root'
})
export class HttpActivityInviteCandidatesService implements IActivityInviteCandidatesService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async queryCandidates(query: ActivityInviteCandidatesQuery): Promise<ActivityInviteCandidatesPage> {
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.min(100, Math.trunc(Number(query.pageSize) || 16)));
    try {
      const response = await this.http
        .post<ActivityInviteCandidatesPage | null>(
          `${this.apiBaseUrl}/activities/events/invite-candidates`,
          {
            activeUserId: query.activeUserId,
            ownerId: query.owner.ownerId,
            ownerType: query.owner.ownerType,
            parentOwnerId: query.parentOwner?.ownerId ?? null,
            parentOwnerType: query.parentOwner?.ownerType ?? null,
            existingMemberUserIds: [...new Set(query.existingMemberUserIds.map(userId => userId.trim()).filter(Boolean))],
            pendingInviteUserIds: [...new Set(query.pendingInviteUserIds.map(userId => userId.trim()).filter(Boolean))],
            sort: query.sort,
            page,
            pageSize
          }
        )
        .toPromise();
      return {
        items: Array.isArray(response?.items) ? response.items.map(entry => ({ ...entry })) : [],
        total: Math.max(0, Math.trunc(Number(response?.total) || 0)),
        page,
        pageSize
      };
    } catch {
      return { items: [], total: 0, page, pageSize };
    }
  }
}
