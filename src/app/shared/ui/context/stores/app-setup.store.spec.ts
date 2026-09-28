import { signal } from '@angular/core';
import { AppSetupStore } from './app-setup.store';

describe('Setup acquisition timer starts at permission grant', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  async function setup(initialState: PermissionState = 'denied') {
    const permission = { state: initialState, onchange: null as (() => void) | null };
    vi.stubGlobal('navigator', { permissions: { query: vi.fn().mockResolvedValue(permission) } });
    let finish!: (point: { latitude: number; longitude: number } | null) => void;
    let requestSignal!: AbortSignal;
    const requestCurrentCoordinates = vi.fn().mockImplementation((signal: AbortSignal) => new Promise(resolve => {
      requestSignal = signal;
      finish = resolve;
      signal.addEventListener('abort', () => resolve(null), { once: true });
    }));
    const store = Object.assign(Object.create(AppSetupStore.prototype), {
      isOpen: signal(true), loginRequested: signal(false), nativePending: signal(false), busy: signal(false),
      allowDisabled: () => false, loggedIn: () => true, locationMissing: () => true,
      locationSelected: signal(true), notificationsSelected: signal(false),
      locationGranted: signal(initialState === 'granted'), locationPermission: signal(initialState),
      locationEdited: signal(true), error: signal(''), saveSucceeded: signal(false),
      generation: 1, permission: null, locationRequestPending: false,
      locationRequestAbort: null, locationRequestTimer: null, saveFeedbackTimer: null,
      completeLogin: null, checkLocation: null,
      location: { requestCurrentCoordinates, saveCurrentCoordinates: vi.fn().mockResolvedValue(true),
        trackingEnabled: () => true, setTrackingEnabled: vi.fn() },
      messaging: { refreshNotificationPermission: vi.fn(), deviceNotificationsEnabled: () => false },
      pwa: { dismissInstallPrompt: vi.fn() },
      i18n: { translate: (value: string) => value }
    });
    await store.refreshPermissions();
    const grant = () => { permission.state = 'granted'; permission.onchange?.(); };
    return { store, grant, requestCurrentCoordinates,
      finish: (point: { latitude: number; longitude: number } | null) => finish(point),
      requestSignal: () => requestSignal };
  }

  it('does not start the ring or timeout while permission is pending, then allows all ten seconds', async () => {
    const { store, grant, requestSignal, requestCurrentCoordinates } = await setup();
    const saving = store.allow();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(store.busy()).toBe(false);
    expect(requestSignal().aborted).toBe(false);
    expect(store.error()).toBe('');
    expect(vi.getTimerCount()).toBe(0);
    grant();
    expect(store.busy()).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(9999);
    expect(requestSignal().aborted).toBe(false);
    expect(store.error()).toBe('');
    await vi.advanceTimersByTimeAsync(1);
    await saving;
    expect(requestSignal().aborted).toBe(true);
    expect(requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(store.error()).toBe('entry.permissions.location.unavailable');
    expect(store.busy()).toBe(false);
    expect(store.location.saveCurrentCoordinates).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('accepts a point nine seconds after granting permission, regardless of time spent deciding', async () => {
    const { store, grant, finish, requestCurrentCoordinates } = await setup();
    const saving = store.allow();
    await vi.advanceTimersByTimeAsync(40_000);
    grant();
    await vi.advanceTimersByTimeAsync(9000);
    finish({ latitude: 47, longitude: 19 });
    await saving;
    expect(requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(store.location.saveCurrentCoordinates).toHaveBeenCalledExactlyOnceWith({ latitude: 47, longitude: 19 });
    expect(store.saveSucceeded()).toBe(true);
    expect(store.isOpen()).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.error()).toBe('');
  });

  it('does not reset the running timer on focus or another permission refresh', async () => {
    const { store, grant, requestSignal } = await setup();
    const saving = store.allow();
    grant();
    await vi.advanceTimersByTimeAsync(7000);
    await store.refreshPermissions();
    await vi.advanceTimersByTimeAsync(3000);
    await saving;
    expect(requestSignal().aborted).toBe(true);
    expect(store.saveSucceeded()).toBe(false);
  });

  it('starts immediately when permission was already granted', async () => {
    const { store, requestSignal } = await setup('granted');
    const saving = store.allow();
    expect(store.busy()).toBe(true);
    await vi.advanceTimersByTimeAsync(9999);
    expect(requestSignal().aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await saving;
    expect(requestSignal().aborted).toBe(true);
  });

  it('reports actual denial without starting a timer or retrying', async () => {
    const { store, finish, requestCurrentCoordinates } = await setup();
    const saving = store.allow();
    finish(null);
    await saving;
    expect(requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(store.error()).toBe('entry.permissions.location.blocked');
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, true])('cancels acquisition on close without saving or retrying (granted: %s)', async granted => {
    const { store, grant, requestSignal, requestCurrentCoordinates } = await setup();
    const saving = store.allow();
    if (granted) grant();
    store.close();
    await saving;
    expect(requestSignal().aborted).toBe(true);
    expect(requestCurrentCoordinates).toHaveBeenCalledOnce();
    expect(store.location.saveCurrentCoordinates).not.toHaveBeenCalled();
    expect(store.error()).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Setup explicit Login action and independent Close', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(checkLocation: boolean) {
    return Object.assign(Object.create(AppSetupStore.prototype), {
      isOpen: signal(true), loginRequested: signal(false), nativePending: signal(false), busy: signal(false),
      allowDisabled: () => false, loggedIn: () => false,
      locationSelected: signal(true), notificationsSelected: signal(false),
      locationGranted: signal(true), locationPermission: signal('granted'),
      locationEdited: signal(false), error: signal(''), saveSucceeded: signal(false),
      actionPending: () => false, generation: 1, permission: null,
      saveFeedbackTimer: null,
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

  it.each([true, false])('continues only through successful Login (location check: %s)', async checkLocation => {
    const store = setup(checkLocation);
    store.loginRequested.set(true);
    const continuation = store.completeLogin;
    await store.allow();
    expect(store.isOpen()).toBe(false);
    expect(store.loginRequested()).toBe(false);
    expect(continuation).toHaveBeenCalledExactlyOnceWith(true);
    store.close();
    expect(continuation).toHaveBeenCalledOnce();
  });

  it.each([true, false])('Close cancels Login even with location granted (location check: %s)', checkLocation => {
    const store = setup(checkLocation);
    const continuation = store.completeLogin;
    store.close();
    expect(store.isOpen()).toBe(false);
    expect(continuation).toHaveBeenCalledExactlyOnceWith(false);
    expect(store.location.requestCurrentCoordinates).not.toHaveBeenCalled();
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

  it('keeps settings Update open and shows save feedback', async () => {
    const store = setup(false);
    store.completeLogin = null;
    await store.allow();
    expect(store.isOpen()).toBe(true);
    expect(store.saveSucceeded()).toBe(true);
    store.close();
    expect(store.isOpen()).toBe(false);
  });

});
