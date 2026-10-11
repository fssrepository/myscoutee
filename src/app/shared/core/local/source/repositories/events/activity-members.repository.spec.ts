import { LocalActivityMembersRepository } from './activity-members.repository';

describe('Local social-card request scope', () => {
  function fixture() {
    let revision = '1';
    const users = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, gender: 'man', profileStatus: 'public',
      locationCoordinates: { latitude: 47, longitude: 19 } }));
    const graph = { neighborsByUserId: new Map([
      ['a', new Set(['b', 'd'])], ['b', new Set(['a', 'c'])],
      ['c', new Set(['b'])], ['d', new Set(['a'])]
    ]), edgeEventNameByKey: new Map() };
    const repository = Object.assign(Object.create(LocalActivityMembersRepository.prototype), {
      memoryDb: { read: () => ({ activityMembers: {} }) },
      normalizeCollection: () => ({}), gameSocialCardsCacheTokenForTable: () => revision,
      queryAcceptedMemberGraph: () => graph, gameSocialCardsCacheToken: '',
      gameSocialCardsByUserId: new Map()
    });
    Object.defineProperty(repository, 'localActivityMemberUsers', { value: users });
    return { repository, graph, advance: () => { revision = '2'; } };
  }

  it('preserves all three social modes while calculating only the requested account', () => {
    const { repository } = fixture();
    const build = vi.spyOn(repository, 'refreshGameSocialCardsCache');
    expect(repository.queryGameSocialCards('a', 'friends-in-common').map((c: any) => c.userId)).toEqual(['c']);
    expect(repository.queryGameSocialCards('a', 'separated-friends').map((c: any) => [c.userId, c.secondaryUserId])).toEqual([['b', 'd']]);
    expect(repository.queryGameSocialCards('a', 'outside-network').map((c: any) => [c.userId, c.secondaryUserId])).toEqual([['c', 'e']]);
    expect(build).toHaveBeenCalledExactlyOnceWith('a');
    repository.queryGameSocialCards('b', 'friends-in-common');
    expect(build).toHaveBeenCalledTimes(2);
    expect(build).toHaveBeenLastCalledWith('b');
    repository.queryGameSocialCards('a', 'outside-network');
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('invalidates prior accounts on graph changes and returns detached cards', () => {
    const { repository, graph, advance } = fixture();
    const first = repository.queryGameSocialCards('a', 'outside-network');
    first[0].userId = 'changed by caller';
    expect(repository.queryGameSocialCards('a', 'outside-network')[0].userId).toBe('c');
    repository.queryGameSocialCards('b', 'outside-network');
    graph.neighborsByUserId.get('c')!.add('e');
    advance();
    expect(repository.queryGameSocialCards('a', 'outside-network')).toEqual([]);
    expect([...repository.gameSocialCardsByUserId.keys()]).toEqual(['a']);
  });
});
