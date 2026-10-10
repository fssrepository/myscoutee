import { baseGroupType, isBaseGroupId } from '../../../../core/contracts/group-type';
import { groupTypeTrigger } from '../../../converters/community/group-type-menu';
import { AdminWorkspaceStore } from "../admin/admin-workspace.store";
import { AdminMenuStore } from "../admin/admin-menu.store";
import { AdminWorkspaceDataService } from "../../../../core/base/services/admin-workspace-data.service";
import { UsersService } from '../../../../core/base/services/users.service';
import { AppUtils } from '../../../../core/base/app-utils';
import { ContentModerationStore } from '../content/content-moderation.store';
import { type AppMenuItem, type AppMenuPalette, UiTaskScheduler, UiPollCoordinator } from '@myscoutee/components';
import { CommunityGroupChangesStore } from './community-group-changes.store';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommunityGroupsService } from '../../../../core/base/services/community-groups.service';
import { GroupWorkspaceContextService } from '../../../../core/base/services/group-workspace-context.service';
import { SessionService } from '../../../../core/base/services/session.service';
import { UserProfileStore } from '../profile/user-profile.store';
import { ActivityStore } from '../activity/activity.store';
import { profileMenuBadgeCount } from '../app/app-context-store.utils';

import type { GroupCategory, GroupBucket, GroupWorkspace } from '../../../../core/contracts/community-group.interface';
import { groupMembershipBucket } from '../../../../core/contracts/community-group.interface';

@Injectable({ providedIn: 'root' })
export class GroupWorkspaceStore {
  readonly context = inject(GroupWorkspaceContextService);
  private readonly service = inject(CommunityGroupsService);
  private readonly users = inject(UsersService);
  private readonly admin = inject(AdminWorkspaceStore);
  private readonly adminData = inject(AdminWorkspaceDataService);
  private readonly adminMenu = inject(AdminMenuStore);
  private sessionKey = '';
  private readonly profile = inject(UserProfileStore);
  private readonly activities = inject(ActivityStore);
  private readonly session = inject(SessionService);
  private readonly moderation = inject(ContentModerationStore);
  private generation = 0;
  private refreshSequence = 0;
  private readonly workspaceSnapshots = signal<readonly GroupWorkspace[]>([]);
  private readonly attentionRows = computed(() => {
    const active = this.context.active();
    const profile = this.profile.activeUserProfile();
    return this.workspaceSnapshots().map(workspace => {
      const previousPending = workspace.moderationPending ?? 0;
      const attention = workspace.role === 'Admin' && workspace.membershipStatus === 'accepted'
        ? this.moderation.attention(workspace.groupId, previousPending, workspace.moderationQueueRevision)
        : { pending: 0, revision: 0 };
      const activity = workspace.membershipStatus === 'accepted' && active?.groupId === workspace.groupId && profile?.id === workspace.profileId
        ? profileMenuBadgeCount(profile, this.activities.getUserCounterOverrides(profile.id), this.profile.getUserImpressionChangeFlags(profile.id), 'group') + (profile.admin ? 0 : workspace.membersActivity ?? 0)
        : Math.max(0, workspace.activity - previousPending);
      return { ...workspace, activity: activity + attention.pending, moderationPending: attention.pending, moderationQueueRevision: attention.revision };
    });
  });
  readonly workspaces = computed(() => this.attentionRows().filter(workspace => workspace.membershipStatus === 'accepted' && workspace.policy.workspace && !!workspace.profileId));
  private readonly accountAttention = computed(() => {
    const account = this.profile.getUserProfile(this.context.accountUserId());
    if (!account) return 0;
    const flags = this.profile.getUserImpressionChangeFlags(account.id);
    return profileMenuBadgeCount(account, this.activities.getUserCounterOverrides(account.id), flags)
      + (account.admin ? this.moderation.forScope(null)?.pendingCount ?? 0 : 0);
  });
  readonly avatarBadgeCount = computed(() => this.accountAttention()
    + this.attentionRows().filter(workspace => !this.profile.activeUserProfile()?.admin || isBaseGroupId(workspace.groupId)).reduce((sum, workspace) => sum + workspace.activity, 0));
  readonly error = signal('');
  readonly counters = computed(() => this.attentionRows().reduce((counts, workspace) => {
    const bucket = groupMembershipBucket(workspace);
    if (bucket !== 'explore' && bucket !== 'trash') counts[bucket] += workspace.activity;
    return counts;
  }, { hosting: 0, participation: 0, pending: 0, invitations: 0 }));
  private readonly pollCoordinator = inject(UiPollCoordinator);
  private readonly poller = new UiTaskScheduler({
    intervalMs: () => this.context.accountUserId() ? 15000 : 0,
    state: () => this.context.accountUserId(),
    pollCoordinator: this.pollCoordinator,
    task: ({ state }) => this.refresh(state)
  });
  private readonly changes = inject(CommunityGroupChangesStore);
  constructor() {
    effect(() => {
      const change = this.changes.attentionDelta();
      if (!change || change.accountId !== this.context.accountUserId()) return;
      untracked(() => this.workspaceSnapshots.update(rows => rows.map(row => row.groupId === change.groupId
        ? { ...row, activity: Math.max(0, row.activity + change.delta), membersActivity: Math.max(0, (row.membersActivity ?? 0) + change.delta) } : row)));
    });
    effect(() => {
      const change = this.changes.change();
      if (!change || change.accountId !== this.context.accountUserId()) return;
      untracked(() => {
        this.workspaceSnapshots.update(workspaces => {
          const previous = workspaces.find(workspace => workspace.groupId === change.group.id);
          const remaining = workspaces.filter(workspace => workspace.groupId !== change.group.id);
          if (!change.group.membershipStatus || change.group.membershipStatus === 'deleted' || change.group.membershipStatus === 'blocked') return remaining;
          return [...remaining, {
            ...previous, groupId: change.group.id, profileId: previous?.profileId ?? null,
            name: change.group.name, activity: change.group.activity, role: change.group.role ?? '',
            groupType: change.group.groupType, category: change.group.category, membershipStatus: change.group.membershipStatus,
            requestKind: change.group.requestKind,
            policy: change.group.policy, membersActivity: change.group.membersActivity,
            moderationPending: change.group.moderationPending, moderationQueueRevision: change.group.moderationQueueRevision
          }];
        });
      });
    });
    inject(DestroyRef).onDestroy(() => this.poller.destroy());
    effect(() => {
      const session = this.session.session();
      const profileId = this.profile.activeUserId();
      const accountId = session ? this.session.activeUserId() : '';
      untracked(() => {
        const key = session ? `${session.kind}:${accountId}` : '';
        if (key !== this.sessionKey) {
          this.sessionKey = key;
          this.generation++;
          this.moderation.clear();
          this.context.accountUserId.set(accountId);
          this.context.active.set(null);
          this.context.switching.set(false);
          this.workspaceSnapshots.set([]);
          this.error.set('');
          this.poller.stop({ abort: true });

        }
        if (this.context.accountUserId() && profileId) {
          // The initial selector data must load while the login popup is still
          // closing. Only subsequent badge refreshes are background polling.
          void this.pollCoordinator.run('foreground', () => this.refresh(accountId));
          this.poller.restart();
        }
      });
    });
  }
  categoryCount(bucket: GroupBucket, category: GroupCategory | null | undefined): number {
    if (bucket === 'explore') return 0;
    return this.attentionRows().filter(workspace => (!category || workspace.category === category)
      && groupMembershipBucket(workspace) === bucket)
      .reduce((sum, workspace) => sum + workspace.activity, 0);
  }
  palette(id: string): AppMenuPalette {
    const palettes: AppMenuPalette[] = ['violet', 'orange', 'blue', 'rose', 'cyan', 'gold'];
    const ids = this.workspaces().map(w => w.groupId).sort();
    return palettes[Math.max(0, ids.indexOf(id)) % palettes.length];
  }
  trigger(workspace: GroupWorkspace | null): Pick<AppMenuItem, 'label' | 'icon' | 'palette' | 'imageFallback' | 'imageShape'> {
    const type = baseGroupType(workspace?.groupId);
    if (!workspace || type) {
      const { label, icon, palette } = groupTypeTrigger(type ?? 'dating');
      return { label, icon, palette };
    }
    return { label: workspace.name, icon: '', imageFallback: AppUtils.initialsFromText(workspace.name),
      imageShape: 'circle', palette: this.palette(workspace.groupId) };
  }
  menuItems(selected: string, includeAll = false): AppMenuItem[] {
    const accountCount = this.accountAttention();
    const items: AppMenuItem[] = [
      ...(includeAll ? [{ id: 'all', label: 'All', icon: 'apps', palette: 'slate' as const }] : []),
      { id: 'main', ...this.trigger(null),
        counter: includeAll ? null : accountCount || null, counterTone: 'alert' },
      ...this.workspaces().filter(workspace => !this.profile.activeUserProfile()?.admin || isBaseGroupId(workspace.groupId)).map(workspace => ({
        id: workspace.groupId, ...this.trigger(workspace), counter: includeAll ? null : workspace.activity || null,
        counterTone: 'alert' as const
      }))
    ];
    return items.map(item => ({ ...item, kind: 'radio', checked: selected === item.id, active: selected === item.id,
      showCheck: true, surface: 'tinted' }));
  }
  async refresh(accountId = this.context.accountUserId()): Promise<void> {
    if (!accountId) return;
    const generation = this.generation;
    const sequence = ++this.refreshSequence;
    const revision = this.context.revision();
    const mutation = this.changes.revision();
    const workspaces = await this.service.workspaces(accountId);
    if (revision === this.context.revision() && generation === this.generation && sequence === this.refreshSequence && mutation === this.changes.revision()
        && accountId === this.context.accountUserId()) {
      this.workspaceSnapshots.set(workspaces);
      const active = this.context.active();
      if (active) {
        const updated = workspaces.find(w => w.groupId === active.groupId && w.membershipStatus === 'accepted' && w.policy.workspace && w.profileId);
        if (updated) this.context.active.set(updated);
        else await this.select(null);
      }
    }
  }
  async select(groupId: string | null): Promise<boolean> {
    if (this.context.switching()) return false;
    if ((this.context.active()?.groupId ?? null) === groupId
        && this.users.profileExtLoadState().status === 'success') return true;
    const generation = this.generation;
    const adminMode = this.profile.activeUserProfile()?.admin === true;
    if (adminMode) this.adminMenu.closePopup();
    this.error.set(''); this.context.switching.set(true);
    try {
      this.workspaceSnapshots.set(this.attentionRows());
      const selected = await this.users.loadProfileExtById(this.context.accountUserId(), undefined, groupId);
      if (generation !== this.generation) return false;
      if (!selected) { this.error.set('groups.switch.failed'); return false; }
      if (adminMode && selected.profile.admin) {
        const dashboard = await this.adminData.loadDashboard(selected.profile.id);
        if (generation !== this.generation || selected.profile.id !== this.profile.activeUserId()) return false;
        this.admin.applyDashboard(dashboard);
      }
      return true;
    } catch { if (generation === this.generation) this.error.set('groups.switch.failed'); return false; }
    finally { if (generation === this.generation) this.context.switching.set(false); }
  }
}
