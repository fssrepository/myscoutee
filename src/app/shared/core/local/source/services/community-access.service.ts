import { Injectable, inject } from '@angular/core';
import { COMMUNITY_BASE_GROUP_ID, isBaseGroupId } from '../../../contracts/group-type';
import { LocalCommunityGroupsRepository } from '../repositories/community-groups.repository';
import { LocalActivityMembersRepository } from '../repositories/activity-members.repository';
import { LocalUsersRepository } from '../repositories/users.repository';

@Injectable({ providedIn: 'root' })
export class LocalCommunityAccessService {
  private readonly groups = inject(LocalCommunityGroupsRepository);
  private readonly members = inject(LocalActivityMembersRepository);
  private readonly users = inject(LocalUsersRepository);
  actor(profileId: string): string {
    const profile = this.users.queryUserById(profileId); if (!profile) throw new Error('Forbidden');
    const account = profile.accountUserId ?? profile.id;
    this.requireBaseMember(account); return account;
  }
  requireBaseMember(account: string): void {
    if (!this.member(COMMUNITY_BASE_GROUP_ID, account)
      || !this.users.queryUserById(`group:${COMMUNITY_BASE_GROUP_ID}:${account}`)) throw new Error('Forbidden');
  }
  group(id: string) {
    const group = this.groups.find(id);
    if (!group || group.groupType !== 'community' || isBaseGroupId(id) || ['deleted', 'under-review'].includes(group.lifecycleStatus ?? '')) throw new Error('Group not found');
    return group;
  }
  roster(id: string) { return this.members.peekRecordsByOwner({ ownerType: 'community', ownerId: id }).filter(m => m.status === 'accepted'); }
  member(groupId: string, accountId: string) { return this.roster(groupId).find(m => m.userId === accountId); }
  admin(groupId: string | null, accountId: string): boolean { return !!groupId && this.member(groupId, accountId)?.role === 'Admin'; }
  requireMember(groupId: string, accountId: string) {
    const group = this.group(groupId); if (!this.member(groupId, accountId)) throw new Error('Forbidden'); return group;
  }
  requireAdmin(groupId: string | null, accountId: string) {
    if (!groupId) throw new Error('Forbidden');
    const group = this.group(groupId); if (!this.admin(groupId, accountId)) throw new Error('Forbidden'); return group;
  }
  managedGroups(accountId: string): Set<string> {
    return new Set(this.groups.records().filter(g => g.groupType === 'community' && !isBaseGroupId(g.id)
      && !['deleted', 'under-review'].includes(g.lifecycleStatus ?? '') && this.admin(g.id, accountId)).map(g => g.id));
  }
  audience(groupId: string, all: boolean, selected: readonly string[]): string[] {
    const accepted = new Set(this.roster(groupId).map(m => m.userId));
    if (all) return [...accepted];
    if (selected.length > 10000 || selected.some(id => !accepted.has(id))) throw new Error('Invalid audience');
    return [...new Set(selected)];
  }
}
