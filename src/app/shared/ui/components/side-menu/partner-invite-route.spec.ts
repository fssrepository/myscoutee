import { SideMenuComponent } from './side-menu.component';

describe('External event invitation workspace', () => {
  function setup(targetGroupId: string | null, startingUserId = 'group-profile') {
    let activeUserId = startingUserId;
    const component = Object.create(SideMenuComponent.prototype) as any;
    const router = { url: '/game?partnerInvite=token', parseUrl: () => ({queryParams: {partnerInvite: 'token'}}),
      navigateByUrl: vi.fn(async () => { router.url = '/game'; }) };
    const select = vi.fn(async (groupId: string | null) => { activeUserId = groupId ? 'target-profile' : 'account'; return true; });
    Object.assign(component, {
      router, openingPartnerInvite: '',
      groupWorkspaces: {select, context: {accountId: () => 'account', accountUserId: () => 'account'}},
      userProfileStore: {activeUserId: () => activeUserId},
      usersService: {claimPartnerInvite: vi.fn(async () => ({eventId: 'event', invitationAvailable: true, workspaceGroupId: targetGroupId})), loadUserById: vi.fn()},
      activitiesStore: {openActivities: vi.fn()}, dialogStore: {open: vi.fn()}
    });
    return {component, router, select};
  }

  it.each([null, 'target-group'])('selects the returned workspace %s before opening the event list', async groupId => {
    const {component, router, select} = setup(groupId);
    await component.openPartnerInviteTarget(router.url, 'group-profile');
    expect(component.usersService.claimPartnerInvite).toHaveBeenCalledWith('account', 'token');
    expect(select).toHaveBeenCalledWith(groupId);
    expect(component.activitiesStore.openActivities).toHaveBeenCalledWith('events', 'all');
    expect(select.mock.invocationCallOrder[0]).toBeLessThan(component.activitiesStore.openActivities.mock.invocationCallOrder[0]);
    expect(component.usersService.loadUserById).not.toHaveBeenCalled();
    expect(component.dialogStore.open).not.toHaveBeenCalled();
  });

  it('refreshes the existing profile once when the workspace does not change', async () => {
    const {component, router} = setup(null, 'account');
    await component.openPartnerInviteTarget(router.url, 'account');
    expect(component.usersService.loadUserById).toHaveBeenCalledExactlyOnceWith('account');
    expect(component.activitiesStore.openActivities).toHaveBeenCalledOnce();
  });

  it('retains the link and does not open a misleading list when workspace selection fails', async () => {
    const {component, router, select} = setup('target-group');
    select.mockResolvedValue(false);
    await component.openPartnerInviteTarget(router.url, 'group-profile');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(component.activitiesStore.openActivities).not.toHaveBeenCalled();
    expect(component.dialogStore.open).toHaveBeenCalledOnce();
  });
});
