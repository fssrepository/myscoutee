import { SideMenuComponent } from './side-menu.component';

describe('confirmed logout revokes the server session once', () => {
  let menu: any;
  let confirm: () => Promise<void>;
  const logoutUser = vi.fn();
  const logout = vi.fn();
  const navigate = vi.fn();
  const openInfo = vi.fn();

  beforeEach(() => {
    logoutUser.mockReset().mockResolvedValue({ submitted: true });
    logout.mockReset().mockResolvedValue(undefined);
    navigate.mockReset().mockResolvedValue(true);
    openInfo.mockReset();
    menu = Object.assign(Object.create(SideMenuComponent.prototype), {
      userProfileStore: { activeUserId: () => 'account', getUserProfile: () => ({ name: 'Alex' }) },
      groupWorkspaces: { context: { accountId: (id: string) => id } },
      usersService: { logoutUser }, sessionService: { logout },
      dialogStore: { open: (dialog: { onConfirm: () => Promise<void> }) => confirm = dialog.onConfirm, openInfo },
      router: { url: '/game', navigate },
      profileStore: { closeProfileEditor: vi.fn(), closeContactsPopup: vi.fn() },
      closeSideMenu: vi.fn(), closeSettingsPopup: vi.fn(),
      closeImpressionsPopup: vi.fn(), clearHydratedUser: vi.fn()
    });
  });

  it.each(['/game', '/admin', '/operator'])('uses the completed user action for %s', async route => {
    menu.router.url = route;
    menu.openLogoutConfirm();
    expect(logoutUser).not.toHaveBeenCalled();
    await confirm();
    expect(logoutUser).toHaveBeenCalledExactlyOnceWith('account');
    expect(logout).toHaveBeenCalledExactlyOnceWith({ sessionAlreadyRevoked: true });
    expect(navigate).toHaveBeenCalledOnce();
  });

  it('retains the session and reports a rejected server action', async () => {
    logoutUser.mockResolvedValue({ submitted: false, message: 'Try again' });
    menu.openLogoutConfirm();
    await confirm();
    expect(openInfo).toHaveBeenCalledWith('Try again', expect.any(Object));
    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('still revokes through SessionService when there is no loaded profile', async () => {
    menu.userProfileStore.activeUserId = () => '';
    menu.openLogoutConfirm();
    await confirm();
    expect(logoutUser).not.toHaveBeenCalled();
    expect(logout).toHaveBeenCalledExactlyOnceWith({ sessionAlreadyRevoked: false });
    expect(navigate).toHaveBeenCalledOnce();
  });
});
