import { Injectable, inject } from '@angular/core';

import type {
  ActivityInviteCandidatesPage,
  ActivityInviteCandidatesQuery,
  IActivityInviteCandidatesService
} from '../../../contracts/activity.interface';
import { LocalActivityInviteCandidatesMapper } from '../mappers';
import { LocalActivityInviteCandidatesRepository } from '../repositories/activity-invite-candidates.repository';
import { LocalRouteDelayService } from './route-delay.service';

@Injectable({
  providedIn: 'root'
})
export class LocalActivityInviteCandidatesService extends LocalRouteDelayService implements IActivityInviteCandidatesService {
  private static readonly ROUTE = '/activities/events/invite-candidates';
  private readonly activityInviteCandidatesRepository = inject(LocalActivityInviteCandidatesRepository);

  async queryCandidates(query: ActivityInviteCandidatesQuery): Promise<ActivityInviteCandidatesPage> {
    await this.waitForRouteDelay(LocalActivityInviteCandidatesService.ROUTE);
    const result = await this.activityInviteCandidatesRepository.queryCandidateRecords(query);
    return {
      items: LocalActivityInviteCandidatesMapper.toEntries(query, result.items),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    };
  }
}
