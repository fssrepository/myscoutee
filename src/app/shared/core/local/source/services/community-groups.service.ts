import { Injectable, inject } from '@angular/core';
import { AppUtils } from '../../../../app-utils';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalCommunityGroupsRepository } from '../repositories/community-groups.repository';
import { LocalActivityMembersRepository } from '../repositories/activity-members.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import type { CommunityGroupRecord } from '../entity/community-group.entity';
import type { ActivityMemberRecord } from '../entity/activity.entity';
import type { ICommunityGroupsService, CommunityGroup, SaveCommunityGroup, GroupFilters, GroupCounters } from '../../../contracts/community-group.interface';
import { GROUP_CATEGORIES } from '../../../contracts/community-group.interface';
import type { ListQuery, PageResult } from '../../../contracts/list.interface';
import type { ActivityMemberDTO, ActivityMemberActionResultDTO, ActivityMembersSummaryDto, ActivityMembersInviteResultDTO } from '../../../contracts/activity.interface';

@Injectable({ providedIn: 'root' })
export class LocalCommunityGroupsService extends LocalRouteDelayService implements ICommunityGroupsService {
  private readonly groups = inject(LocalCommunityGroupsRepository);
  private readonly members = inject(LocalActivityMembersRepository);
  private readonly users = inject(LocalUsersRepository);
  async page(userId: string, query: ListQuery<GroupFilters>, signal?: AbortSignal): Promise<PageResult<CommunityGroup, GroupCounters>> {
    await this.waitForRouteDelay('/groups'); await this.groups.ready(); signal?.throwIfAborted();
    const bucket = query.filters?.bucket ?? 'explore';
    const rows = this.groups.records().filter(g => {
      const own = this.member(g.id, userId);
      const admin = this.admin(own);
      if (bucket === 'hosting') return admin;
      if (bucket === 'participation') return !admin && !!own && ['accepted', 'pending'].includes(own.status);
      return g.visibility !== 'invitation' || !!own && ['accepted', 'pending'].includes(own.status);
    }).filter(g => !query.filters?.category || query.filters.category === g.category)
      .map(g => this.dto(userId, g)).sort((a, b) =>
        Math.floor((a.distanceKm ?? Infinity) / 5) - Math.floor((b.distanceKm ?? Infinity) / 5)
        || b.createdAtIso.localeCompare(a.createdAtIso) || a.id.localeCompare(b.id));
    const offset = Number(query.cursor ?? 0); if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid cursor');
    const items = rows.slice(offset, offset + query.pageSize);
    return { items, total: rows.length, nextCursor: offset + items.length < rows.length ? `${offset + items.length}` : null,
      context: { hosting: 0, participation: 0 } };
  }
  async detail(userId: string, id: string): Promise<CommunityGroup> {
    await this.groups.ready(); return this.dto(userId, this.visible(userId, id));
  }
  async save(request: SaveCommunityGroup): Promise<CommunityGroup> {
    await this.waitForRouteDelay('/groups'); await this.groups.ready();
    if (!request.name.trim() || request.name.length > 120 || request.description.length > 4000
      || !GROUP_CATEGORIES.includes(request.category) || !['public','private','invitation'].includes(request.visibility)) throw new Error('Invalid group');
    const existing = request.id ? this.visible(request.userId, request.id) : null;
    if (existing && !this.admin(this.member(existing.id, request.userId))) throw new Error('Forbidden');
    if (existing && existing.version !== request.version) throw new Error('Group changed');
    const now = new Date().toISOString();
    const group: CommunityGroupRecord = {
      id: existing?.id ?? crypto.randomUUID(), ownerUserId: existing?.ownerUserId ?? request.userId,
      name: request.name.trim(), description: request.description.trim(), imageUrl: request.imageUrl,
      category: request.category, visibility: request.visibility, hideMembers: request.hideMembers,
      policy: structuredClone(request.policy), createdAtIso: existing?.createdAtIso ?? now, updatedAtIso: now,
      version: (existing?.version ?? -1) + 1
    };
    this.groups.save(group);
    if (!existing) this.writeMembers(group.id, [this.newMember(group, request.userId, 'Admin', 'accepted', null, request.userId)]);
    return this.dto(request.userId, group);
  }
  async join(userId: string, groupId: string): Promise<CommunityGroup> {
    await this.waitForRouteDelay('/groups'); const group = this.visible(userId, groupId);
    const own = this.member(groupId, userId);
    if (own && ['accepted', 'pending'].includes(own.status)) return this.dto(userId, group);
    if (group.visibility === 'invitation') throw new Error('Forbidden');
    this.writeMembers(groupId, [...this.records(groupId).filter(m => m.userId !== userId), this.newMember(group, userId, 'Member', 'pending', 'join', null)]);
    return this.dto(userId, group);
  }
  roster(userId: string, id: string, pendingOnly = false): ActivityMemberDTO[] {
    const group = this.visible(userId, id); const admin = this.admin(this.member(id, userId));
    return this.records(id).filter(m => !pendingOnly || m.status === 'pending')
      .filter(m => admin || m.status === 'accepted' || m.userId === userId)
      .filter(m => admin || !group.hideMembers || m.role === 'Admin' || m.userId === userId)
      .map(m => ({ ...m, invitedByActiveUser: m.invitedByUserId === userId, revision: m.updatedAtIso, profile: undefined }));
  }
  summary(userId: string, id: string): ActivityMembersSummaryDto {
    const group = this.dto(userId, this.visible(userId, id)); const rows = this.roster(userId, id);
    return { ownerType: 'community', ownerId: id, acceptedMembers: group.acceptedMembers,
      pendingMembers: group.pendingMembers, capacityTotal: group.acceptedMembers,
      acceptedMemberUserIds: rows.filter(m => m.status === 'accepted').map(m => m.userId),
      pendingMemberUserIds: rows.filter(m => m.status === 'pending').map(m => m.userId) };
  }
  async invite(userId: string, id: string, userIds: readonly string[]): Promise<ActivityMembersInviteResultDTO> {
    const group = this.visible(userId, id);
    if (!this.admin(this.member(id, userId)) || userIds.length > 200) throw new Error('Forbidden');
    const rows = this.records(id);
    const invitedUserIds = [...new Set(userIds)].filter(uid => this.users.queryUserById(uid) && !rows.some(m => m.userId === uid));
    this.writeMembers(id, [...rows, ...invitedUserIds.map(uid => this.newMember(group, uid, 'Member', 'pending', 'invite', userId))]);
    return { members: this.roster(userId, id), invitedUserIds, rejections: [] };
  }
  async action(userId: string, id: string, targetId: string, action: string): Promise<ActivityMemberActionResultDTO> {
    const group = this.visible(userId, id); const rows = this.records(id);
    const stored = rows.find(m => m.userId === targetId); if (!stored) throw new Error('Member not found');
    const target = { ...stored }; const self = userId === targetId;
    const admin = this.admin(this.member(id, userId)); const owner = group.ownerUserId === targetId;
    switch (action) {
      case 'accept':
        if (target.status !== 'pending' || !(target.requestKind === 'invite' ? self : admin && !self)) throw new Error('Forbidden');
        target.status = 'accepted'; target.requestKind = null; target.pendingSource = null; break;
      case 'remove':
        if (owner || !(self || admin)) throw new Error('Forbidden'); target.status = 'deleted'; break;
      case 'promote-admin':
        if (!admin || target.status !== 'accepted') throw new Error('Forbidden'); target.role = 'Admin'; break;
      case 'step-down-admin':
        if (owner || !self || !this.admin(target)) throw new Error('Forbidden'); target.role = 'Member'; target.organizerOnly = false; break;
      case 'set-organizer-only': case 'set-participant':
        if (!self || !this.admin(target)) throw new Error('Forbidden'); target.organizerOnly = action === 'set-organizer-only'; break;
      default: throw new Error('Invalid action');
    }
    target.updatedAtIso = new Date().toISOString(); target.actionAtIso = target.updatedAtIso; target.updatedMs = Date.now();
    this.writeMembers(id, rows.map(m => m.userId === targetId ? target : m));
    return { members: this.roster(userId, id), counterOverrides: null };
  }
  private visible(userId: string, id: string): CommunityGroupRecord {
    const group = this.groups.find(id); const own = this.member(id, userId);
    if (!group || group.visibility === 'invitation' && (!own || !['accepted', 'pending'].includes(own.status))) throw new Error('Group not found');
    return group;
  }
  private records(id: string): ActivityMemberRecord[] {
    return this.members.peekRecordsByOwner({ ownerType: 'community', ownerId: id }).filter(m => ['accepted', 'pending'].includes(m.status));
  }
  private member(id: string, userId: string): ActivityMemberRecord | undefined { return this.records(id).find(m => m.userId === userId); }
  private admin(member: ActivityMemberRecord | undefined): boolean { return member?.status === 'accepted' && member.role === 'Admin'; }
  private writeMembers(id: string, rows: ActivityMemberRecord[]): void { this.members.replaceRecordsByOwner({ ownerType: 'community', ownerId: id }, rows); }
  private dto(userId: string, group: CommunityGroupRecord): CommunityGroup {
    const rows = this.records(group.id); const own = rows.find(m => m.userId === userId);
    const owner = this.users.queryUserById(group.ownerUserId); const viewer = this.users.queryUserById(userId);
    const a = owner?.locationCoordinates; const b = viewer?.locationCoordinates;
    let distanceKm: number | null = null;
    if (a && b) {
      const rad = Math.PI / 180;
      const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 + Math.cos(a.latitude * rad)
        * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
      distanceKm = Math.round(12742 * Math.asin(Math.sqrt(Math.min(1, h))) * 10) / 10;
    }
    return { ...group, ownerName: owner?.name ?? '', ownerAvatarUrl: owner?.images?.[0] ?? null,
      role: own?.role === 'Admin' ? 'Admin' : own ? 'Member' : null,
      membershipStatus: own?.status === 'accepted' ? 'accepted' : own ? 'pending' : null,
      requestKind: own?.requestKind === 'invite' ? 'invite' : own?.requestKind === 'join' ? 'join' : null, organizerOnly: own?.organizerOnly === true,
      acceptedMembers: rows.filter(m => m.status === 'accepted').length,
      pendingMembers: this.admin(own) ? rows.filter(m => m.status === 'pending').length : 0,
      activity: 0, distanceKm };
  }
  private newMember(group: CommunityGroupRecord, userId: string, role: 'Admin' | 'Member', status: 'accepted' | 'pending', requestKind: 'invite' | 'join' | null, inviter: string | null): ActivityMemberRecord {
    const user = this.users.queryUserById(userId); if (!user) throw new Error('User not found');
    const now = new Date().toISOString(); const ownerKey = `community:${group.id}`;
    return { id: `${ownerKey}:${userId}`, ownerKey, ownerType: 'community', ownerId: group.id, userId,
      name: user.name, initials: user.initials || AppUtils.initialsFromText(user.name), gender: user.gender,
      city: user.city, statusText: '', role, status, requestKind,
      pendingSource: requestKind ? requestKind === 'invite' ? 'admin' : 'member' : null,
      invitedByActiveUser: false, invitedByUserId: inviter, metAtIso: now, actionAtIso: now,
      metWhere: group.name, avatarUrl: user.images?.[0] ?? '', organizerOnly: false,
      createdMs: Date.now(), updatedMs: Date.now(), createdAtIso: now, updatedAtIso: now };
  }
}
