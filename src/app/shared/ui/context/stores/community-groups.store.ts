import { CommunityGroupChangesStore } from './community-group-changes.store';
import { GroupWorkspaceStore } from './group-workspace.store';
import { DialogStore } from './dialog.store';
import { I18nService } from '../../../core/base/services/i18n.service';
import { CommunityGroupConverter } from '../../converters/community-group.converter';
import { GroupWorkspaceContextService } from '../../../core/base/services/group-workspace-context.service';
import { Injectable, inject, signal, effect, computed } from '@angular/core';
import { CommunityGroupsService } from '../../../core/base/services/community-groups.service';
import { ActivityMembersService } from '../../../core/base/services/activity-members.service';
import { UserProfileStore } from './user-profile.store';
import { MemberMenuStore } from './member-menu.store';
import type { CommunityGroup, SaveCommunityGroup, GroupFilters, GroupCounters } from '../../../core/contracts/community-group.interface';
import type { ListQuery } from '../../../core/contracts/list.interface';
@Injectable({ providedIn: 'root' })
export class CommunityGroupsStore {
  private readonly dialogs = inject(DialogStore);
  private readonly i18n = inject(I18nService);
  private readonly workspace = inject(GroupWorkspaceContextService);
  private readonly service = inject(CommunityGroupsService);
  private readonly membersService = inject(ActivityMembersService);
  private readonly profile = inject(UserProfileStore);
  private readonly memberMenu = inject(MemberMenuStore);
  readonly openUserId = signal<string | null>(null);
  readonly editor = signal<{ group: CommunityGroup | null; readOnly: boolean } | null>(null);
  private readonly changes = inject(CommunityGroupChangesStore);
  readonly changed = computed(() => {
    const change = this.changes.change();
    return change?.accountId === this.openUserId() ? change.group : null;
  });
  private readonly workspaces = inject(GroupWorkspaceStore);
  readonly counters = this.workspaces.counters;
  readonly busy = signal(false);
  readonly error = signal('');
  constructor() { effect(() => { if (this.openUserId() && this.openUserId() !== this.workspace.accountId(this.profile.activeUserId())) this.close(); }); }
  open(): void { this.error.set(''); this.openUserId.set(this.workspace.accountId(this.profile.getActiveUserId())); }
  close(): void { this.editor.set(null); this.openUserId.set(null); }
  async page(query: ListQuery<GroupFilters>, signal?: AbortSignal) {
    const userId = this.openUserId() ?? '';
    const page = await this.service.page(userId, query, signal);
    signal?.throwIfAborted(); if (userId === this.openUserId()) void this.workspaces.refresh();
    return page;
  }
  members(group: CommunityGroup): void {
    this.memberMenu.requestActivitiesNavigation({ type: 'members', ownerType: 'community', ownerId: group.id, ownerUserId: group.ownerUserId,
      subtitle: group.name, canManage: group.role === 'Admin' && group.membershipStatus === 'accepted',
      acceptedMembers: group.acceptedMembers, pendingMembers: group.pendingMembers, capacityTotal: group.acceptedMembers,
      onMembersChanged: () => { void this.workspaces.refresh(); } });
  }
  async refresh(id: string): Promise<void> {
    const userId = this.openUserId(); if (!userId) return;
    try { const group = await this.service.detail(userId, id); if (userId === this.openUserId()) { this.changes.publish(userId, group); void this.workspaces.refresh(); } }
    catch (error) { this.error.set(this.message(error)); }
  }
  async save(value: SaveCommunityGroup): Promise<void> {
    if (this.busy()) return; this.busy.set(true); this.error.set('');
    const userId = this.openUserId() ?? '';
    try { const group = await this.service.save({ ...value, userId });
      if (userId === this.openUserId()) { this.changes.publish(userId, group); this.editor.set(null); void this.workspaces.refresh(); }
    } catch (error) { this.error.set(this.message(error)); } finally { this.busy.set(false); }
  }
  async action(action: string, group: CommunityGroup): Promise<void> {
    if (action === 'view' || action === 'edit') { this.editor.set({ group, readOnly: action === 'view' }); return; }
    if (action === 'members') { this.members(group); return; }
    const item = CommunityGroupConverter.menu(group).find(item => item.id === action);
    if (!item) return;
    this.dialogs.open({ title: String(item.label),
      message: this.i18n.translateParams(`groups.confirm.${action}`, { name: group.name }),
      cancelLabel: 'Cancel', confirmLabel: String(item.label), confirmPalette: item.palette,
      failureMessage: 'groups.error', onConfirm: () => this.commitAction(action, group) });
  }
  private async commitAction(action: string, group: CommunityGroup): Promise<void> {
    if (this.busy()) return; this.busy.set(true); this.error.set('');
    const userId = this.openUserId() ?? '';
    try {
      if (action === 'join') this.changes.publish(userId, await this.service.join(userId, group.id));
      else if (action === 'accept' || action === 'set-participant' || action === 'set-organizer-only') {
        await this.membersService.applyMemberAction({ ownerType: 'community', ownerId: group.id }, userId, action);
        void this.workspaces.refresh();
      }
    } catch (error) { this.error.set(this.message(error)); throw error; } finally { this.busy.set(false); }
  }
  private message(error: unknown): string { return error instanceof Error ? error.message : 'groups.error'; }
}
