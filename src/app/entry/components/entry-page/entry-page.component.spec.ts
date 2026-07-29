import { EntryPageComponent } from './entry-page.component';

describe('EntryPageComponent operator authentication gate', () => {
  it('bypasses consumer region and coordinate checks but still requires privacy consent', async () => {
    const component = Object.create(EntryPageComponent.prototype) as {
      entryNetworkUnavailable: boolean;
      loginEligibilityBusy: boolean;
      showFirebaseAuthPopup: boolean;
      sessionService: {
        authMode: 'firebase';
        firebaseProfile: () => null;
      };
      isLoginBlockedByLandingBundle: ReturnType<typeof vi.fn>;
      isLoginLocationRequiredByLandingBundle: ReturnType<typeof vi.fn>;
      ensureHttpLoginAccessAllowed: ReturnType<typeof vi.fn>;
      ensureEntryConsent: ReturnType<typeof vi.fn>;
      openBundledLoginUnavailableInfo: ReturnType<typeof vi.fn>;
      openEntryAuthPopup: (options: {
        forceAuthPopup?: boolean;
        bypassConsumerEligibility?: boolean;
      }) => Promise<void>;
    };
    component.entryNetworkUnavailable = false;
    component.loginEligibilityBusy = true;
    component.showFirebaseAuthPopup = false;
    component.sessionService = {
      authMode: 'firebase',
      firebaseProfile: () => null
    };
    component.isLoginBlockedByLandingBundle = vi.fn().mockReturnValue(true);
    component.isLoginLocationRequiredByLandingBundle = vi.fn().mockReturnValue(true);
    component.ensureHttpLoginAccessAllowed = vi.fn().mockResolvedValue(false);
    component.ensureEntryConsent = vi.fn().mockReturnValue(true);
    component.openBundledLoginUnavailableInfo = vi.fn();

    await component.openEntryAuthPopup({
      forceAuthPopup: true,
      bypassConsumerEligibility: true
    });

    expect(component.isLoginBlockedByLandingBundle).not.toHaveBeenCalled();
    expect(component.isLoginLocationRequiredByLandingBundle).not.toHaveBeenCalled();
    expect(component.ensureHttpLoginAccessAllowed).not.toHaveBeenCalled();
    expect(component.ensureEntryConsent).toHaveBeenCalledOnce();
    expect(component.showFirebaseAuthPopup).toBe(true);
  });
});
