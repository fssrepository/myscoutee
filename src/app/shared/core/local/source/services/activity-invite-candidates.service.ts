import { Injectable, inject } from '@angular/core';

import type { ActivityInviteCandidatesQuery, IActivityInviteCandidatesService } from '../../../contracts/activity.interface';
import type { ActivityMemberEntry } from '../../../contracts/activity.interface';
import { LocalActivityInviteCandidatesMapper } from '../mappers';
import { LocalActivityInviteCandidatesRepository } from '../repositories/activity-invite-candidates.repository';

@Injectable({
  providedIn: 'root'
})
export class LocalActivityInviteCandidatesService implements IActivityInviteCandidatesService {
  private readonly activityInviteCandidatesRepository = inject(LocalActivityInviteCandidatesRepository);

  async queryCandidates(query: ActivityInviteCandidatesQuery): Promise<ActivityMemberEntry[]> {
    const records = await this.activityInviteCandidatesRepository.queryCandidateRecords(query);
    return LocalActivityInviteCandidatesMapper.toEntries(query, records);
  }
}
