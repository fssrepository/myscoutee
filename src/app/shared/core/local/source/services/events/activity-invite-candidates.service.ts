import { Injectable, inject } from '@angular/core';

import type {
  ActivityInviteCandidatesPage,
  ActivityInviteCandidatesQuery,
  IActivityInviteCandidatesService
} from '../../../../contracts/common/activity.interface';
import { LocalActivityInviteCandidatesMapper } from '../../mappers';
import { LocalActivityInviteCandidatesRepository } from '../../repositories/events/activity-invite-candidates.repository';
import { LocalRouteDelayService } from '../platform/route-delay.service';

@Injectable({
  providedIn: 'root'
})
export class LocalActivityInviteCandidatesService extends LocalRouteDelayService implements IActivityInviteCandidatesService {
  private static readonly ROUTE = '/activities/events/invite-candidates';
  private readonly activityInviteCandidatesRepository = inject(LocalActivityInviteCandidatesRepository);

  async queryCandidates(query: ActivityInviteCandidatesQuery): Promise<ActivityInviteCandidatesPage> {
    const [, response] = await Promise.all([
      this.waitForRouteDelay(LocalActivityInviteCandidatesService.ROUTE),
      (async (): Promise<ActivityInviteCandidatesPage> => {
        const result = await this.activityInviteCandidatesRepository.queryCandidateRecords(query);
        return {
          items: LocalActivityInviteCandidatesMapper.toEntries(query, result.items),
          total: result.total,
          page: result.page,
          pageSize: result.pageSize
        };
      })()
    ]);
    return response;
  }
}
