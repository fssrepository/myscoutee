import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../app-types';
import type {
  ActivityInviteCandidatesQuery,
  ActivityInviteCandidatesRepository
} from '../../base/interfaces/activity-invite.interface';

@Injectable({
  providedIn: 'root'
})
export class HttpActivityInviteCandidatesRepository implements ActivityInviteCandidatesRepository {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async queryCandidates(query: ActivityInviteCandidatesQuery): Promise<AppTypes.ActivityMemberEntry[]> {
    try {
      const response = await this.http
        .post<AppTypes.ActivityMemberEntry[] | null>(
          `${this.apiBaseUrl}/activities/events/invite-candidates`,
          {
            activeUserId: query.activeUserId,
            ownerId: query.owner.ownerId,
            sort: query.sort
          }
        )
        .toPromise();
      return Array.isArray(response) ? response.map(entry => ({ ...entry })) : [];
    } catch {
      return [];
    }
  }
}
