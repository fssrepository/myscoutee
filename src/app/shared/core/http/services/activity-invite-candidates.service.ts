import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { ActivityInviteCandidatesQuery, IActivityInviteCandidatesService } from '../../contracts/activity.interface';
import type { ActivityMemberDTO } from '../../contracts/activity.interface';

@Injectable({
  providedIn: 'root'
})
export class HttpActivityInviteCandidatesService implements IActivityInviteCandidatesService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async queryCandidates(query: ActivityInviteCandidatesQuery): Promise<ActivityMemberDTO[]> {
    try {
      const response = await this.http
        .post<ActivityMemberDTO[] | null>(
          `${this.apiBaseUrl}/activities/events/invite-candidates`,
          {
            activeUserId: query.activeUserId,
            ownerId: query.owner.ownerId,
            ownerType: query.owner.ownerType,
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
