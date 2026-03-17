import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  ActivityMemberOwnerRef,
  ActivityMembersSummary,
  ActivitiesEventSyncPayload
} from '../../../activities-models';
import type * as AppTypes from '../../../app-types';
import { DemoActivityMembersService } from '../../demo/services/activity-members.service';
import { HttpActivityMembersService } from '../../http/services/activity-members.service';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class ActivityMembersService {
  private readonly demoActivityMembersService = inject(DemoActivityMembersService);
  private readonly httpActivityMembersService = inject(HttpActivityMembersService);
  private readonly sessionService = inject(SessionService);

  private get demoModeEnabled(): boolean {
    return this.sessionService.currentSession()?.kind === 'demo' || !environment.loginEnabled;
  }

  private get activityMembersService(): DemoActivityMembersService | HttpActivityMembersService {
    return this.demoModeEnabled ? this.demoActivityMembersService : this.httpActivityMembersService;
  }

  peekMembersByOwner(owner: ActivityMemberOwnerRef): AppTypes.ActivityMemberEntry[] {
    return this.activityMembersService.peekMembersByOwner(owner);
  }

  async queryMembersByOwner(owner: ActivityMemberOwnerRef): Promise<AppTypes.ActivityMemberEntry[]> {
    return this.activityMembersService.queryMembersByOwner(owner);
  }

  peekSummaryByOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummary | null {
    return this.activityMembersService.peekSummaryByOwner(owner);
  }

  async querySummariesByOwners(owners: readonly ActivityMemberOwnerRef[]): Promise<ActivityMembersSummary[]> {
    return this.activityMembersService.querySummariesByOwners(owners);
  }

  async replaceMembersByOwner(
    owner: ActivityMemberOwnerRef,
    members: readonly AppTypes.ActivityMemberEntry[],
    capacityTotal?: number | null
  ): Promise<void> {
    await this.activityMembersService.replaceMembersByOwner(owner, members, capacityTotal);
  }

  async syncEventMembersFromEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    await this.activityMembersService.syncEventMembersFromEventSnapshot(payload);
  }
}
