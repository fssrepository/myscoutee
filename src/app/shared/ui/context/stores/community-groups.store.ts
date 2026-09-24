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
import type { CommunityGroup, CommunityGroupSummary, SaveCommunityGroup, GroupFilters, GroupBucket, GroupSyncRequest } from '../../../core/contracts/community-group.interface';
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
  readonly initialBucket = signal<GroupBucket>('hosting');
  readonly editor = signal<{ group: CommunityGroup | null; readOnly: boolean; loading?: boolean } | null>(null);
  private editorRequest: AbortController | null = null;
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
  open(bucket: GroupBucket = 'hosting'): void {
    this.error.set(''); this.initialBucket.set(bucket);
    this.openUserId.set(this.workspace.accountId(this.profile.getActiveUserId()));
  }
  async openInvitation(groupId: string): Promise<void> {
    this.open('participation');
    const userId = this.openUserId()!;
    try {
      const group = await this.service.detail(userId, groupId);
      if (userId !== this.openUserId()) return;
      this.changes.publish(userId, group);
      this.members(group);
    } catch (error) { this.error.set(this.message(error)); }
  }
  closeEditor(): void { this.editorRequest?.abort(); this.editorRequest = null; this.editor.set(null); }
  close(): void { this.closeEditor(); this.openUserId.set(null); }
  sync(request: GroupSyncRequest, signal?: AbortSignal) { return this.service.sync(this.openUserId() ?? '', request, signal); }
  async page(query: ListQuery<GroupFilters>, signal?: AbortSignal) {
    const userId = this.openUserId() ?? '';
    const page = await this.service.page(userId, query, signal);
    signal?.throwIfAborted(); if (userId === this.openUserId()) void this.workspaces.refresh();
    return page;
  }
  members(group: CommunityGroupSummary): void {
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
  async action(action: string, group: CommunityGroupSummary): Promise<void> {
    if (action === 'view' || action === 'edit') {
      this.closeEditor(); this.error.set('');
      const controller = new AbortController(); this.editorRequest = controller;
      const userId = this.openUserId() ?? '';
      this.editor.set({ group: null, readOnly: action === 'view', loading: true });
      try {
        const detail = await this.service.detail(userId, group.id, controller.signal);
        if (!controller.signal.aborted && userId === this.openUserId()) this.editor.set({ group: detail, readOnly: action === 'view' });
      } catch (error) {
        if (!controller.signal.aborted) { this.editor.set(null); this.error.set(this.message(error)); }
      }
      return;
    }
    if (action === 'members') { this.members(group); return; }
    const item = CommunityGroupConverter.menu(group, this.openUserId()).find(item => item.id === action);
    if (!item) return;
    this.dialogs.open({ title: String(item.label),
      message: this.i18n.translateParams(`groups.confirm.${action}`, { name: group.name }),
      cancelLabel: 'Cancel', confirmLabel: String(item.label), confirmPalette: item.palette,
      failureMessage: 'groups.error',
      input: action === 'report' ? { label: 'groups.report.details', maxLength: 2000 } : null,
      onConfirm: details => action === 'report' ? this.service.report(this.openUserId() ?? '', group.id, details) : this.commitAction(action, group) });
  }
  private async commitAction(action: string, group: CommunityGroupSummary): Promise<void> {
    if (this.busy()) return; this.busy.set(true); this.error.set('');
    const userId = this.openUserId() ?? '';
    try {
      if (action === 'join') this.changes.publish(userId, await this.service.join(userId, group.id));
      else if (action === 'accept') {
        await this.membersService.applyMemberAction({ ownerType: 'community', ownerId: group.id }, userId, action);
        void this.workspaces.refresh();
      }
    } catch (error) { this.error.set(this.message(error)); throw error; } finally { this.busy.set(false); }
  }
  private message(error: unknown): string { return error instanceof Error ? error.message : 'groups.error'; }
}
