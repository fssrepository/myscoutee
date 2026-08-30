import {
  isLoopbackHostname,
  pwaNotificationRegistrationEnabled
} from './pwa-runtime-policy';

describe('PWA notification runtime policy', () => {
  it('enables configured HTTP messaging on a normal host', () => {
    expect(pwaNotificationRegistrationEnabled({
      activitiesDataSource: 'http',
      firebaseMessagingEnabled: true,
      production: true,
      hostname: 'app.myscoutee.example',
      standalone: true,
      devServiceWorkerOverrideEnabled: false
    })).toBe(true);
  });

  it('allows loopback only for an explicit non-production standalone PWA', () => {
    const base = {
      activitiesDataSource: 'http' as const,
      firebaseMessagingEnabled: true,
      production: false,
      hostname: 'localhost',
      standalone: true,
      devServiceWorkerOverrideEnabled: true
    };

    expect(pwaNotificationRegistrationEnabled(base)).toBe(true);
    expect(pwaNotificationRegistrationEnabled({ ...base, standalone: false })).toBe(false);
    expect(pwaNotificationRegistrationEnabled({
      ...base,
      devServiceWorkerOverrideEnabled: false
    })).toBe(false);
    expect(pwaNotificationRegistrationEnabled({ ...base, production: true })).toBe(false);
  });

  it('keeps local data and disabled messaging off on every host', () => {
    const base = {
      activitiesDataSource: 'http' as const,
      firebaseMessagingEnabled: true,
      production: false,
      hostname: 'localhost',
      standalone: true,
      devServiceWorkerOverrideEnabled: true
    };

    expect(pwaNotificationRegistrationEnabled({
      ...base,
      activitiesDataSource: 'local'
    })).toBe(false);
    expect(pwaNotificationRegistrationEnabled({
      ...base,
      firebaseMessagingEnabled: false
    })).toBe(false);
  });

  it('recognizes supported loopback hostname forms', () => {
    expect(isLoopbackHostname('localhost')).toBe(true);
    expect(isLoopbackHostname('demo.localhost')).toBe(true);
    expect(isLoopbackHostname('127.0.0.1')).toBe(true);
    expect(isLoopbackHostname('[::1]')).toBe(true);
    expect(isLoopbackHostname('app.example')).toBe(false);
  });
});
