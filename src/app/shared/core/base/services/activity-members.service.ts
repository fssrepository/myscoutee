import {
  Injectable,
  inject
} from '@angular/core';

import {
  LocalActivityMembersService
} from '../../local/source/services/activity-members.service';
import {
  HttpActivityMembersService
} from '../../http/services/activity-members.service';
import {
  BaseRouteModeService
} from './base-route-mode.service';
import { RouteDelayService } from './route-delay.service';
import type { ActivityMemberOwnerType } from '../../common/constants';
import type { ActivityMemberOwnerRef, ActivityMembersQueryOptions, ActivityMembersSummaryDto } from '../../contracts/activity.interface';
import type * as ActivityContracts from '../../contracts/activity.interface';
import { UserProfileStore } from '../../../ui/context/stores/user-profile.store';
import { ActivityStore } from '../../../ui/context/stores/activity.store';

@Injectable({
  providedIn: 'root'
})
export class ActivityMembersService extends BaseRouteModeService {
  private static readonly MEMBERS_ROUTE = '/activities/events/members';
  private static readonly OWNER_TYPES: readonly ActivityMemberOwnerType[] = ['event', 'subEvent', 'group', 'asset'];
  private readonly localActivityMembersService = inject(LocalActivityMembersService);
  private readonly httpActivityMembersService = inject(HttpActivityMembersService);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly activityStore = inject(ActivityStore);
  private readonly routeDelay = inject(RouteDelayService);
  private get activityMembersService(): LocalActivityMembersService | HttpActivityMembersService {
    return this.resolveRouteService(ActivityMembersService.MEMBERS_ROUTE, this.localActivityMembersService, this.httpActivityMembersService);
  }

  usesLocalDataSource(): boolean {
    return this.isLocalRouteEnabled(ActivityMembersService.MEMBERS_ROUTE);
  }

  async waitForMembersRouteDelay(): Promise<void> {
    if (!this.isLocalRouteEnabled(ActivityMembersService.MEMBERS_ROUTE)) {
      return;
    }
    await this.routeDelay.waitForRouteDelay(ActivityMembersService.MEMBERS_ROUTE);
  }

  peekMembersByOwner(owner: ActivityMemberOwnerRef): ActivityContracts.ActivityMemberDTO[] {
    return this.presentMembers(this.activityMembersService.peekMembersByOwner(owner));
  }

  peekMembersByOwnerId(ownerId: string): ActivityContracts.ActivityMemberDTO[] {
    const owner = this.peekOwnerRefById(ownerId);
    if (!owner) {
      return [];
    }
    return this.peekMembersByOwner(owner);
  }

  async queryMembersByOwner(
    owner: ActivityMemberOwnerRef,
    options?: ActivityMembersQueryOptions
  ): Promise<ActivityContracts.ActivityMemberDTO[]> {
    return this.presentMembers(await this.activityMembersService.queryMembersByOwner(owner, options));
  }

  async queryMembersByOwnerId(
    ownerId: string,
    options?: ActivityMembersQueryOptions
  ): Promise<ActivityContracts.ActivityMemberDTO[]> {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return [];
    }
    const owner = this.peekOwnerRefById(normalizedOwnerId) ?? this.ownerRef('event', normalizedOwnerId);
    return this.queryMembersByOwner(owner, options);
  }

  peekSummaryByOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummaryDto | null {
    return this.activityMembersService.peekSummaryByOwner(owner);
  }

  peekSummaryByOwnerId(ownerId: string): ActivityMembersSummaryDto | null {
    const owner = this.peekOwnerRefById(ownerId);
    if (!owner) {
      return null;
    }
    return this.peekSummaryByOwner(owner);
  }

  async querySummariesByOwners(owners: readonly ActivityMemberOwnerRef[]): Promise<ActivityMembersSummaryDto[]> {
    return this.activityMembersService.querySummariesByOwners(owners);
  }

  async querySummaryByOwnerId(ownerId: string): Promise<ActivityMembersSummaryDto | null> {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return null;
    }
    const cachedSummary = this.peekSummaryByOwnerId(normalizedOwnerId);
    if (cachedSummary) {
      return cachedSummary;
    }
    const owner = this.peekOwnerRefById(normalizedOwnerId) ?? this.ownerRef('event', normalizedOwnerId);
    await this.activityMembersService.queryMembersByOwner(owner);
    return this.activityMembersService.peekSummaryByOwner(owner);
  }

  async replaceMembersByOwner(
    owner: ActivityMemberOwnerRef,
    members: readonly ActivityContracts.ActivityMemberDTO[],
    capacityTotal?: number | null,
    options?: ActivityMembersQueryOptions
  ): Promise<void> {
    const actorUserId = this.userProfileStore.activeUserId().trim() || this.userProfileStore.getActiveUserId().trim();
    await this.activityMembersService.replaceMembersByOwner(
      owner,
      this.prepareMembersForPersistence(members),
      capacityTotal,
      actorUserId,
      options
    );
    this.emitActivityMembersSyncForOwner(owner);
  }

  async replaceMembersByOwnerId(
    ownerId: string,
    members: readonly ActivityContracts.ActivityMemberDTO[],
    capacityTotal?: number | null,
    options?: ActivityMembersQueryOptions
  ): Promise<void> {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return;
    }
    const owner = this.peekOwnerRefById(normalizedOwnerId) ?? this.ownerRef('event', normalizedOwnerId);
    await this.replaceMembersByOwner(owner, members, capacityTotal, options);
  }

  async applyMemberAction(
    owner: ActivityMemberOwnerRef,
    targetUserId: string,
    action: 'accept' | 'remove' | 'disqualify' | 'reinstate' | 'promote-admin' | 'step-down-admin',
    reason?: string | null
  ): Promise<ActivityContracts.ActivityMemberDTO[]> {
    const normalizedOwner = this.ownerRef(owner.ownerType, owner.ownerId.trim());
    if (!normalizedOwner.ownerId.trim()) {
      return [];
    }
    const members = this.presentMembers(await this.activityMembersService.applyMemberAction(
      normalizedOwner,
      this.userProfileStore.activeUserId().trim(),
      targetUserId,
      action,
      reason
    ));
    this.emitActivityMembersSyncForOwner(normalizedOwner);
    return members;
  }

  private emitActivityMembersSyncForOwner(owner: ActivityMemberOwnerRef): void {
    const summary = this.activityMembersService.peekSummaryByOwner(owner);
    if (!summary) {
      return;
    }
    this.emitActivityMembersSync(summary.ownerId, summary.acceptedMembers, summary.pendingMembers, summary.capacityTotal);
  }

  private emitActivityMembersSync(
    id: string,
    acceptedMembers: number,
    pendingMembers: number,
    capacityTotal: number
  ): void {
    this.activityStore.emitActivityMembersSync({
      id,
      acceptedMembers,
      pendingMembers,
      capacityTotal
    });
  }

  private peekOwnerRefById(ownerId: string): ActivityMemberOwnerRef | null {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return null;
    }
    for (const ownerType of ActivityMembersService.OWNER_TYPES) {
      const summary = this.activityMembersService.peekSummaryByOwner(this.ownerRef(ownerType, normalizedOwnerId));
      if (summary) {
        return this.ownerRef(summary.ownerType, summary.ownerId);
      }
    }
    return null;
  }

  private ownerRef(ownerType: ActivityMemberOwnerType, ownerId: string): ActivityMemberOwnerRef {
    return {
      ownerType,
      ownerId
    };
  }

  private presentMembers(entries: readonly ActivityContracts.ActivityMemberDTO[]): ActivityContracts.ActivityMemberDTO[] {
    const activeUserId = this.userProfileStore.activeUserId().trim();
    return entries.map(entry => {
      const invitedByUserId = `${entry.invitedByUserId ?? ''}`.trim() || null;
      return {
        ...entry,
        invitedByUserId,
        invitedByActiveUser: this.isInviteOwnedByActiveUser(entry, activeUserId, invitedByUserId),
        involvements: Array.isArray(entry.involvements)
          ? entry.involvements.map(involvement => ({ ...involvement }))
          : []
      };
    });
  }

  private prepareMembersForPersistence(
    entries: readonly ActivityContracts.ActivityMemberDTO[]
  ): ActivityContracts.ActivityMemberDTO[] {
    const activeUserId = this.userProfileStore.activeUserId().trim();
    return entries.map(entry => {
      const { involvements: _involvements, ...persistedEntry } = entry;
      const isPendingInvite = entry.status === 'pending'
        && (entry.requestKind === 'invite' || entry.requestKind === 'waitlist-invite');
      const invitedByUserId = isPendingInvite
        ? (`${entry.invitedByUserId ?? ''}`.trim() || (entry.invitedByActiveUser && activeUserId ? activeUserId : null))
        : null;
      return {
        ...persistedEntry,
        invitedByUserId,
        invitedByActiveUser: this.isInviteOwnedByActiveUser(entry, activeUserId, invitedByUserId)
      };
    });
  }

  private isInviteOwnedByActiveUser(
    entry: ActivityContracts.ActivityMemberDTO,
    activeUserId: string,
    invitedByUserId: string | null
  ): boolean {
    if (entry.status !== 'pending' || (entry.requestKind !== 'invite' && entry.requestKind !== 'waitlist-invite')) {
      return false;
    }
    return Boolean(invitedByUserId) && invitedByUserId === activeUserId;
  }
}
