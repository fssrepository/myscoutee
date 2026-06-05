import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import type { ActivityInviteCandidatesQuery } from '../../base/interfaces/activity-invite.interface';
import { LocalActivityInviteCandidatesRepository } from '../repositories/activity-invite-candidates.repository';

@Injectable({
  providedIn: 'root'
})
export class LocalActivityInviteCandidatesService {
  private readonly activityInviteCandidatesRepository = inject(LocalActivityInviteCandidatesRepository);

  async queryCandidates(query: ActivityInviteCandidatesQuery): Promise<AppTypes.ActivityMemberEntry[]> {
    return this.activityInviteCandidatesRepository.queryCandidates(query);
  }
}
