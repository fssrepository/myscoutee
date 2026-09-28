import { describe, expect, it, vi } from 'vitest';
import { SideMenuComponent } from './side-menu.component';

function controller() {
  const component = Object.create(SideMenuComponent.prototype) as any;
  component.userProfileStore = { activeUserProfile: vi.fn(() => null), activeUserId: () => 'firebase-uid' };
  component.groupWorkspaces = { context: { accountId: vi.fn((id: string) => id) } };
  component.profileStore = {
    privacyConsentRequiredKey: () => '', settingsPopup: () => null,
    clearPrivacyConsentRequirement: vi.fn(), closeSettingsPopup: vi.fn(), setPrivacyConsentRequiredKey: vi.fn()
  };
  component.privacyConsentCheckToken = 0;
  component.privacyConsentCheckKeyRef = () => 'current';
  component.openSettingsPopup = vi.fn();
  return component;
}
describe('privacy consent after profile hydration', () => {
  it('does not use the Firebase bootstrap UID before a persisted profile arrives', () => {
    const component = controller();
    expect(component.privacyConsentAccountId()).toBe('');
    expect(component.groupWorkspaces.context.accountId).not.toHaveBeenCalled();
    component.userProfileStore.activeUserProfile.mockReturnValue({ id: 'backend-profile' });
    expect(component.privacyConsentAccountId()).toBe('backend-profile');
  });
  it('does not reopen accepted consent and dismisses a stale required window', async () => {
    const component = controller();
    component.profileStore.privacyConsentRequiredKey = () => 'previous';
    component.profileStore.settingsPopup = () => 'privacy';
    component.privacyPolicy = { loadConsent: vi.fn().mockResolvedValue({ revisionId: 'privacy', revisionVersion: 1 }), syncAnonymousEntryConsent: vi.fn() };
    await component.ensureActivePrivacyConsent('backend-profile', { id: 'privacy', version: 1 }, 'current');
    expect(component.openSettingsPopup).not.toHaveBeenCalled();
    expect(component.privacyPolicy.syncAnonymousEntryConsent).not.toHaveBeenCalled();
    expect(component.profileStore.closeSettingsPopup).toHaveBeenCalledWith({ force: true });
  });
  it('keeps a privacy document opened voluntarily for reading', async () => {
    const component = controller();
    component.profileStore.settingsPopup = () => 'privacy';
    component.privacyPolicy = { loadConsent: vi.fn().mockResolvedValue({ revisionId: 'privacy', revisionVersion: 1 }) };
    await component.ensureActivePrivacyConsent('backend-profile', { id: 'privacy', version: 1 }, 'current');
    expect(component.profileStore.closeSettingsPopup).not.toHaveBeenCalled();
  });
  it('still requests a genuinely unaccepted revision', async () => {
    const component = controller();
    component.privacyPolicy = { loadConsent: vi.fn().mockResolvedValue(null), syncAnonymousEntryConsent: vi.fn().mockResolvedValue(false) };
    await component.ensureActivePrivacyConsent('backend-profile', { id: 'privacy', version: 2 }, 'current');
    expect(component.profileStore.setPrivacyConsentRequiredKey).toHaveBeenCalledWith('current');
    expect(component.openSettingsPopup).toHaveBeenCalledWith('privacy');
  });
});
