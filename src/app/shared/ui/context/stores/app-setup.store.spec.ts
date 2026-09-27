import { signal } from '@angular/core';
import { AppSetupStore } from './app-setup.store';

describe('Setup login continuation after explicit close', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(checkLocation: boolean) {
    return Object.assign(Object.create(AppSetupStore.prototype), {
      isOpen: signal(true), nativePending: signal(false), busy: signal(false),
      allowDisabled: () => false, loggedIn: () => false,
      locationSelected: signal(true), notificationsSelected: signal(false),
      locationGranted: signal(true), locationPermission: signal('granted'),
      locationEdited: signal(false), error: signal(''), saveSucceeded: signal(false),
      actionPending: () => false, generation: 1, permission: null,
      saveFeedbackTimer: null, loginAllowed: false,
      completeLogin: vi.fn(),
      checkLocation: checkLocation ? vi.fn().mockResolvedValue(true) : null,
      location: {
        requestCurrentCoordinates: vi.fn().mockResolvedValue({ latitude: 47, longitude: 19 }),
        setTrackingEnabled: vi.fn()
      },
      messaging: { deviceNotificationsEnabled: () => false },
      pwa: { dismissInstallPrompt: vi.fn() },
      i18n: { translate: (value: string) => value }
    });
  }

  it.each([true, false])('keeps Update open and resumes the pending login only on close (location check: %s)', async checkLocation => {
    const store = setup(checkLocation);
    const continuation = store.completeLogin;
    await store.allow();
    expect(store.isOpen()).toBe(true);
    expect(store.saveSucceeded()).toBe(true);
    expect(continuation).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1100);
    expect(store.saveSucceeded()).toBe(false);
    expect(store.isOpen()).toBe(true);
    store.close();
    expect(store.isOpen()).toBe(false);
    expect(continuation).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('does not continue after a rejected location check', async () => {
    const store = setup(true);
    const continuation = store.completeLogin;
    store.checkLocation.mockRejectedValue(new Error('Outside supported region'));
    await store.allow();
    expect(store.isOpen()).toBe(true);
    expect(store.error()).toBe('Outside supported region');
    store.close();
    expect(continuation).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('requires another successful Update after editing a previously approved choice', async () => {
    const store = setup(true);
    const continuation = store.completeLogin;
    await store.allow();
    store.toggleLocation();
    store.close();
    expect(continuation).toHaveBeenCalledExactlyOnceWith(false);
  });
});
