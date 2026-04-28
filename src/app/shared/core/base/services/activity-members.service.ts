import { Injectable, inject } from '@angular/core';

import type {
  ActivityMemberOwnerType,
  ActivityMemberOwnerRef,
  ActivityMembersSummary,
  ActivitiesEventSyncPayload
} from '../../../core/base/models';
import type * as AppTypes from '../../../core/base/models';
import { AppContext } from '../context';
import { DemoActivityMembersService } from '../../demo/services/activity-members.service';
import { HttpActivityMembersService } from '../../http/services/activity-members.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class ActivityMembersService extends BaseRouteModeService {
  private static readonly OWNER_TYPES: readonly ActivityMemberOwnerType[] = ['event', 'subEvent', 'group', 'asset'];
  private readonly demoActivityMembersService = inject(DemoActivityMembersService);
  private readonly httpActivityMembersService = inject(HttpActivityMembersService);
  private readonly appCtx = inject(AppContext);


  private get activityMembersService(): DemoActivityMembersService | HttpActivityMembersService {
    return this.resolveRouteService('/activities/events/members', this.demoActivityMembersService, this.httpActivityMembersService);
  }

  peekMembersByOwner(owner: ActivityMemberOwnerRef): AppTypes.ActivityMemberEntry[] {
    return this.presentMembers(this.activityMembersService.peekMembersByOwner(owner));
  }

  peekMembersByOwnerId(ownerId: string): AppTypes.ActivityMemberEntry[] {
    const owner = this.peekOwnerRefById(ownerId);
    if (!owner) {
      return [];
    }
    return this.peekMembersByOwner(owner);
  }

  async queryMembersByOwner(owner: ActivityMemberOwnerRef): Promise<AppTypes.ActivityMemberEntry[]> {
    return this.presentMembers(await this.activityMembersService.queryMembersByOwner(owner));
  }

  async queryMembersByOwnerId(ownerId: string): Promise<AppTypes.ActivityMemberEntry[]> {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return [];
    }
    const owner = this.peekOwnerRefById(normalizedOwnerId) ?? this.ownerRef('event', normalizedOwnerId);
    return this.queryMembersByOwner(owner);
  }

  peekSummaryByOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummary | null {
    return this.activityMembersService.peekSummaryByOwner(owner);
  }

  peekSummaryByOwnerId(ownerId: string): ActivityMembersSummary | null {
    const owner = this.peekOwnerRefById(ownerId);
    if (!owner) {
      return null;
    }
    return this.peekSummaryByOwner(owner);
  }

  async querySummariesByOwners(owners: readonly ActivityMemberOwnerRef[]): Promise<ActivityMembersSummary[]> {
    return this.activityMembersService.querySummariesByOwners(owners);
  }

  async querySummaryByOwnerId(ownerId: string): Promise<ActivityMembersSummary | null> {
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
    members: readonly AppTypes.ActivityMemberEntry[],
    capacityTotal?: number | null
  ): Promise<void> {
    await this.activityMembersService.replaceMembersByOwner(
      owner,
      this.prepareMembersForPersistence(members),
      capacityTotal
    );
    this.emitActivityMembersSyncForOwner(owner);
  }

  async replaceMembersByOwnerId(
    ownerId: string,
    members: readonly AppTypes.ActivityMemberEntry[],
    capacityTotal?: number | null
  ): Promise<void> {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return;
    }
    const owner = this.peekOwnerRefById(normalizedOwnerId) ?? this.ownerRef('event', normalizedOwnerId);
    await this.replaceMembersByOwner(owner, members, capacityTotal);
  }

  async syncEventMembersFromEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    await this.activityMembersService.syncEventMembersFromEventSnapshot(payload);
    this.appCtx.emitActivityMembersSync({
      id: payload.id,
      acceptedMembers: Number.isFinite(Number(payload.acceptedMembers)) ? Number(payload.acceptedMembers) : 0,
      pendingMembers: Number.isFinite(Number(payload.pendingMembers)) ? Number(payload.pendingMembers) : 0,
      capacityTotal: Number.isFinite(Number(payload.capacityTotal))
        ? Number(payload.capacityTotal)
        : (Number.isFinite(Number(payload.acceptedMembers)) ? Number(payload.acceptedMembers) : 0)
    });
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
    this.appCtx.emitActivityMembersSync({
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

  private presentMembers(entries: readonly AppTypes.ActivityMemberEntry[]): AppTypes.ActivityMemberEntry[] {
    const activeUserId = this.appCtx.activeUserId().trim();
    return entries.map(entry => {
      const invitedByUserId = `${entry.invitedByUserId ?? ''}`.trim() || null;
      return {
        ...entry,
        invitedByUserId,
        invitedByActiveUser: this.isInviteOwnedByActiveUser(entry, activeUserId, invitedByUserId)
      };
    });
  }

  private prepareMembersForPersistence(
    entries: readonly AppTypes.ActivityMemberEntry[]
  ): AppTypes.ActivityMemberEntry[] {
    const activeUserId = this.appCtx.activeUserId().trim();
    return entries.map(entry => {
      const isPendingInvite = entry.status === 'pending' && entry.requestKind === 'invite';
      const invitedByUserId = isPendingInvite
        ? (`${entry.invitedByUserId ?? ''}`.trim() || (entry.invitedByActiveUser && activeUserId ? activeUserId : null))
        : null;
      return {
        ...entry,
        invitedByUserId,
        invitedByActiveUser: this.isInviteOwnedByActiveUser(entry, activeUserId, invitedByUserId)
      };
    });
  }

  private isInviteOwnedByActiveUser(
    entry: AppTypes.ActivityMemberEntry,
    activeUserId: string,
    invitedByUserId: string | null
  ): boolean {
    if (entry.status !== 'pending' || entry.requestKind !== 'invite') {
      return false;
    }
    return Boolean(invitedByUserId) && invitedByUserId === activeUserId;
  }
}
