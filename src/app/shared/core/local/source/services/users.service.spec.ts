import { LocalUsersService } from './users.service';

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
});
