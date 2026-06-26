import { Injectable, inject } from '@angular/core';

import type { ActivityInviteCandidatesQuery, IActivityInviteCandidatesService } from '../../../contracts/activity.interface';
import type { ActivityMemberEntry } from '../../../contracts/activity.interface';
import { LocalActivityInviteCandidatesMapper } from '../mappers';
import { LocalActivityInviteCandidatesRepository } from '../repositories/activity-invite-candidates.repository';
import { LocalRouteDelayService } from './route-delay.service';

@Injectable({
  providedIn: 'root'
})
export class LocalActivityInviteCandidatesService extends LocalRouteDelayService implements IActivityInviteCandidatesService {
  private static readonly ROUTE = '/activities/events/invite-candidates';
  private readonly activityInviteCandidatesRepository = inject(LocalActivityInviteCandidatesRepository);

  async queryCandidates(query: ActivityInviteCandidatesQuery): Promise<ActivityMemberEntry[]> {
    await this.waitForRouteDelay(LocalActivityInviteCandidatesService.ROUTE);
    const records = await this.activityInviteCandidatesRepository.queryCandidateRecords(query);
    return LocalActivityInviteCandidatesMapper.toEntries(query, records);
  }
}
