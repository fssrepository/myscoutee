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
import type { UserDto } from '../../../core/contracts/user.interface';
import { profileMenuBadgeCount } from './app-context-store.utils';

describe('Group workspace attention scope and live updates', () => {
  let store: GroupWorkspaceStore;
  let changes: CommunityGroupChangesStore;
  let response: () => Promise<GroupWorkspace[]>;
  const row = (groupId: string, membershipStatus: 'accepted' | 'pending', role: string): GroupWorkspace => ({
    groupId, membershipStatus, requestKind: membershipStatus === 'pending' ? 'invite' : null, role, name: groupId, category: 'friends',
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
      { provide: UserProfileStore, useValue: { activeUserProfile: signal(null), activeUserId: signal(''),
        getUserProfile: () => null, getUserImpressionChangeFlags: () => ({ host: true, member: false }) } },
      { provide: ActivityStore, useValue: { getUserCounterOverrides: () => ({}) } },
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
    expect(store.counters()).toEqual({ hosting: 2, participation: 0, pending: 0, invitations: 1 });
    expect(store.categoryCount('explore', 'friends')).toBe(0);
  });

  it('totals the selected user’s group-profile menu badges and applies live counter changes only there', async () => {
    await store.refresh();
    const context = TestBed.inject(GroupWorkspaceContextService);
    context.active.set(baseline()[0]);
    const profile = { id: 'profile:design', activities: { game: 2, chats: 3, invitations: 4,
      event: { all: 5 }, feedback: 6, contacts: 80, contactRequestsPending: 2,
      cars: 20, tickets: 30, paymentRefundsPending: 3, notifications: 99 } } as unknown as UserDto;
    const userStore = TestBed.inject(UserProfileStore);
    (userStore.activeUserProfile as ReturnType<typeof signal>).set(profile);
    const overrides = signal({ event: { all: 5 } });
    TestBed.inject(ActivityStore).getUserCounterOverrides = () => overrides() as never;
    const expected = profileMenuBadgeCount(profile, {}, { host: true, member: false }, 'group');
    expect(expected).toBe(20);
    expect(store.menuItems('design').find(item => item.id === 'design')?.counter).toBe(expected + 1);
    expect(store.menuItems('design').find(item => item.id === 'friends')?.counter).toBe(1);
    overrides.set({ event: { all: 7 } });
    expect(store.menuItems('design').find(item => item.id === 'design')?.counter).toBe(expected + 3);
    expect(store.counters()).toEqual({ hosting: expected + 4, participation: 0, pending: 0, invitations: 1 });
  });

  it('keeps default-profile badges on Main profile and omits counters in the notification filter', async () => {
    await store.refresh();
    TestBed.inject(UserProfileStore).getUserProfile = () => ({ id: 'account', activities: {
      game: 2, invitations: 3, event: { all: 4 }, cars: 5, tickets: 6, contacts: 80,
      contactRequestsPending: 1, paymentRefundsPending: 2, notifications: 99
    } } as unknown as UserDto);
    expect(store.menuItems('main').find(item => item.id === 'main')?.counter).toBe(21);
    expect(store.menuItems('main').find(item => item.id === 'design')?.counter).toBe(1);
    expect(store.avatarBadgeCount()).toBe(24);
    expect(store.menuItems('all', true).every(item => !item.counter)).toBe(true);
  });

  it('applies a read delta in place and rejects the older poll instead of restoring the old count', async () => {
    await store.refresh();
    let finish!: (rows: GroupWorkspace[]) => void;
    response = () => new Promise(resolve => { finish = resolve; });
    const inFlight = store.refresh();
    changes.signalAttentionDelta('account', 'design', -1);
    TestBed.tick();
    expect(store.counters()).toEqual({ hosting: 1, participation: 0, pending: 0, invitations: 1 });
    finish(baseline());
    await inFlight;
    expect(store.counters()).toEqual({ hosting: 1, participation: 0, pending: 0, invitations: 1 });
    changes.signalAttentionDelta('another-account', 'friends', -1);
    TestBed.tick();
    expect(store.counters()).toEqual({ hosting: 1, participation: 0, pending: 0, invitations: 1 });
  });

  it('does not grant pending administrators a moderation count or selectable workspace', async () => {
    response = async () => [{ ...row('pending-admin', 'pending', 'Admin'), activity: 8, moderationPending: 7 }];
    await store.refresh();
    expect(store.workspaces()).toEqual([]);
    expect(store.counters()).toEqual({ hosting: 0, participation: 0, pending: 0, invitations: 1 });
  });
});
