import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GroupWorkspaceStore } from './group-workspace.store';
import { CommunityGroupChangesStore } from './community-group-changes.store';
import { GroupWorkspaceContextService } from '../../../core/base/services/group-workspace-context.service';
import { CommunityGroupsService } from '../../../core/base/services/community-groups.service';
import { UsersService } from '../../../core/base/services/users.service';
import { SessionService } from '../../../core/base/services/session.service';
import { AppRuntimeStore } from './app-runtime.store';
import { UserProfileStore } from './user-profile.store';
import { ActivityStore } from './activity.store';
import { ContentModerationStore } from './content-moderation.store';
import { UiPollCoordinator } from '../../scheduler';
import type { GroupWorkspace } from '../../../core/contracts/community-group.interface';

describe('Group workspace attention scope and live updates', () => {
  let store: GroupWorkspaceStore;
  let changes: CommunityGroupChangesStore;
  let response: () => Promise<GroupWorkspace[]>;
  const row = (groupId: string, membershipStatus: 'accepted' | 'pending', role: string): GroupWorkspace => ({
    groupId, membershipStatus, role, name: groupId, category: 'friends',
    profileId: membershipStatus === 'accepted' ? `profile:${groupId}` : null,
    activity: 1, membersActivity: 1, moderationPending: 0, moderationQueueRevision: 0,
    policy: { workspace: true, enabled: false, requiredFields: [] }
  });
  const baseline = () => [row('design', 'accepted', 'Admin'), row('friends', 'accepted', 'Admin'), row('invite', 'pending', 'Member')];

  beforeEach(() => {
    response = async () => baseline();
    TestBed.configureTestingModule({ providers: [
      { provide: CommunityGroupsService, useValue: { workspaces: () => response() } },
      { provide: UsersService, useValue: {} },
      { provide: AppRuntimeStore, useValue: {} },
      { provide: SessionService, useValue: { session: signal(null) } },
      { provide: UserProfileStore, useValue: { activeUserProfile: signal(null), activeUserId: signal('') } },
      { provide: ActivityStore, useValue: {} },
      { provide: ContentModerationStore, useValue: { attention: (_id: string, pending: number, revision: number) => ({ pending, revision }) } },
      { provide: UiPollCoordinator, useValue: {} }
    ] });
    store = TestBed.inject(GroupWorkspaceStore);
    changes = TestBed.inject(CommunityGroupChangesStore);
    TestBed.tick();
    TestBed.inject(GroupWorkspaceContextService).accountUserId.set('account');
  });
  afterEach(() => TestBed.resetTestingModule());

  it('keeps the accepted-workspace selector at 2 while Groups includes the pending invitation as 3', async () => {
    await store.refresh();
    expect(store.workspaces().map(value => value.groupId)).toEqual(['design', 'friends']);
    expect(store.menuItems('main').reduce((sum, item) => sum + Number(item.counter ?? 0), 0)).toBe(2);
    expect(store.counters()).toEqual({ hosting: 2, participation: 1 });
    expect(store.categoryCount('explore', 'friends')).toBe(0);
  });

  it('applies a read delta in place and rejects the older poll instead of restoring the old count', async () => {
    await store.refresh();
    let finish!: (rows: GroupWorkspace[]) => void;
    response = () => new Promise(resolve => { finish = resolve; });
    const inFlight = store.refresh();
    changes.signalAttentionDelta('account', 'design', -1);
    TestBed.tick();
    expect(store.counters()).toEqual({ hosting: 1, participation: 1 });
    finish(baseline());
    await inFlight;
    expect(store.counters()).toEqual({ hosting: 1, participation: 1 });
    changes.signalAttentionDelta('another-account', 'friends', -1);
    TestBed.tick();
    expect(store.counters()).toEqual({ hosting: 1, participation: 1 });
  });

  it('does not grant pending administrators a moderation count or selectable workspace', async () => {
    response = async () => [{ ...row('pending-admin', 'pending', 'Admin'), activity: 8, moderationPending: 7 }];
    await store.refresh();
    expect(store.workspaces()).toEqual([]);
    expect(store.counters()).toEqual({ hosting: 0, participation: 1 });
  });
});
