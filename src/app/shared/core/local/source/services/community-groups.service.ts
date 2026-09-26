import { LocalNotificationsRepository } from '../repositories/notifications.repository';
import { LocalUsersMapper } from '../mappers/user.mapper';
import type { UserRecord } from '../entity/user.entity';
import { Injectable, inject } from '@angular/core';
import { AppUtils } from '../../../../app-utils';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalCommunityGroupsRepository } from '../repositories/community-groups.repository';
import { LocalActivityMembersRepository } from '../repositories/activity-members.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalAdminModerationRepository } from '../repositories/admin-moderation.repository';
import type { CommunityGroupRecord } from '../entity/community-group.entity';
import type { ActivityMemberRecord } from '../entity/activity.entity';
import type { ICommunityGroupsService, GroupSyncRequest, GroupSyncResponse, CommunityGroup, SaveCommunityGroup, GroupFilters, GroupCounters, GroupWorkspace, GroupWorkspaceSelection } from '../../../contracts/community-group.interface';
import { GROUP_CATEGORIES, communityGroupSummary, groupSort, groupMembershipBucket, type CommunityGroupSummary } from '../../../contracts/community-group.interface';
import type { ListQuery, PageResult } from '../../../contracts/list.interface';
import type { ActivityMemberDTO, ActivityMemberActionResultDTO, ActivityMembersSummaryDto, ActivityMembersInviteResultDTO } from '../../../contracts/activity.interface';

@Injectable({ providedIn: 'root' })
export class LocalCommunityGroupsService extends LocalRouteDelayService implements ICommunityGroupsService {
  private readonly notifications = inject(LocalNotificationsRepository);
  private readonly groups = inject(LocalCommunityGroupsRepository);
  private readonly members = inject(LocalActivityMembersRepository);
  private readonly users = inject(LocalUsersRepository);
  private readonly reports = inject(LocalAdminModerationRepository);
  async sync(userId: string, request: GroupSyncRequest, signal?: AbortSignal): Promise<GroupSyncResponse> {
    await this.groups.ready();
    const page = await this.page(userId, { page: 0, pageSize: Math.max(1, this.groups.records().length), filters: request, sort: request.sort }, signal);
    const known = new Map(request.knownItems.map(item => [item.id, item.revision]));
    const ids = new Set(page.items.map(group => group.id));
    const tail = page.items.findIndex(group => group.id === request.tailId);
    const window = tail < 0 ? known.size + Math.min(request.limit, 50) : tail + 1;
    return { upserts: page.items.filter((group, index) => (index < window || known.has(group.id)) && JSON.stringify(group) !== known.get(group.id)),
      removedIds: [...known.keys()].filter(id => !ids.has(id)), total: page.total ?? page.items.length };
  }
  async workspaces(userId: string): Promise<GroupWorkspace[]> {
    await this.groups.ready();
    return this.groups.records().flatMap(group => {
      const member = this.member(group.id, userId);
      const profile = this.users.queryUserById(this.profileId(group.id, userId));
      return member && ['accepted', 'pending'].includes(member.status)
        ? [{ groupId: group.id, profileId: profile?.id ?? null, name: group.name, role: member.role, category: group.category,
          membershipStatus: member.status as 'accepted' | 'pending', requestKind: member.requestKind === 'invite' ? 'invite' as const : member.requestKind === 'join' ? 'join' as const : null, membersActivity: this.membersActivity(group, member),
          activity: (member.status === 'accepted' ? this.attention(profile) : 0) + this.membersActivity(group, member) + (this.admin(member) ? group.moderationPending ?? 0 : 0),
          moderationPending: this.admin(member) ? group.moderationPending ?? 0 : 0,
          moderationQueueRevision: this.admin(member) ? group.moderationQueueRevision ?? 0 : 0,
          policy: structuredClone(group.policy) }] : [];
    }).sort((a, b) => a.name.localeCompare(b.name) || a.groupId.localeCompare(b.groupId));
  }
  async resolveWorkspace(userId: string, groupId: string | null): Promise<GroupWorkspaceSelection> {
    await this.groups.ready();
    const workspace = groupId ? (await this.workspaces(userId)).find(w => w.groupId === groupId && w.membershipStatus === 'accepted' && w.policy.workspace && w.profileId) : null;
    if (groupId && !workspace) throw new Error('Forbidden');
    const profile = this.users.queryUserById(workspace?.profileId ?? userId);
    if (!profile) throw new Error('Profile not found');
    return { workspace: workspace ?? null, profile: LocalUsersMapper.toDto(profile),
      accountProfile: workspace ? LocalUsersMapper.toDto(this.users.queryUserById(userId)!) : null };
  }
  private profileId(groupId: string, userId: string): string { return `group:${groupId}:${userId}`; }
  private admit(group: CommunityGroupRecord, accountId: string): void {
    const id = this.profileId(group.id, accountId);
    if (!group.policy.workspace) return;
    const existing = this.users.queryUserById(id);
    if (existing) { this.users.upsertUser(existing); return; }
    const source = this.users.queryUserById(accountId); if (!source) throw new Error('Profile not found');
    const fields: UserRecord = {
      id, workspaceGroupId: group.id, accountUserId: accountId,
      name: source.name, age: source.age, birthday: source.birthday, city: source.city,
      height: source.height, physique: source.physique, languages: [...source.languages],
      horoscope: source.horoscope, initials: source.initials, gender: source.gender,
      statusText: source.statusText, hostTier: '', traitLabel: '', completion: source.completion,
      headline: source.headline, about: source.about, images: [...(source.images ?? [])],
      locationCoordinates: source.locationCoordinates ? { ...source.locationCoordinates } : undefined,
      partitionKey: source.partitionKey, profileFormVersion: source.profileFormVersion,
      profileDetails: structuredClone(source.profileDetails ?? []), profileStatus: source.profileStatus,
      status: source.status, activities: { game: 0, chats: 0, invitations: 0, events: 0, hosting: 0 }
    };
    if (group.policy.enabled) fields.profileDetails?.forEach(g => g.rows.forEach(row => {
      if (group.policy.requiredFields.includes(row.labelKey)) row.privacy = 'Public';
    }));
    this.users.upsertUser(fields);
  }
  private attention(user: UserRecord | null): number {
    if (!user) return 0;
    const a = user.activities;
    return [a.game, a.chats, a.event?.all ?? 0, a.feedback, a.paymentRefundsPending]
      .reduce<number>((sum, count) => sum + Math.max(0, count ?? 0), 0)
      + (user.impressions?.host?.unreadCount ? 1 : 0) + (user.impressions?.member?.unreadCount ? 1 : 0);
  }
  async page(userId: string, query: ListQuery<GroupFilters>, signal?: AbortSignal): Promise<PageResult<CommunityGroupSummary, GroupCounters>> {
    await this.waitForRouteDelay('/groups'); await this.groups.ready(); signal?.throwIfAborted();
    const bucket = query.filters?.bucket ?? 'explore';
    const rows = this.groups.records().filter(g => {
      const own = this.member(g.id, userId);
      const admin = this.admin(own);
      if (bucket === 'hosting') return admin;
      if (bucket === 'invitations') return own?.status === 'pending' && own.requestKind === 'invite';
      if (bucket === 'participation') return !admin && !!own && ['accepted', 'pending'].includes(own.status)
        && !(own.status === 'pending' && own.requestKind === 'invite');
      return g.ownerUserId !== userId && !own && g.visibility !== 'invitation'
        && (!g.moderationStatus || g.moderationStatus === 'accepted');
    }).filter(g => !query.filters?.category || query.filters.category === g.category)
      .map(g => this.dto(userId, g)).sort((a, b) =>
        (groupSort(bucket, query.sort) === 'distance'
          ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
          : b.updatedAtIso.localeCompare(a.updatedAtIso)) || a.id.localeCompare(b.id));
    const offset = Number(query.cursor ?? 0); if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid cursor');
    const items = rows.slice(offset, offset + query.pageSize).map(communityGroupSummary);
    return { items, total: rows.length, nextCursor: offset + items.length < rows.length ? `${offset + items.length}` : null,
      context: (await this.workspaces(userId)).reduce((counts, w) => {
        const membershipBucket = groupMembershipBucket(w);
        if (membershipBucket !== 'explore') counts[membershipBucket] += w.activity; return counts;
      }, { hosting: 0, participation: 0, invitations: 0 }) };
  }
  async detail(userId: string, id: string, signal?: AbortSignal): Promise<CommunityGroup> {
    await this.waitForRouteDelay('/groups', signal); await this.groups.ready(); signal?.throwIfAborted();
    return this.dto(userId, this.visible(userId, id));
  }
  async save(request: SaveCommunityGroup): Promise<CommunityGroup> {
    await this.waitForRouteDelay('/groups'); await this.groups.ready();
    if (!request.name.trim() || [...request.name].length > 20 || request.description.length > 4000
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
      version: (existing?.version ?? -1) + 1, pendingMembers: existing?.pendingMembers ?? 0, moderationStatus: existing?.moderationStatus,
      moderationPending: existing?.moderationPending, moderationQueueRevision: existing?.moderationQueueRevision
    };
    this.groups.save(group);
    if (!existing) this.writeMembers(group.id, [this.newMember(group, request.userId, 'Admin', 'accepted', null, request.userId)]);
    this.records(group.id).filter(m => m.status === 'accepted').forEach(m => this.admit(group, m.userId));
    return this.dto(request.userId, this.groups.find(group.id)!);
  }
  async report(userId: string, groupId: string, details: string): Promise<void> {
    await this.groups.ready();
    const group = this.visible(userId, groupId); const reporter = this.users.queryUserById(userId);
    details = details.trim();
    if (!reporter || group.ownerUserId === userId) throw new Error('Forbidden');
    if (details.length < 12 || details.length > 2000) throw new Error('groups.report.details');
    await this.reports.insertReportIfAbsent({
      id: `community-report:${[userId, groupId, details].map(encodeURIComponent).join(':')}`,
      reporterUserId: userId, reporterName: reporter.name, reporterImageUrl: reporter.images?.[0] ?? null,
      targetUserId: group.ownerUserId, handle: group.name, reason: 'groups.report', details,
      sourceType: 'community', sourceId: groupId, sourceText: group.name, createdDate: new Date().toISOString()
    });
  }
  async join(userId: string, groupId: string): Promise<CommunityGroup> {
    await this.waitForRouteDelay('/groups'); const group = this.visible(userId, groupId);
    if (group.moderationStatus && group.moderationStatus !== 'accepted') throw new Error('Forbidden');
    const own = this.member(groupId, userId);
    if (own && ['accepted', 'pending'].includes(own.status)) {
      if (own.status === 'pending' && own.requestKind === 'join')
        this.notifyMembers(group, 'join-requested', userId, own, this.records(groupId).filter(member => this.admin(member)).map(member => member.userId), false);
      return this.dto(userId, group);
    }
    if (group.visibility === 'invitation') throw new Error('Forbidden');
    const requested = this.newMember(group, userId, 'Member', 'pending', 'join', null);
    this.writeMembers(groupId, [...this.records(groupId).filter(m => m.userId !== userId), requested]);
    this.notifyMembers(group, 'join-requested', userId, requested, this.records(groupId).filter(member => this.admin(member)).map(member => member.userId), false);
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
    for (const member of this.records(id)) if (userIds.includes(member.userId) && member.status === 'pending'
      && member.requestKind === 'invite' && member.invitedByUserId === userId)
      this.notifyMembers(group, 'invite', userId, member, [member.userId], false);
    return { members: this.roster(userId, id), invitedUserIds, rejections: [], group: this.dto(userId, group) };
  }
  async action(userId: string, id: string, targetId: string, action: string): Promise<ActivityMemberActionResultDTO> {
    const group = this.visible(userId, id); const rows = this.records(id);
    const stored = rows.find(m => m.userId === targetId); if (!stored) throw new Error('Member not found');
    const target = { ...stored }; const self = userId === targetId;
    const admin = this.admin(this.member(id, userId)); const owner = group.ownerUserId === targetId;
    if (target.communityAction === action && target.communityActor === userId && (self || admin)) {
      this.notifyMemberTransition(group, userId, target, action);
      return { members: self && target.status === 'deleted' ? [] : this.roster(userId, id), counterOverrides: null, group: this.dto(userId, group) };
    }
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
    if (stored.status === target.status && stored.role === target.role
      && !['set-organizer-only', 'set-participant'].includes(action))
      return { members: this.roster(userId, id), counterOverrides: null, group: this.dto(userId, group) };
    target.communityAction = action; target.communityActor = userId;
    target.updatedAtIso = new Date().toISOString(); target.actionAtIso = target.updatedAtIso; target.updatedMs = Date.now();
    if (target.status === 'accepted') this.admit(group, targetId);
    this.writeMembers(id, rows.map(m => m.userId === targetId ? target : m));
    if (target.status === 'deleted' && this.users.queryUserById(targetId)?.activeWorkspaceGroupId === id)
      await this.users.selectWorkspace(targetId, null);
    this.notifyMemberTransition(group, userId, target, action);
    return { members: self && target.status === 'deleted' ? [] : this.roster(userId, id), counterOverrides: null, group: this.dto(userId, group) };
  }
  private notifyMemberTransition(group: CommunityGroupRecord, userId: string, target: ActivityMemberRecord, action: string): void {
    if (action === 'accept') {
      const recipients = this.records(group.id).filter(member => member.status === 'accepted'
        && (!group.hideMembers || this.admin(member) || member.userId === target.userId)).map(member => member.userId);
      this.notifyMembers(group, 'member-joined', userId, target, recipients, true);
    } else if (action === 'remove') {
      this.notifyMembers(group, 'member-removed', userId, target,
        [target.userId, ...this.records(group.id).filter(member => this.admin(member)).map(member => member.userId)], true);
    } else if (['promote-admin', 'step-down-admin'].includes(action)) {
      this.notifyMembers(group, 'role-changed', userId, target, [target.userId], true);
    }
  }
  private notifyMembers(group: CommunityGroupRecord, action: string, actorId: string, subject: ActivityMemberRecord,
    recipientIds: readonly string[], attention: boolean): void {
    const sender = this.users.queryUserById(actorId);
    const kind = `community-${action}`;
    this.notifications.append([...new Set(recipientIds)].filter(id => id !== actorId).map(recipientUserId => ({
      id: `${kind}:${subject.id}:${subject.actionAtIso}:${recipientUserId}`, recipientUserId, kind, category: 'user',
      title: group.name, message: group.name, createdAtIso: subject.actionAtIso ?? new Date().toISOString(),
      senderUserId: actorId, senderName: sender?.name, senderAvatarUrl: sender?.images?.[0],
      sourceType: 'community', sourceId: group.id, actionPath: `/game?communityGroupId=${encodeURIComponent(group.id)}`,
      payload: { workspaceGroupId: group.id, workspaceGroupName: group.name, communityGroupId: group.id,
        memberUserId: subject.userId, notification_message_key: `notification.kind.${kind}.message`,
        ...(attention ? { communityAttention: 'members' } : {}) }
    })));
  }
  private visible(userId: string, id: string): CommunityGroupRecord {
    const group = this.groups.find(id); const own = this.member(id, userId);
    if (!group || group.visibility === 'invitation' && (!own || !['accepted', 'pending'].includes(own.status))) throw new Error('Group not found');
    if (group.moderationStatus && group.moderationStatus !== 'accepted' && !own) throw new Error('Group not found');
    return group;
  }
  private records(id: string): ActivityMemberRecord[] {
    return this.members.peekRecordsByOwner({ ownerType: 'community', ownerId: id }).filter(m => ['accepted', 'pending'].includes(m.status));
  }
  private member(id: string, userId: string): ActivityMemberRecord | undefined { return this.records(id).find(m => m.userId === userId); }
  private admin(member: ActivityMemberRecord | undefined): boolean { return member?.status === 'accepted' && member.role === 'Admin'; }
  private writeMembers(id: string, rows: ActivityMemberRecord[]): void {
    this.members.replaceRecordsByOwner({ ownerType: 'community', ownerId: id }, rows);
  }
  private membersActivity(group: CommunityGroupRecord, own?: ActivityMemberRecord): number {
    if (!own) return 0;
    return Math.max(0, own.communityUpdates ?? 0) + this.pendingMembers(group, own);
  }
  private pendingMembers(group: CommunityGroupRecord, own?: ActivityMemberRecord): number {
    return this.admin(own) ? group.pendingMembers ?? 0
      : own?.status === 'pending' && own.requestKind === 'invite' ? 1 : 0;
  }
  private dto(userId: string, group: CommunityGroupRecord): CommunityGroup {
    group = this.groups.find(group.id) ?? group;
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
      pendingMembers: this.pendingMembers(group, own),
      membersActivity: this.membersActivity(group, own),
      moderationPending: this.admin(own) ? group.moderationPending ?? 0 : 0,
      moderationQueueRevision: this.admin(own) ? group.moderationQueueRevision ?? 0 : 0,
      activity: (own?.status === 'accepted' ? this.attention(this.users.queryUserById(this.profileId(group.id, userId))) : 0)
        + this.membersActivity(group, own) + (this.admin(own) ? group.moderationPending ?? 0 : 0), distanceKm };
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
