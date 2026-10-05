import { LocalIntegrationService } from './integration.service';

describe('Local external event invitation', () => {
  it('uses the invited workspace type for the landing, even from a different active profile', async () => {
    const service = Object.create(LocalIntegrationService.prototype) as any;
    Object.assign(service, {
      repository: {whenReady: vi.fn(), externalInvite: () => ({url: '/game?partnerInvite=token'}), flushToIndexedDb: vi.fn()},
      waitForRouteDelay: vi.fn(), users: {queryUserById: () => ({id: 'profile', accountUserId: 'owner', workspaceGroupId: 'another-group'})},
      groups: {detail: vi.fn(async () => ({role: 'Admin', membershipStatus: 'accepted', groupType: 'work'}))}
    });
    expect(await service.externalInviteLink({userId: 'profile', ownerType: 'community', entityId: 'work-team'}))
      .toEqual({url: '/game?partnerInvite=token&mode=work'});
    expect(service.groups.detail).toHaveBeenCalledWith('owner', 'work-team');
  });
  it('uses the account profile for a Main event when the recipient is viewing a group, and keeps retries unique', async () => {
    const users: Record<string, any> = {
      owner: {id: 'owner'}, account: {id: 'account', name: 'Recipient', images: []},
      'group-profile': {id: 'group-profile', accountUserId: 'account', workspaceGroupId: 'group'}
    };
    const event = {id: 'event', creatorUserId: 'owner', adminIds: ['owner'], endAtIso: '2099-01-01T00:00:00Z', capacityTotal: 10};
    let members: any[] = [];
    const replaceMembersByOwner = vi.fn(async (_owner, updated) => { members = updated; });
    const service = Object.create(LocalIntegrationService.prototype) as any;
    Object.assign(service, {
      repository: {whenReady: vi.fn(), findExternalInvite: () => ({ownerType: 'event', ownerUserId: 'owner', entityId: 'event'}), flushToIndexedDb: vi.fn()},
      waitForRouteDelay: vi.fn(), users: {queryUserById: (id: string) => users[id]},
      events: {queryEventRecordById: () => event},
      members: {peekMembersByOwner: () => members, replaceMembersByOwner}
    });
    expect(await service.claimExternalInvite('group-profile', 'token')).toEqual({eventId: 'event', workspaceGroupId: null, invitationAvailable: true});
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({userId: 'account', status: 'pending', requestKind: 'invite', pendingSource: 'admin'});
    await service.claimExternalInvite('group-profile', 'token');
    expect(replaceMembersByOwner).toHaveBeenCalledOnce();
    expect(members).toHaveLength(1);
  });
});
