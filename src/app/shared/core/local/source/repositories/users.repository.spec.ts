import { TestBed } from '@angular/core/testing';

import { LocalMemoryDb } from '../../../common/app.db';
import type { UserDto } from '../../../contracts/user.interface';
import { USERS_TABLE_NAME } from '../entity/user.entity';

import { LocalUsersRepository } from './users.repository';

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
    TestBed.resetTestingModule();
  });

  it('returns member and admin selector users alphabetically by display name', () => {
    seedUsers([
      user('zoe', 'Zoe', { affinity: 100 }),
      user('u-onboarding', '', {
        city: '',
        initials: 'NP',
        statusText: 'New',
        completion: 0,
        profileFormVersion: 0
      }),
      user('ava', 'ava', { affinity: 1 }),
      user('mia', 'Mia', { affinity: 50 }),
      user('admin-demo-zoe', 'Zoe Admin', { admin: true, affinity: 100 }),
      user('admin-demo-ava', 'ava Admin', { admin: true, affinity: 1 })
    ]);

    expect(repository.queryAvailableDemoUsers('member').map(item => item.id))
      .toEqual(['u-onboarding', 'ava', 'mia', 'zoe']);
    expect(repository.queryAvailableDemoUsers('admin').map(item => item.id))
      .toEqual(['admin-demo-ava', 'admin-demo-zoe']);
  });

  function seedUsers(users: UserDto[]): void {
    memoryDb.write(state => ({
      ...state,
      [USERS_TABLE_NAME]: {
        byId: Object.fromEntries(users.map(item => [item.id, item])),
        ids: users.map(item => item.id)
      }
    }));
  }

  function user(id: string, name: string, overrides: Partial<UserDto> = {}): UserDto {
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
        chat: 0,
        invitations: 0,
        events: 0,
        hosting: 0
      },
      ...overrides
    };
  }
});
