import { LocalUsersService } from './users.service';
import { LocalCountryPartitionsRepository } from '../repositories/country-partitions.repository';

describe('Local profile-load location flush', () => {
  function fixture() {
    const account = { id: 'account', activeWorkspaceGroupId: 'group-a' };
    const member = { id: 'group-profile', accountUserId: 'account' };
    const records = new Map<string, any>([['account', account], ['group-profile', member]]);
    const repository = {
      whenReady: vi.fn().mockResolvedValue(undefined), queryUserById: (id: string) => records.get(id),
      upsertUser: vi.fn((user: any) => records.set(user.id, user)), flushToIndexedDb: vi.fn().mockResolvedValue(undefined),
      selectWorkspace: vi.fn().mockResolvedValue(undefined)
    };
    const service = Object.assign(Object.create(LocalUsersService.prototype), {
      usersRepository: repository, waitForRouteDelay: vi.fn().mockResolvedValue(undefined),
      countryPartitionsRepository: new LocalCountryPartitionsRepository(),
      groups: { resolveWorkspace: vi.fn().mockResolvedValue({ profile: member, accountProfile: { ...account },
        workspace: { groupId: 'group-a', profileId: 'group-profile' } }) },
      readUserById: async (id: string) => ({ user: records.get(id) }),
      profileExperiencesRepository: { queryUserExperienceRecords: () => [] }
    });
    return { service, repository, records };
  }
  it('persists both account and selected profile before acknowledging the initial coordinates', async () => {
    const { service, repository, records } = fixture();
    const location = { latitude: 47, longitude: 19 };
    const result = await service.loadProfileExtById('account', undefined, undefined, location);
    expect(repository.flushToIndexedDb).toHaveBeenCalledOnce();
    expect(records.get('account').locationCoordinates).toEqual(location);
    expect(result.accountProfile.locationCoordinates).toEqual(location);
    expect(result.profileExt.profile.locationCoordinates).toEqual(location);
    expect(repository.selectWorkspace).not.toHaveBeenCalled();
  });
  it('does not rewrite location during a restored profile read', async () => {
    const { service, repository } = fixture();
    await service.loadProfileExtById('account');
    expect(repository.upsertUser).not.toHaveBeenCalled();
    expect(repository.flushToIndexedDb).not.toHaveBeenCalled();
  });
  it('does not return success if the IndexedDB flush fails', async () => {
    const { service, repository } = fixture();
    repository.flushToIndexedDb.mockRejectedValue(new Error('storage unavailable'));
    await expect(service.loadProfileExtById('account', undefined, undefined, { latitude: 47, longitude: 19 }))
      .rejects.toThrow('storage unavailable');
  });

  it('discards an unsupported pending point and returns the last accepted profile', async () => {
    const { service, repository, records } = fixture();
    const accepted = { latitude: 47.4979, longitude: 19.0402 };
    records.get('account').locationCoordinates = accepted;
    records.get('group-profile').locationCoordinates = accepted;
    const result = await service.loadProfileExtById('account', undefined, undefined, { latitude: 30.2672, longitude: -97.7431 });
    expect(result.profileExt.profile.locationCoordinates).toEqual(accepted);
    expect(repository.upsertUser).not.toHaveBeenCalled();
    expect(repository.flushToIndexedDb).not.toHaveBeenCalled();
    expect(records.get('account').locationCoordinates).toEqual(accepted);
    expect(records.get('group-profile').locationCoordinates).toEqual(accepted);
  });

  it('still rejects an unsupported point if there is no previously accepted location', async () => {
    const { service, repository } = fixture();
    await expect(service.loadProfileExtById('account', undefined, 'group-b', { latitude: 30.2672, longitude: -97.7431 }))
      .rejects.toThrow('Unavailable in your country');
    expect(service.groups.resolveWorkspace).not.toHaveBeenCalled();
    expect(repository.upsertUser).not.toHaveBeenCalled();
  });

  it.each(['saveUserProfile', 'saveUserProfileExt'])('rejects an unsupported edit through %s before writing', async method => {
    const { service, repository } = fixture();
    const profile = { id: 'account', locationCoordinates: { latitude: 30.2672, longitude: -97.7431 } };
    await expect(service[method](method === 'saveUserProfile' ? profile : { profile }))
      .rejects.toThrow('Unavailable in your country');
    expect(repository.upsertUser).not.toHaveBeenCalled();
    expect(repository.flushToIndexedDb).not.toHaveBeenCalled();
  });
});

describe('Local demo selector location hint', () => {
  it('marks member profiles requiring setup without marking privileged selector roles', async () => {
    const records = [
      { id: 'missing' },
      { id: 'unsupported', locationCoordinates: { latitude: 30.2672, longitude: -97.7431 } },
      { id: 'valid', locationCoordinates: { latitude: 47.4979, longitude: 19.0402 } }
    ];
    const service = Object.assign(Object.create(LocalUsersService.prototype), {
      waitForRouteDelay: vi.fn().mockResolvedValue(undefined),
      usersRepository: { queryAvailableDemoUsers: () => records },
      countryPartitionsRepository: new LocalCountryPartitionsRepository()
    });
    expect((await service.queryAvailableDemoUsers('member')).map(user => user.locationRequired)).toEqual([true, true, false]);
    expect((await service.queryAvailableDemoUsers('admin')).map(user => user.locationRequired)).toEqual([false, false, false]);
  });
});
