import { Injectable, inject } from '@angular/core';

import type {
  ActivityMemberOwnerRef,
  ActivityMembersSummary,
  ActivitiesEventSyncPayload
} from '../../../core/base/models';
import type * as AppTypes from '../../../core/base/models';
import { AppMemoryDb } from '../../../core/base';
import { DemoRouteDelayService } from './demo-route-delay.service';
import { DemoActivityMembersRepository } from '../repositories/activity-members.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoActivityMembersService extends DemoRouteDelayService {
  private static readonly MEMBERS_ROUTE = '/activities/events/members';
  private readonly activityMembersRepository = inject(DemoActivityMembersRepository);
  private readonly memoryDb = inject(AppMemoryDb);

  peekMembersByOwner(owner: ActivityMemberOwnerRef): AppTypes.ActivityMemberEntry[] {
    return this.activityMembersRepository.peekMembersByOwner(owner);
  }

  async queryMembersByOwner(owner: ActivityMemberOwnerRef): Promise<AppTypes.ActivityMemberEntry[]> {
    await this.waitForRouteDelay(DemoActivityMembersService.MEMBERS_ROUTE);
    return this.activityMembersRepository.queryMembersByOwner(owner);
  }

  peekSummaryByOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummary | null {
    return this.activityMembersRepository.peekSummaryByOwner(owner);
  }

  async querySummariesByOwners(owners: readonly ActivityMemberOwnerRef[]): Promise<ActivityMembersSummary[]> {
    await this.waitForRouteDelay(DemoActivityMembersService.MEMBERS_ROUTE);
    return this.activityMembersRepository.querySummariesByOwners(owners);
  }

  async replaceMembersByOwner(
    owner: ActivityMemberOwnerRef,
    members: readonly AppTypes.ActivityMemberEntry[],
    capacityTotal?: number | null
  ): Promise<void> {
    await this.activityMembersRepository.replaceMembersByOwner(owner, members, capacityTotal);
  }

  async syncEventMembersFromEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    await this.waitForRouteDelay(DemoActivityMembersService.MEMBERS_ROUTE);
    await this.activityMembersRepository.syncEventMembersFromEventSnapshot(payload);
    await this.memoryDb.flushToIndexedDb();
  }

}
