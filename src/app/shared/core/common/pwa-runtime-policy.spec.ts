import { pwaNotificationRegistrationEnabled } from './pwa-runtime-policy';

describe('PWA notification runtime policy', () => {
  const configured = { activitiesDataSource: 'http' as const, firebaseMessagingEnabled: true, serviceWorkerEnabled: true };
  it('uses the configured HTTP messaging and worker capabilities', () => {
    expect(pwaNotificationRegistrationEnabled(configured)).toBe(true);
    expect(pwaNotificationRegistrationEnabled({ ...configured, serviceWorkerEnabled: false })).toBe(false);
    expect(pwaNotificationRegistrationEnabled({ ...configured, firebaseMessagingEnabled: false })).toBe(false);
    expect(pwaNotificationRegistrationEnabled({ ...configured, activitiesDataSource: 'local' })).toBe(false);
  });
});
