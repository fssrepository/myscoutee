import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../common/app.db';
import { RouteDelayService } from '../../../base/services/route-delay.service';
import { LocalCommunityGroupsService } from './community-groups.service';
import { LocalActivityMembersRepository } from '../repositories/activity-members.repository';
import { LocalNotificationsRepository } from '../repositories/notifications.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalAdminModerationRepository } from '../repositories/admin-moderation.repository';
import { ACTIVITY_MEMBERS_TABLE_NAME } from '../entity/activity.entity';
import { NOTIFICATIONS_TABLE_NAME } from '../entity/notification.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import { EVENTS_TABLE_NAME } from '../entity/event.entity';
import type { UserRecord } from '../entity/user.entity';

type State = ReturnType<LocalMemoryDb['read']>;

describe('Community membership writes and recipient attention', () => {
  let state: State;
  let service: LocalCommunityGroupsService;
  let notifications: LocalNotificationsRepository;
  const owner = { ownerType: 'community', ownerId: 'group' } as const;
  const notices = () => Object.values(state[NOTIFICATIONS_TABLE_NAME].byId);
  const member = (userId: string) => state[ACTIVITY_MEMBERS_TABLE_NAME].byId[`community:group:${userId}`];

  beforeEach(() => {
    const users = Object.fromEntries(['admin', 'member', 'guest'].map(id => [id, {
      id, name: id, initials: id[0], gender: 'man', city: '', languages: [], activities: {}, images: []
    } as unknown as UserRecord]));
    state = {
      communityGroups: { ids: ['group'], byId: { group: {
        id: 'group', name: 'Group', ownerUserId: 'admin', description: '', category: 'friends',
        visibility: 'public', hideMembers: false, version: 0, pendingMembers: 0,
        policy: { workspace: false, enabled: false, requiredFields: [] }, createdAtIso: '2026-09-26', updatedAtIso: '2026-09-26'
      } } },
      [USERS_TABLE_NAME]: { ids: Object.keys(users), byId: users },
      [EVENTS_TABLE_NAME]: { ids: [], byId: {} },
      [ACTIVITY_MEMBERS_TABLE_NAME]: { ids: [], byId: {}, idsByOwnerKey: {} },
      [NOTIFICATIONS_TABLE_NAME]: { ids: [], byId: {}, idsByRecipientUserId: {}, mutedByUserId: {}, seededUserIds: [] }
    } as unknown as State;
    TestBed.configureTestingModule({ providers: [
      { provide: LocalMemoryDb, useValue: {
        read: () => state,
        write: (update: (current: State) => State) => { state = update(state); },
        whenReady: async () => undefined
      } },
      { provide: LocalUsersRepository, useValue: { queryUserById: (id: string) => state[USERS_TABLE_NAME].byId[id] ?? null } },
      { provide: LocalAdminModerationRepository, useValue: {} },
      { provide: RouteDelayService, useValue: { waitForRouteDelay: async () => undefined } }
    ] });
    service = TestBed.inject(LocalCommunityGroupsService);
    notifications = TestBed.inject(LocalNotificationsRepository);
    const repository = TestBed.inject(LocalActivityMembersRepository);
    // Use the same record creator and repository write as ordinary commands.
    const group = state.communityGroups.byId['group'];
    repository.replaceRecordsByOwner(owner, [
      service['newMember'](group, 'admin', 'Admin', 'accepted', null, 'admin'),
      service['newMember'](group, 'member', 'Member', 'accepted', null, 'admin')
    ]);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('records the granting Admin and denies revocation by another Admin', async () => {
    await service.invite('admin', 'group', ['guest']);
    await service.action('guest', 'group', 'guest', 'accept');
    await service.action('admin', 'group', 'member', 'promote-admin');
    await service.action('member', 'group', 'guest', 'promote-admin');
    expect(member('member').managerGrantedByUserId).toBe('admin');
    expect(member('guest').managerGrantedByUserId).toBe('member');
    const before = notices().length;
    await expect(service.action('admin', 'group', 'guest', 'revoke-admin')).rejects.toThrow('Forbidden');
    expect(notices()).toHaveLength(before);
    expect(member('guest').role).toBe('Admin');
    await service.action('member', 'group', 'guest', 'revoke-admin');
    expect(member('guest').role).toBe('Member');
    expect(member('guest').status).toBe('accepted');
    expect(member('guest').managerGrantedByUserId).toBeNull();
    const committed = notices().length;
    await service.action('member', 'group', 'guest', 'revoke-admin');
    expect(notices()).toHaveLength(committed);
  });

  it('invites existing Admins to take over, then keeps responsibility and member counts on retry', async () => {
    await service.invite('admin', 'group', ['guest']);
    await service.action('guest', 'group', 'guest', 'accept');
    await service.action('admin', 'group', 'member', 'promote-admin');
    const released = await service.action('admin', 'group', 'admin', 'remove');
    expect(released.group?.lifecycleStatus).toBe('under-review');
    expect(notices().filter(n => n.kind === 'community-member-removed')).toHaveLength(0);
    expect(notices().filter(n => n.kind === 'community-owner-left').map(n => n.recipientUserId)).toEqual(['member']);
    expect((await service.detail('guest', 'group')).canTakeOver).toBe(false);
    await expect(service.action('guest', 'group', 'guest', 'take-over')).rejects.toThrow('Forbidden');
    const taken = await service.action('member', 'group', 'member', 'take-over');
    expect(taken.group?.ownerUserId).toBe('member');
    expect(taken.group?.lifecycleStatus).toBe('active');
    expect(taken.group?.acceptedMembers).toBe(2);
    const count = notices().length;
    await service.action('member', 'group', 'member', 'take-over');
    expect(notices()).toHaveLength(count);
    expect(notices().filter(n => n.kind === 'community-takeover')).toHaveLength(0);
    await expect(service.action('admin', 'group', 'guest', 'promote-admin')).rejects.toThrow();
  });

  it('offers the no-Admin fallback only to accepted members and returns the old creator as Member', async () => {
    await service.invite('admin', 'group', ['guest']);
    await service.action('admin', 'group', 'admin', 'remove');
    expect(notices().filter(n => n.kind === 'community-owner-left').map(n => n.recipientUserId)).toEqual(['member']);
    expect((await service.detail('guest', 'group')).canTakeOver).toBe(false);
    await service.action('member', 'group', 'member', 'take-over');
    expect(member('member').role).toBe('Admin');
    await service.invite('member', 'group', ['admin']);
    await service.action('admin', 'group', 'admin', 'accept');
    expect(member('admin').role).toBe('Member');
    expect((await service.detail('admin', 'group')).role).toBe('Member');
  });

  it('lets an ordinary member leave without releasing the group or generating takeover notices on retry', async () => {
    const left = await service.action('member', 'group', 'member', 'remove');
    expect(left.group?.ownerUserId).toBe('admin');
    expect(left.group?.lifecycleStatus).not.toBe('under-review');
    expect(left.group?.acceptedMembers).toBe(1);
    expect(await service.workspaces('member')).toEqual([]);
    expect(notices().filter(n => n.kind === 'community-owner-left')).toHaveLength(0);
    const count = notices().length;
    await service.action('member', 'group', 'member', 'remove');
    expect(notices()).toHaveLength(count);
  });

  it('does not turn an earlier member departure retry into a new responsibility-release notice', async () => {
    await service.invite('admin', 'group', ['guest']);
    await service.action('guest', 'group', 'guest', 'accept');
    await service.action('guest', 'group', 'guest', 'remove');
    await service.action('admin', 'group', 'admin', 'remove');
    const before = notices().length;
    await service.action('guest', 'group', 'guest', 'remove');
    expect(notices()).toHaveLength(before);
    expect(notices().filter(n => n.kind === 'community-owner-left').map(n => n.recipientUserId)).toEqual(['member']);
  });

  it('deletes the last-member group from lists, workspaces and direct reads and tolerates retry', async () => {
    await service.action('member', 'group', 'member', 'remove');
    const result = await service.action('admin', 'group', 'admin', 'remove');
    expect(result.group?.lifecycleStatus).toBe('deleted');
    expect(await service.workspaces('admin')).toEqual([]);
    await expect(service.detail('admin', 'group')).rejects.toThrow('Group not found');
    expect((await service.page('guest', { page: 0, pageSize: 20, filters: { bucket: 'explore' } })).items).toEqual([]);
    const count = notices().length;
    const retry = await service.action('admin', 'group', 'admin', 'remove');
    expect(retry.group?.lifecycleStatus).toBe('deleted');
    expect(notices()).toHaveLength(count);
  });

  it('persists the textual policies independently of profile visibility rules, including clearing them', async () => {
    const original = await service.detail('admin', 'group');
    const policies = [{ id: 'rule-1', title: 'Respect privacy', description: 'Do not share private group messages.', required: true }];
    const saved = await service.save({ ...original, userId: 'admin', policy: {
      ...original.policy, policiesEnabled: true, policies
    } });
    expect((await service.detail('member', 'group')).policy).toEqual({
      ...original.policy, policiesEnabled: true, policies
    });
    await service.save({ ...saved, userId: 'admin', policy: { ...saved.policy, policiesEnabled: false, policies: [] } });
    expect((await service.detail('member', 'group')).policy).toEqual({
      ...original.policy, policiesEnabled: false, policies: []
    });
  });

  it('orders Explore by distance within the same interval and supports Recent independently', async () => {
    state[USERS_TABLE_NAME].byId['guest'].locationCoordinates = { latitude: 47.48, longitude: 19.03 };
    state[USERS_TABLE_NAME].byId['admin'].locationCoordinates = { latitude: 47.51, longitude: 19.03 };
    state[USERS_TABLE_NAME].byId['member'].locationCoordinates = { latitude: 47.49, longitude: 19.03 };
    const group = state.communityGroups.byId['group'];
    group.updatedAtIso = '2026-09-26T10:00:00.000Z';
    state.communityGroups.byId['near'] = { ...group, id: 'near', ownerUserId: 'member', updatedAtIso: '2026-09-25T10:00:00.000Z' };
    state.communityGroups.ids.push('near');
    const query = { page: 0, pageSize: 1, filters: { bucket: 'explore' as const } };
    const first = await service.page('guest', query);
    expect(first.items.map(item => item.id)).toEqual(['near']);
    expect((await service.page('guest', { ...query, cursor: first.nextCursor })).items.map(item => item.id)).toEqual(['group']);
    const recent = await service.page('guest', { ...query, sort: 'updated' });
    expect(recent.items.map(item => item.id)).toEqual(['group']);
    const synced = await service.sync('guest', { bucket: 'explore', sort: 'updated', limit: 1, knownItems: [], tailId: null });
    expect(synced.upserts.map(item => item.id)).toEqual(['group']);
  });

  it('persists membership change time and leaves it unchanged on a retry', async () => {
    state.communityGroups.byId['group'].updatedAtIso = '2026-09-20T00:00:00.000Z';
    await service.join('guest', 'group');
    const changedAt = state.communityGroups.byId['group'].updatedAtIso;
    expect(changedAt > '2026-09-20T00:00:00.000Z').toBe(true);
    await service.join('guest', 'group');
    expect(state.communityGroups.byId['group'].updatedAtIso).toBe(changedAt);
  });

  it('excludes invite-only groups from every Explore order, filter and sync response', async () => {
    state.communityGroups.byId['group'].visibility = 'invitation';
    for (const sort of ['distance', 'updated'] as const) {
      for (const category of [null, 'friends'] as const) {
        const page = await service.page('guest', { page: 0, pageSize: 1, sort, filters: { bucket: 'explore', category } });
        expect(page.items).toEqual([]);
        expect(page.total).toBe(0);
        expect(page.nextCursor).toBeNull();
        const sync = await service.sync('guest', { bucket: 'explore', category, sort, limit: 1,
          knownItems: [{ id: 'group', revision: 'old' }], tailId: 'group' });
        expect(sync.upserts).toEqual([]);
        expect(sync.removedIds).toEqual(['group']);
      }
    }
    await expect(service.detail('guest', 'group')).rejects.toThrow();
  });

  it('moves a join into Pending and counts the pending operation only for the administrator', async () => {
    const joined = await service.join('guest', 'group');
    expect(joined.membershipStatus).toBe('pending');
    expect(state.communityGroups.byId['group'].pendingMembers).toBe(1);
    const query = { page: 0, pageSize: 10, filters: { bucket: 'explore' as const } };
    expect((await service.page('guest', query)).items).toHaveLength(0);
    expect((await service.page('guest', { ...query, filters: { bucket: 'pending' } })).items).toHaveLength(1);
    expect((await service.page('guest', { ...query, filters: { bucket: 'participation' } })).items).toHaveLength(0);
    expect((await service.detail('admin', 'group')).membersActivity).toBe(1);
    expect((await service.detail('member', 'group')).membersActivity).toBe(0);
    await service.join('guest', 'group');
    expect(notices().map(row => row.recipientUserId)).toEqual(['admin']);
    expect(state.communityGroups.byId['group'].pendingMembers).toBe(1);
  });

  it('notifies the affected members on acceptance, excludes the actor and does not duplicate a retry', async () => {
    await service.join('guest', 'group');
    await service.action('admin', 'group', 'guest', 'accept');
    await service.action('admin', 'group', 'guest', 'accept');
    expect(state.communityGroups.byId['group'].pendingMembers).toBe(0);
    expect(notices().filter(row => row.kind === 'community-member-joined').map(row => row.recipientUserId).sort())
      .toEqual(['guest', 'member']);
    expect(member('admin').communityUpdates ?? 0).toBe(0);
    expect(member('member').communityUpdates).toBe(1);
    expect(member('guest').communityUpdates).toBe(1);
    const notice = notices().find(row => row.recipientUserId === 'member')!;
    expect(notifications.markRead('admin', notice.id)).toBeNull();
    notifications.markRead('member', notice.id);
    notifications.markRead('member', notice.id);
    expect((await service.detail('member', 'group')).membersActivity).toBe(0);
    expect((await service.detail('guest', 'group')).membersActivity).toBe(1);
  });

  it('keeps hidden member changes private while notifying the newly accepted recipient', async () => {
    state.communityGroups.byId['group'].hideMembers = true;
    await service.join('guest', 'group');
    await service.action('admin', 'group', 'guest', 'accept');
    expect(notices().filter(row => row.kind === 'community-member-joined').map(row => row.recipientUserId)).toEqual(['guest']);
    expect((await service.detail('member', 'group')).membersActivity).toBe(0);
  });

  it('adds two operation deltas in one group and reading one leaves the other counted', async () => {
    await service.join('guest', 'group');
    await service.action('admin', 'group', 'guest', 'accept');
    await service.action('admin', 'group', 'member', 'promote-admin');
    await service.action('admin', 'group', 'member', 'promote-admin');
    expect((await service.detail('member', 'group')).membersActivity).toBe(2);
    const joined = notices().find(row => row.recipientUserId === 'member' && row.kind === 'community-member-joined')!;
    notifications.markRead('member', joined.id);
    expect((await service.detail('member', 'group')).membersActivity).toBe(1);
    expect(member('guest').communityUpdates).toBe(1);
  });

  it('counts a pending invitation for its recipient without making the workspace selectable', async () => {
    state[USERS_TABLE_NAME].byId['group:group:guest'] = {
      ...state[USERS_TABLE_NAME].byId['guest'], id: 'group:group:guest', activities: { game: 7 }
    } as UserRecord;
    expect((await service.detail('guest', 'group')).activity).toBe(0);
    await service.invite('admin', 'group', ['guest']);
    await service.invite('admin', 'group', ['guest']);
    const rows = await service.workspaces('guest');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ membershipStatus: 'pending', membersActivity: 1, activity: 1 });
    expect(await service.detail('guest', 'group')).toMatchObject({ pendingMembers: 1, membersActivity: 1 });
    expect(await service.detail('member', 'group')).toMatchObject({ pendingMembers: 0 });
    await expect(service.resolveWorkspace('guest', 'group')).rejects.toThrow('Forbidden');
    expect(notices().map(row => row.recipientUserId)).toEqual(['guest']);
    expect(state.communityGroups.byId['group'].pendingMembers).toBe(1);
  });

  it('moves an accepted invitation into Active groups and removes it from invitation sync without double counting', async () => {
    await service.invite('admin', 'group', ['guest']);
    const page = (bucket: 'hosting' | 'participation' | 'pending' | 'invitations' | 'explore') => service.page('guest', {
      page: 0, pageSize: 10, filters: { bucket }
    });
    expect((await page('invitations')).items.map(row => row.id)).toEqual(['group']);
    expect((await page('invitations')).context).toEqual({ hosting: 0, participation: 0, pending: 0, invitations: 1 });
    expect((await page('participation')).items).toEqual([]);
    expect((await page('hosting')).items).toEqual([]);
    expect((await page('explore')).items).toEqual([]);
    await service.action('guest', 'group', 'guest', 'accept');
    await service.action('guest', 'group', 'guest', 'accept');
    expect((await page('invitations')).items).toEqual([]);
    expect((await page('participation')).items.map(row => row.id)).toEqual(['group']);
    expect((await page('participation')).context?.invitations).toBe(0);
    expect((await service.sync('guest', { bucket: 'invitations', limit: 10,
      knownItems: [{ id: 'group', revision: 'before-acceptance' }], tailId: 'group' })).removedIds).toEqual(['group']);
    expect((await service.workspaces('guest'))[0].requestKind).toBeNull();
  });
  it('moves a join request Explore → Pending → Active with matching sync removals', async () => {
    const page = (bucket: 'explore' | 'pending' | 'participation') => service.page('guest', {
      page: 0, pageSize: 10, filters: { bucket }
    });
    expect((await page('explore')).items.map(row => row.id)).toEqual(['group']);
    await service.join('guest', 'group');
    expect((await page('explore')).items).toEqual([]);
    expect((await page('participation')).items).toEqual([]);
    expect((await page('pending')).items.map(row => row.id)).toEqual(['group']);
    await service.action('admin', 'group', 'guest', 'accept');
    expect((await page('pending')).items).toEqual([]);
    expect((await page('participation')).items.map(row => row.id)).toEqual(['group']);
    expect((await service.sync('guest', { bucket: 'pending', limit: 10,
      knownItems: [{ id: 'group', revision: 'before' }], tailId: 'group' })).removedIds).toEqual(['group']);
  });

});
