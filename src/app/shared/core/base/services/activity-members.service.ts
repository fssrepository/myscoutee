import { CommunityGroupChangesStore } from '../../../ui/context/stores/community-group-changes.store';
import { GroupWorkspaceContextService } from './group-workspace-context.service';
import { LocalCommunityGroupsService } from '../../local/source/services/community-groups.service';
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
import type {
  ActivityMemberOwnerRef,
  ActivityMemberSyncKnownItemDTO,
  ActivityMembersQueryOptions,
  ActivityMembersInviteResultDTO,
  ActivityMembersSyncResultDTO,
  ActivityMembersSummaryDto
} from '../../contracts/activity.interface';
import type * as ActivityContracts from '../../contracts/activity.interface';
import { UserProfileStore } from '../../../ui/context/stores/user-profile.store';
import { ActivityStore } from '../../../ui/context/stores/activity.store';

@Injectable({
  providedIn: 'root'
})
export class ActivityMembersService extends BaseRouteModeService {
  private readonly groupChanges = inject(CommunityGroupChangesStore);
  private static readonly MEMBERS_ROUTE = '/activities/events/members';
  private static readonly OWNER_TYPES: readonly ActivityMemberOwnerType[] = ['event', 'subEvent', 'group', 'asset'];
  private readonly localGroups = inject(LocalCommunityGroupsService);
  private readonly workspace = inject(GroupWorkspaceContextService);
  private localCommunity(owner: ActivityMemberOwnerRef): boolean { return owner.ownerType === 'community' && this.isLocalRouteEnabled('/groups'); }
  private groupActor(): string { return this.workspace.accountId(this.userProfileStore.getActiveUserId()).trim(); }
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
    if (this.localCommunity(owner)) return this.localGroups.roster(this.groupActor(), owner.ownerId);
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
    if (this.localCommunity(owner)) {
      await this.waitForMembersRouteDelay();
      return this.localGroups.roster(this.groupActor(), owner.ownerId, options?.pendingOnly);
    }
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

  async syncMembersByOwner(
    owner: ActivityMemberOwnerRef,
    knownItems: readonly ActivityMemberSyncKnownItemDTO[],
    options?: ActivityMembersQueryOptions,
    signal?: AbortSignal
  ): Promise<ActivityMembersSyncResultDTO> {
    if (this.localCommunity(owner)) {
      signal?.throwIfAborted();
      const rows = await this.queryMembersByOwner(owner, options); signal?.throwIfAborted();
      const revisions = new Map(knownItems.map(item => [item.id, item.revision]));
      const ids = new Set(rows.map(item => item.id));
      return { upserts: rows.filter(row => row.revision !== revisions.get(row.id)),
        removedIds: knownItems.filter(item => !ids.has(item.id)).map(item => item.id), total: rows.length };
    }
    const result = await this.activityMembersService.syncMembersByOwner(
      owner,
      knownItems,
      options,
      signal
    );
    return {
      upserts: this.presentMembers(result.upserts),
      removedIds: [...result.removedIds],
      total: result.total
    };
  }

  pollIntervalMs(): number {
    return this.routeDelay.resolveIntervalMs(ActivityMembersService.MEMBERS_ROUTE, 30_000);
  }

  peekSummaryByOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummaryDto | null {
    if (this.localCommunity(owner)) return this.localGroups.summary(this.groupActor(), owner.ownerId);
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
    const local = owners.filter(owner => this.localCommunity(owner));
    const others = owners.filter(owner => !this.localCommunity(owner));
    return [...local.map(owner => this.localGroups.summary(this.groupActor(), owner.ownerId)),
      ...(others.length ? await this.activityMembersService.querySummariesByOwners(others) : [])];
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
    if (this.localCommunity(owner)) return this.localGroups.summary(this.groupActor(), owner.ownerId);
    return this.activityMembersService.peekSummaryByOwner(owner);
  }

  async replaceMembersByOwner(
    owner: ActivityMemberOwnerRef,
    members: readonly ActivityContracts.ActivityMemberDTO[],
    capacityTotal?: number | null,
    options?: ActivityMembersQueryOptions
  ): Promise<void> {
    const actorUserId = this.userProfileStore.activeUserId().trim() || this.workspace.accountId(this.userProfileStore.getActiveUserId()).trim();
    if (owner.ownerType === 'community') throw new Error('Use group membership commands');
    await this.activityMembersService.replaceMembersByOwner(
      owner,
      this.prepareMembersForPersistence(members),
      capacityTotal,
      actorUserId,
      options
    );
    this.emitActivityMembersSyncForOwner(owner, options);
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

  async inviteEventMembers(
    owner: ActivityMemberOwnerRef,
    userIds: readonly string[]
  ): Promise<ActivityMembersInviteResultDTO> {
    const normalizedOwner = this.ownerRef(owner.ownerType, owner.ownerId.trim());
    if (!['event', 'community'].includes(normalizedOwner.ownerType) || !normalizedOwner.ownerId) {
      return { members: [], invitedUserIds: [], rejections: [] };
    }
    const profileId = this.userProfileStore.activeUserId().trim();
    const actorUserId = normalizedOwner.ownerType === 'community' ? this.workspace.accountId(profileId) : profileId;
    const result = this.localCommunity(normalizedOwner)
      ? await this.localGroups.invite(actorUserId, normalizedOwner.ownerId, userIds)
      : await this.httpActivityMembersService.inviteEventMembers(
      normalizedOwner,
      actorUserId,
      userIds
    );
    if (result.group) this.groupChanges.publish(actorUserId, result.group);
    const members = this.presentMembers(result.members);
    this.emitActivityMembersSyncForOwner(normalizedOwner);
    return {
      members,
      invitedUserIds: [...result.invitedUserIds],
      rejections: result.rejections.map(rejection => ({ ...rejection }))
    };
  }

  async applyMemberAction(
    owner: ActivityMemberOwnerRef,
    targetUserId: string,
    action: 'accept' | 'remove' | 'disqualify' | 'reinstate' | 'promote-admin' | 'step-down-admin' | 'set-organizer-only' | 'set-participant',
    reason?: string | null,
    options?: ActivityMembersQueryOptions
  ): Promise<ActivityContracts.ActivityMemberDTO[]> {
    const normalizedOwner = this.ownerRef(owner.ownerType, owner.ownerId.trim());
    if (!normalizedOwner.ownerId.trim()) {
      return [];
    }
    const profileId = this.userProfileStore.activeUserId().trim();
    const actorUserId = normalizedOwner.ownerType === 'community' ? this.workspace.accountId(profileId) : profileId;
    const counterSyncToken = this.activityStore.captureUserCounterSyncToken(actorUserId);
    const result = this.localCommunity(normalizedOwner)
      ? await this.localGroups.action(actorUserId, normalizedOwner.ownerId, targetUserId, action)
      : await this.activityMembersService.applyMemberAction(
      normalizedOwner,
      actorUserId,
      targetUserId,
      action,
      reason,
      options
    );
    if (result.group) this.groupChanges.publish(actorUserId, result.group);
    const members = this.presentMembers(result.members);
    if (result.counterOverrides) {
      this.activityStore.applyCanonicalCounterOverrides(counterSyncToken, result.counterOverrides);
    }
    this.emitActivityMembersSyncForOwner(normalizedOwner, options);
    return members;
  }

  private emitActivityMembersSyncForOwner(
    owner: ActivityMemberOwnerRef,
    options?: ActivityMembersQueryOptions
  ): void {
    // One rental's members are not the whole Asset's summary.
    if (options?.assetRequestId) {
      return;
    }
    const summary = this.activityMembersService.peekSummaryByOwner(owner);
    if (!summary) {
      return;
    }
    this.emitActivityMembersSync(
      summary.ownerId,
      summary.acceptedMembers,
      summary.pendingMembers,
      summary.capacityTotal,
      options
    );
  }

  private emitActivityMembersSync(
    id: string,
    acceptedMembers: number,
    pendingMembers: number,
    capacityTotal: number,
    options?: ActivityMembersQueryOptions
  ): void {
    this.activityStore.emitActivityMembersSync({
      id,
      ...(`${options?.eventId ?? ''}`.trim() ? { eventId: `${options?.eventId ?? ''}`.trim() } : {}),
      ...(`${options?.subEventId ?? ''}`.trim() ? { subEventId: `${options?.subEventId ?? ''}`.trim() } : {}),
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
      const retainsInviter = entry.status === 'pending'
        && (
          entry.requestKind === 'invite'
          || entry.requestKind === 'waitlist-invite'
          || entry.requestKind === 'approval'
        );
      const invitedByUserId = retainsInviter
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
