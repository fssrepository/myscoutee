import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../app-types';
import type { ActivityInviteCandidatesQuery } from '../../base/interfaces/activity-invite.interface';
import { resolveAdditionalDelayMsForRoute } from '../config';
import { DemoActivityInviteCandidatesRepository } from '../repositories/activity-invite-candidates.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoActivityInviteCandidatesService {
  private static readonly INVITE_ROUTE = '/activities/events/invite-candidates';
  private readonly activityInviteCandidatesRepository = inject(DemoActivityInviteCandidatesRepository);

  async queryCandidates(query: ActivityInviteCandidatesQuery): Promise<AppTypes.ActivityMemberEntry[]> {
    await this.waitForRouteDelay();
    return this.activityInviteCandidatesRepository.queryCandidates(query);
  }

  private async waitForRouteDelay(): Promise<void> {
    const delayMs = resolveAdditionalDelayMsForRoute(DemoActivityInviteCandidatesService.INVITE_ROUTE);
    if (delayMs <= 0) {
      return;
    }
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), delayMs);
    });
  }
}
