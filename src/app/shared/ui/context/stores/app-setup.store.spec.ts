import { signal } from '@angular/core';
import { AppSetupStore } from './app-setup.store';

describe('Setup acquisition budget after Android permission grant', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  async function setup(initialState: PermissionState = 'denied') {
    const permission = { state: initialState, onchange: null as (() => void) | null };
    vi.stubGlobal('navigator', { permissions: { query: vi.fn().mockResolvedValue(permission) } });
    const requests: { fail: (code: number) => void; succeed: () => void }[] = [];
    const requestCurrentCoordinates = vi.fn().mockImplementation((options = {}) => new Promise(resolve => {
      requests.push({
        fail: code => { options.onError?.({ code }); resolve(null); },
        succeed: () => resolve({ latitude: 47, longitude: 19 })
      });
    }));
    const store = Object.assign(Object.create(AppSetupStore.prototype), {
      isOpen: signal(true), nativePending: signal(false), busy: signal(false),
      allowDisabled: () => false, loggedIn: () => true, locationMissing: () => true,
      locationSelected: signal(true), notificationsSelected: signal(false),
      locationGranted: signal(initialState === 'granted'), locationPermission: signal(initialState),
      locationEdited: signal(true), error: signal(''), saveSucceeded: signal(false),
      generation: 1, permission: null, locationRequestPending: false,
      locationAcquisitionDeadlineMs: null, saveFeedbackTimer: null,
      completeLogin: null, checkLocation: null,
      location: { requestCurrentCoordinates, saveCurrentCoordinates: vi.fn().mockResolvedValue(true),
        trackingEnabled: () => true, setTrackingEnabled: vi.fn() },
      messaging: { refreshNotificationPermission: vi.fn(), deviceNotificationsEnabled: () => false },
      pwa: { dismissInstallPrompt: vi.fn() },
      i18n: { translate: (value: string) => value }
    });
    await store.refreshPermissions();
    const grant = () => { permission.state = 'granted'; permission.onchange?.(); };
    return { store, requests, grant, requestCurrentCoordinates };
  }

  it('uses only the time still shown by the ring after an OS prompt consumed the native timeout', async () => {
    const { store, requests, grant, requestCurrentCoordinates } = await setup();
    const saving = store.allow();
    await vi.advanceTimersByTimeAsync(4000);
    grant();
    expect(store.busy()).toBe(true);
    await vi.advanceTimersByTimeAsync(6000);
    requests[0].fail(3);
    await vi.advanceTimersByTimeAsync(0);
    expect(requestCurrentCoordinates).toHaveBeenCalledTimes(2);
    expect(requestCurrentCoordinates.mock.calls[1][0]).toEqual({ timeoutMs: 4000 });
    expect(store.busy()).toBe(true);
    expect(store.error()).toBe('');
    await vi.advanceTimersByTimeAsync(3000);
    requests[1].succeed();
    await saving;
    expect(store.location.saveCurrentCoordinates).toHaveBeenCalledExactlyOnceWith({ latitude: 47, longitude: 19 });
    expect(store.saveSucceeded()).toBe(true);
    expect(store.isOpen()).toBe(true);
  });

  it.each([1, 2, 3])('does not retry failure %s after the granted acquisition budget is spent', async code => {
    const { store, requests, grant, requestCurrentCoordinates } = await setup();
    const saving = store.allow();
    grant();
    await vi.advanceTimersByTimeAsync(10_000);
    requests[0].fail(code);
    await saving;
    expect(requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(store.error()).not.toBe('');
    expect(store.location.saveCurrentCoordinates).not.toHaveBeenCalled();
  });

  it.each([1, 2])('never retries native denial or position unavailable (%s), even with time remaining', async code => {
    const { store, requests, grant, requestCurrentCoordinates } = await setup();
    const saving = store.allow();
    grant();
    requests[0].fail(code);
    await saving;
    expect(requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(store.saveSucceeded()).toBe(false);
  });

  it('finishes at the same deadline when the remaining request also times out', async () => {
    const { store, requests, grant, requestCurrentCoordinates } = await setup();
    const saving = store.allow();
    await vi.advanceTimersByTimeAsync(4000);
    grant();
    await vi.advanceTimersByTimeAsync(6000);
    requests[0].fail(3);
    await vi.advanceTimersByTimeAsync(4000);
    requests[1].fail(3);
    await saving;
    expect(requestCurrentCoordinates).toHaveBeenCalledTimes(2);
    expect(store.error()).not.toBe('');
    expect(store.busy()).toBe(false);
    expect(store.saveSucceeded()).toBe(false);
  });

  it('does not repeat an already-granted request', async () => {
    const { store, requests, requestCurrentCoordinates } = await setup('granted');
    const saving = store.allow();
    requests[0].fail(3);
    await saving;
    expect(requestCurrentCoordinates).toHaveBeenCalledOnce();
  });

  it('does not continue a request after Setup is closed', async () => {
    const { store, requests, grant, requestCurrentCoordinates } = await setup();
    const saving = store.allow();
    grant();
    store.close();
    requests[0].fail(3);
    await saving;
    expect(requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(store.location.saveCurrentCoordinates).not.toHaveBeenCalled();
  });
});

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
