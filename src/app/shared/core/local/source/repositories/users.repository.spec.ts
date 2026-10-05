import { TestBed } from '@angular/core/testing';

import { LocalMemoryDb } from '../../../common/app.db';
import type { UserRecord } from '../entity/user.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';

import { LocalUsersRepository } from './users.repository';
import { LocalGameService } from '../services/game.service';
import { LocalActivityMembersRepository } from './activity-members.repository';
import { GroupWorkspaceContextService } from '../../../base/services/group-workspace-context.service';

describe('LocalUsersRepository demo selector', () => {
  let memoryDb: LocalMemoryDb;
  let repository: LocalUsersRepository;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    memoryDb = TestBed.inject(LocalMemoryDb);
    await memoryDb.resetStorage();
    repository = TestBed.inject(LocalUsersRepository);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('keeps page filters when home filters change and isolates users', () => {
    const filters = { friendsOnly: true, openSpotsOnly: false, topic: 'Music', mode: 'Mingle' as const };
    repository.upsertUserFilterPreferences('viewer', { ageMin: 20, pageFilters: { 'event-explore': filters } });
    repository.upsertUserFilterPreferences('viewer', { ageMin: 30 });
    expect(repository.queryUserFilterPreferences('viewer')).toEqual({ ageMin: 30, pageFilters: { 'event-explore': filters } });
    expect(repository.queryUserFilterPreferences('other')).toBeNull();
    repository.upsertUserFilterPreferences('viewer', { pageFilters: { 'event-explore': { friendsOnly: false, openSpotsOnly: false, topic: '', mode: '' } } });
    expect(repository.queryUserFilterPreferences('viewer')?.ageMin).toBe(30);
    expect(repository.queryUserFilterPreferences('viewer')?.pageFilters?.['event-explore']?.mode).toBe('');
  });

  it('keeps Home candidates in the rater profile workspace, independently of the saved selection', () => {
    seedUsers([
      user('account', 'Account', { activeWorkspaceGroupId: 'b' }),
      user('base-peer', 'Base peer'),
      user('a-self', 'A self', { workspaceGroupId: 'a', accountUserId: 'account' }),
      user('a-peer', 'A peer', { workspaceGroupId: 'a' }),
      user('b-self', 'B self', { workspaceGroupId: 'b', accountUserId: 'account' }),
      user('b-peer', 'B peer', { workspaceGroupId: 'b' })
    ]);
    expect(repository.queryGameStackUsers('account').map(user => user.id)).toEqual(['base-peer']);
    expect(repository.queryGameStackUsers('a-self').map(user => user.id)).toEqual(['a-peer']);
    expect(repository.queryGameStackUsers('b-self').map(user => user.id)).toEqual(['b-peer']);
    expect(repository.queryGameStackUsers('missing')).toEqual([]);
  });

  it('uses the requested profile for social cards when the saved workspace differs', async () => {
    seedUsers([
      user('account', 'Account', { activeWorkspaceGroupId: 'b' }),
      user('a-self', 'A self', { workspaceGroupId: 'a', accountUserId: 'account' }),
      user('a-peer', 'A peer', { workspaceGroupId: 'a' }),
      user('b-peer', 'B peer', { workspaceGroupId: 'b' })
    ]);
    TestBed.inject(GroupWorkspaceContextService).accountUserId.set('account');
    const service = TestBed.inject(LocalGameService);
    vi.spyOn(service as any, 'waitForRouteDelay').mockResolvedValue(undefined);
    vi.spyOn(TestBed.inject(LocalActivityMembersRepository), 'queryGameSocialCards').mockReturnValue([
      { id: 'a-card', userId: 'a-peer', bridgeUserId: 'a-self', socialContext: 'friends-in-common' },
      { id: 'b-card', userId: 'b-peer', bridgeUserId: 'a-self', socialContext: 'friends-in-common' }
    ]);
    const result = await service.queryUserGameCardsByFilter({ userId: 'a-self', mode: 'friends-in-common' });
    expect(result.cards?.socialCards?.map(card => card.id)).toEqual(['a-card']);
    expect(result.cards?.filterCount).toBe(1);
  });

  it('returns member and admin selector users alphabetically by display name', () => {
    seedUsers([
      user('zoe', 'Zoe', { affinity: 100 }),
      user('ava', 'ava', { affinity: 1 }),
      user('mia', 'Mia', { affinity: 50 }),
      user('admin-demo-zoe', 'Zoe Admin', { admin: true, affinity: 100 }),
      user('admin-demo-ava', 'ava Admin', { admin: true, affinity: 1 })
    ]);

    expect(repository.queryAvailableDemoUsers('member').map(item => item.id))
      .toEqual(['ava', 'mia', 'zoe']);
    expect(repository.queryAvailableDemoUsers('admin').map(item => item.id))
      .toEqual(['admin-demo-ava', 'admin-demo-zoe']);
  });

  it('requires the explicit operator flag for the operator selector', () => {
    seedUsers([
      user('operator-explicit', 'Explicit Operator', {
        operator: true,
        hostTier: ''
      }),
      user('operator-presentation-only', 'Presentation Only', {
        hostTier: 'Operator'
      }),
      user('regular-member', 'Regular Member')
    ]);

    expect(repository.queryAvailableDemoUsers('operator').map(item => item.id))
      .toEqual(['operator-explicit']);
    expect(repository.queryAvailableDemoUsers('member').map(item => item.id))
      .toEqual(['operator-presentation-only', 'regular-member']);
  });

  function seedUsers(users: UserRecord[]): void {
    memoryDb.write(state => ({
      ...state,
      [USERS_TABLE_NAME]: {
        byId: Object.fromEntries(users.map(item => [item.id, item])),
        ids: users.map(item => item.id)
      }
    }));
  }

  function user(id: string, name: string, overrides: Partial<UserRecord> = {}): UserRecord {
    return {
      id,
      name,
      age: 30,
      birthday: '',
      city: 'Budapest',
      height: '',
      physique: '',
      languages: [],
      horoscope: '',
      initials: name
        .split(/\s+/)
        .map(part => part[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      gender: 'woman',
      statusText: '',
      hostTier: '',
      traitLabel: '',
      completion: 100,
      profileFormVersion: 1,
      headline: '',
      about: '',
      affinity: 0,
      images: [],
      profileStatus: 'public',
      activities: {
        game: 0,
        chats: 0,
        invitations: 0,
        events: 0,
        hosting: 0
      },
      ...overrides
    };
  }
});
