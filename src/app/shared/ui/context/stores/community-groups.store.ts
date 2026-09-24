import { Injectable, inject, signal, effect } from '@angular/core';
import { CommunityGroupsService } from '../../../core/base/services/community-groups.service';
import { ActivityMembersService } from '../../../core/base/services/activity-members.service';
import { UserProfileStore } from './user-profile.store';
import { MemberMenuStore } from './member-menu.store';
import type { CommunityGroup, SaveCommunityGroup, GroupFilters, GroupCounters } from '../../../core/contracts/community-group.interface';
import type { ListQuery } from '../../../core/contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class CommunityGroupsStore {
  private readonly service = inject(CommunityGroupsService);
  private readonly membersService = inject(ActivityMembersService);
  private readonly profile = inject(UserProfileStore);
  private readonly memberMenu = inject(MemberMenuStore);
  readonly openUserId = signal<string | null>(null);
  readonly editor = signal<{ group: CommunityGroup | null; readOnly: boolean } | null>(null);
  readonly changed = signal<CommunityGroup | null>(null);
  readonly counters = signal<GroupCounters>({ hosting: 0, participation: 0 });
  readonly busy = signal(false);
  readonly error = signal('');
  constructor() { effect(() => { if (this.openUserId() && this.openUserId() !== this.profile.activeUserId()) this.close(); }); }
  open(): void { this.error.set(''); this.openUserId.set(this.profile.getActiveUserId()); }
  close(): void { this.editor.set(null); this.openUserId.set(null); }
  async page(query: ListQuery<GroupFilters>, signal?: AbortSignal) {
    const userId = this.openUserId() ?? '';
    const page = await this.service.page(userId, query, signal);
    signal?.throwIfAborted(); if (userId === this.openUserId() && page.context) this.counters.set(page.context);
    return page;
  }
  members(group: CommunityGroup): void {
    this.memberMenu.requestActivitiesNavigation({ type: 'members', ownerType: 'community', ownerId: group.id, ownerUserId: group.ownerUserId,
      subtitle: group.name, canManage: group.role === 'Admin' && group.membershipStatus === 'accepted',
      acceptedMembers: group.acceptedMembers, pendingMembers: group.pendingMembers, capacityTotal: group.acceptedMembers,
      onMembersChanged: () => { void this.refresh(group.id); } });
  }
  async refresh(id: string): Promise<void> {
    const userId = this.openUserId(); if (!userId) return;
    try { const group = await this.service.detail(userId, id); if (userId === this.openUserId()) this.changed.set(group); }
    catch (error) { this.error.set(this.message(error)); }
  }
  async save(value: SaveCommunityGroup): Promise<void> {
    if (this.busy()) return; this.busy.set(true); this.error.set('');
    const userId = this.openUserId() ?? '';
    try { const group = await this.service.save({ ...value, userId });
      if (userId === this.openUserId()) { this.changed.set(group); this.editor.set(null); }
    } catch (error) { this.error.set(this.message(error)); } finally { this.busy.set(false); }
  }
  async action(action: string, group: CommunityGroup): Promise<void> {
    if (action === 'view' || action === 'edit') { this.editor.set({ group, readOnly: action === 'view' }); return; }
    if (action === 'members') { this.members(group); return; }
    if (this.busy()) return; this.busy.set(true); this.error.set('');
    const userId = this.openUserId() ?? '';
    try {
      if (action === 'join') this.changed.set(await this.service.join(userId, group.id));
      else if (action === 'accept' || action === 'set-participant' || action === 'set-organizer-only') {
        await this.membersService.applyMemberAction({ ownerType: 'community', ownerId: group.id }, userId, action);
        await this.refresh(group.id);
      }
    } catch (error) { this.error.set(this.message(error)); } finally { this.busy.set(false); }
  }
  private message(error: unknown): string { return error instanceof Error ? error.message : 'groups.error'; }
}
