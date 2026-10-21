import { SideMenuComponent } from './side-menu.component';
import { DialogStore } from '@fssrepository/myscoutee-components';

describe('External event invitation workspace', () => {
  function setup(targetGroupId: string | null, startingUserId = 'group-profile') {
    let activeUserId = startingUserId;
    const component = Object.create(SideMenuComponent.prototype) as any;
    const router = { url: '/game?partnerInvite=token', parseUrl: () => ({queryParams: {partnerInvite: 'token'}}),
      navigateByUrl: vi.fn(async () => { router.url = '/game'; }) };
    const select = vi.fn(async (groupId: string | null) => { activeUserId = groupId ? 'target-profile' : 'account'; return true; });
    const dialogStore = new DialogStore();
    vi.spyOn(dialogStore, 'open');
    Object.assign(component, {
      router, openingPartnerInvite: '',
      groupWorkspaces: {select, context: {accountId: () => 'account', accountUserId: () => 'account'}},
      userProfileStore: {activeUserId: () => activeUserId},
      usersService: {claimPartnerInvite: vi.fn(async () => ({eventId: 'event', invitationAvailable: true, workspaceGroupId: targetGroupId})), loadUserById: vi.fn()},
      activitiesStore: {openActivities: vi.fn()}, dialogStore
    });
    return {component, router, select, setActiveUserId: (id: string) => { activeUserId = id; }};
  }

  it('does not claim an invitation until the user confirms, including across profile updates', async () => {
    const {component, router, select} = setup('target-group');
    await component.openPartnerInviteTarget(router.url, 'group-profile');
    const dialog = component.dialogStore.dialog();
    await component.openPartnerInviteTarget(router.url, 'account');
    expect(component.usersService.claimPartnerInvite).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(component.dialogStore.dialog()).toBe(dialog);
    expect(dialog.busy).toBe(false);
    expect(component.dialogStore.open).toHaveBeenCalledOnce();
    component.dialogStore.cancel();
    await vi.waitFor(() => expect(component.openingPartnerInvite).toBe(''));
    expect(component.usersService.claimPartnerInvite).not.toHaveBeenCalled();
  });

  it('does not open a second confirmation when login hydration completes after acceptance', async () => {
    const {component, router, setActiveUserId} = setup('target-group', 'firebase-id');
    const invitationUrl = router.url;
    component.groupWorkspaces.context.accountId = (id: string) => id === 'target-profile' ? 'account' : id;
    let finishProfile!: (value: unknown) => void;
    Object.assign(component, {
      hydrationRequestVersion: 0,
      isAdminWorkspaceRoute: () => false,
      activeUserLoadState: () => ({status: 'loading'}),
      sessionService: {currentSession: () => ({kind: 'firebase'})},
      syncHydratedUser: (user: {id: string}) => setActiveUserId(user.id),
      helpCenterService: {preload: vi.fn()},
    });
    component.usersService.loadProfileExtById = vi.fn(() => new Promise(resolve => { finishProfile = resolve; }));
    const hydration = component.hydrateUserAfterLogin('firebase-id');
    await component.dialogStore.confirm();
    expect(router.url).toBe(invitationUrl);
    finishProfile({profile: {id: 'account'}});
    await hydration;
    await component.openPartnerInviteTarget(router.url, 'account');
    await component.dialogStore.confirm();
    expect(component.dialogStore.dialog()).toBeNull();
    expect(component.dialogStore.open).toHaveBeenCalledOnce();
    expect(component.usersService.claimPartnerInvite).toHaveBeenCalledOnce();
  });

  it.each([null, 'target-group'])('selects the returned workspace %s before opening the event list', async groupId => {
    const {component, router, select} = setup(groupId);
    await component.openPartnerInviteTarget(router.url, 'group-profile');
    await component.dialogStore.confirm();
    expect(component.usersService.claimPartnerInvite).toHaveBeenCalledWith('account', 'token');
    expect(select).toHaveBeenCalledWith(groupId);
    expect(component.activitiesStore.openActivities).toHaveBeenCalledWith('events', 'all');
    expect(select.mock.invocationCallOrder[0]).toBeLessThan(component.activitiesStore.openActivities.mock.invocationCallOrder[0]);
    expect(component.usersService.loadUserById).not.toHaveBeenCalled();
    expect(component.dialogStore.open).toHaveBeenCalledOnce();
  });

  it('refreshes the existing profile once when the workspace does not change', async () => {
    const {component, router} = setup(null, 'account');
    await component.openPartnerInviteTarget(router.url, 'account');
    await component.dialogStore.confirm();
    expect(component.usersService.loadUserById).toHaveBeenCalledExactlyOnceWith('account');
    expect(component.activitiesStore.openActivities).toHaveBeenCalledOnce();
  });

  it('retains the link and does not open a misleading list when workspace selection fails', async () => {
    const {component, router, select} = setup('target-group');
    select.mockResolvedValue(false);
    await component.openPartnerInviteTarget(router.url, 'group-profile');
    await component.dialogStore.confirm();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(component.activitiesStore.openActivities).not.toHaveBeenCalled();
    expect(component.dialogStore.dialog()?.errorMessage).toBe('event.partner.invite.failed');
  });

  it('keeps one failed invitation popup across repeated profile updates without repeating the request', async () => {
    const {component, router} = setup('target-group');
    component.usersService.claimPartnerInvite.mockRejectedValue({status: 404});
    await component.openPartnerInviteTarget(router.url, 'group-profile');
    await component.dialogStore.confirm();
    const failed = component.dialogStore.dialog();
    await component.openPartnerInviteTarget(router.url, 'group-profile');
    await component.openPartnerInviteTarget(router.url, 'account');
    expect(component.usersService.claimPartnerInvite).toHaveBeenCalledOnce();
    expect(component.dialogStore.dialog()).toBe(failed);
    expect(failed.busy).toBe(false);
    expect(failed.errorMessage).toBe('event.partner.invite.notFound');
    expect(failed.cancelLabel).toBe('cancel');
    expect(component.dialogStore.open).toHaveBeenCalledOnce();
    component.dialogStore.cancel();
    await vi.waitFor(() => expect(component.openingPartnerInvite).toBe(''));
    expect(router.navigateByUrl).toHaveBeenCalledOnce();
    expect(component.dialogStore.dialog()).toBeNull();
  });

  it('loads only after confirmation and closes the popup only after workspace selection', async () => {
    const {component, router} = setup('target-group');
    let resolveClaim!: (value: unknown) => void;
    component.usersService.claimPartnerInvite.mockReturnValue(new Promise(resolve => { resolveClaim = resolve; }));
    await component.openPartnerInviteTarget(router.url, 'group-profile');
    expect(component.dialogStore.dialog()?.busy).toBe(false);
    const operation = component.dialogStore.confirm();
    expect(component.dialogStore.dialog()?.busy).toBe(true);
    resolveClaim({eventId: 'event', invitationAvailable: true, workspaceGroupId: 'target-group'});
    await operation;
    expect(component.dialogStore.dialog()).toBeNull();
  });
});
