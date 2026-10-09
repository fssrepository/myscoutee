import { EntryPageComponent } from './entry-page.component';
import { environment } from '../../../../environments/environment';
import { reportBackendReadiness } from '../../../shared/core/common/backend-connectivity';
import { APP_STORAGE_KEYS } from '../../../shared/core/common/storage-scope';

describe('EntryPageComponent Explore consent continuation', () => {
  const originalMode = environment.activitiesDataSource;
  const clearConsent = () => {
    localStorage.removeItem(APP_STORAGE_KEYS.entryConsent);
    localStorage.removeItem(APP_STORAGE_KEYS.entryConsentAudit);
  };
  function entry() {
    const revision = { id: 'privacy', version: 1, sections: [] };
    return Object.assign(Object.create(EntryPageComponent.prototype), {
      entryNetworkUnavailable: false,
      entryPrivacyLoading: false,
      entryPrivacySaving: false,
      entryConsentViewOnly: false,
      showEntryConsentPopup: false,
      entryApprovedPrivacySectionIds: new Set<string>(),
      autoOnboardingRequested: false,
      privacyPolicy: { state: () => ({}), activeRevision: () => revision },
      saveEntryPrivacyApprovalState: vi.fn(),
      openDemoUserSelectorPopup: vi.fn(),
      uiText: (text: string) => text
    });
  }
  beforeEach(() => {
    clearConsent();
    environment.activitiesDataSource = 'local';
    reportBackendReadiness(true);
  });
  afterEach(() => {
    clearConsent();
    environment.activitiesDataSource = originalMode;
  });

  it.each(['local', 'http'] as const)('continues one Explore click after saved consent in %s mode', async mode => {
    environment.activitiesDataSource = mode;
    const component = entry();
    await component.openEntryDemo();
    expect(component.showEntryConsentPopup).toBe(true);
    expect(component.openDemoUserSelectorPopup).not.toHaveBeenCalled();
    await component.acceptEntryConsent([]);
    expect(component.hasEntryConsent).toBe(true);
    expect(component.showEntryConsentPopup).toBe(false);
    expect(component.openDemoUserSelectorPopup).toHaveBeenCalledOnce();
    await component.acceptEntryConsent([]);
    expect(component.openDemoUserSelectorPopup).toHaveBeenCalledOnce();
  });

  it.each(['closeEntryConsentPopup', 'rejectEntryConsent'])('cancels the pending Explore action on %s', async action => {
    const component = entry();
    await component.openEntryDemo();
    component[action]();
    await component.acceptEntryConsent([]);
    expect(component.openDemoUserSelectorPopup).not.toHaveBeenCalled();
  });

  it('does not continue until privacy choices can be saved, then resumes once on retry', async () => {
    const component = entry();
    await component.openEntryDemo();
    component.saveEntryPrivacyApprovalState.mockImplementationOnce(() => { throw new Error('storage failure'); });
    await component.acceptEntryConsent([]);
    expect(component.hasEntryConsent).toBe(false);
    expect(component.openDemoUserSelectorPopup).not.toHaveBeenCalled();
    expect(component.showEntryConsentPopup).toBe(true);
    await component.acceptEntryConsent([]);
    expect(component.openDemoUserSelectorPopup).toHaveBeenCalledOnce();
  });

  it('does not open Explore when consent was opened independently, and reuses saved consent on click', async () => {
    const component = entry();
    await component.acceptEntryConsent([]);
    expect(component.openDemoUserSelectorPopup).not.toHaveBeenCalled();
    await component.openEntryDemo();
    expect(component.openDemoUserSelectorPopup).toHaveBeenCalledOnce();
    expect(component.showEntryConsentPopup).toBe(false);
  });

  it('rechecks availability before resuming the original action', async () => {
    const component = entry();
    await component.openEntryDemo();
    component.entryNetworkUnavailable = true;
    await component.acceptEntryConsent([]);
    expect(component.openDemoUserSelectorPopup).not.toHaveBeenCalled();
  });
});
