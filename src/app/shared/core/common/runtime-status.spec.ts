import { vi } from 'vitest';

// Each case represents a fresh page: adapters/storage scope are fixed at bootstrap.
describe('landing runtime status', () => {
  const base = document.baseURI;
  const snapshot = (ready: boolean, age = 0) => {
    let element = document.getElementById('myscoutee-runtime-status');
    if (!element) {
      element = document.createElement('script'); element.id = 'myscoutee-runtime-status';
      element.setAttribute('type', 'application/json'); document.head.append(element);
    }
    element.textContent = JSON.stringify({ ready, checkedAt: Math.floor(Date.now() / 1000) - age });
  };
  let mode: typeof import('../../../../environments/environment').environment;
  let failover: typeof import('./demo-failover');
  let connectivity: typeof import('./backend-connectivity');
  let fetchStatus: ReturnType<typeof vi.fn>;
  const response = (ready: boolean, age = 0) => new Response(JSON.stringify({
    ready, checkedAt: Math.floor(Date.now() / 1000) - age
  }), { headers: { Date: new Date().toUTCString() } });

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    snapshot(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.stubGlobal('location', { pathname: new URL(base).pathname, reload: vi.fn() });
    mode = (await import('../../../../environments/environment')).environment;
    Object.assign(mode, { activitiesDataSource: 'http', operatorRegistryDataSource: 'session',
      firebaseLoginEnabled: true, firebaseMessagingEnabled: true,
      paymentIntegrationEnabled: true, paymentSimulatorConfigUrl: '/api/payment' });
    fetchStatus = vi.fn().mockImplementation(async () => response(true));
    vi.stubGlobal('fetch', fetchStatus);
    failover = await import('./demo-failover');
    connectivity = await import('./backend-connectivity');
  });
  afterEach(() => {
    document.querySelector('[data-test-popup]')?.remove();
    document.getElementById('myscoutee-runtime-status')?.remove();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reads the HTML head immediately without waiting for a fetch or the poll', async () => {
    fetchStatus.mockReturnValue(new Promise(() => undefined));
    await failover.prepareDemoFailover();
    expect(mode.activitiesDataSource).toBe('http');
    expect(fetchStatus).not.toHaveBeenCalled();
  });

  it.each(['down', 'stale', 'invalid', 'missing'])('uses existing local adapters for an anonymous %s snapshot', async state => {
    snapshot(state !== 'down', state === 'stale' ? 30 : 0);
    if (state === 'invalid') document.getElementById('myscoutee-runtime-status')!.textContent = '<!--# include -->';
    if (state === 'missing') document.getElementById('myscoutee-runtime-status')!.remove();
    await failover.prepareDemoFailover();
    expect(fetchStatus).not.toHaveBeenCalled();
    expect(mode.activitiesDataSource).toBe('local');
    expect(mode.operatorRegistryDataSource).toBe('local');
    expect(mode.firebaseLoginEnabled).toBe(false);
    expect(mode.paymentIntegrationEnabled).toBe(false);
    expect(connectivity.backendUnavailable()).toBe(true);
    expect(localStorage.length).toBe(0);
    expect(failover.demoFailoverLocalUser()).toBeNull();
  });

  it.each(['/game', '/admin', '/operator'])('retains a selected local demo on workspace reload at %s', async path => {
    snapshot(false);
    vi.stubGlobal('location', { pathname: path, reload: vi.fn() });
    const selected = JSON.stringify({ kind: 'demo', userId: 'selected-local-demo' });
    localStorage.setItem('myscoutee.demo.session.v1', selected);
    await failover.prepareDemoFailover();
    expect(mode.activitiesDataSource).toBe('local');
    expect(localStorage.getItem('myscoutee.demo.session.v1')).toBe(selected);
    expect(localStorage.getItem('myscoutee.http.session.v1')).toBeNull();
    expect(fetchStatus).not.toHaveBeenCalled();
  });

  it('keeps a retained real HTTP identity authoritative over a local demo on reload', async () => {
    snapshot(false);
    vi.stubGlobal('location', { pathname: '/admin', reload: vi.fn() });
    const real = JSON.stringify({ kind: 'firebase', profile: { id: 'real-user' }, sessionId: 'real-session' });
    localStorage.setItem('myscoutee.http.session.v1', real);
    localStorage.setItem('myscoutee.demo.session.v1', JSON.stringify({ kind: 'demo', userId: 'selected-local-demo' }));
    await failover.prepareDemoFailover();
    expect(mode.activitiesDataSource).toBe('http');
    expect(localStorage.getItem('myscoutee.http.session.v1')).toBe(real);
  });

  it('ends the paired HTTP demo on local logout and retains a newly selected local actor on reload', async () => {
    snapshot(false);
    const [httpId, localId] = [...await failover.demoSeedUserIds()][0];
    localStorage.setItem('myscoutee.http.session.v1', JSON.stringify({ kind: 'demo', userId: httpId }));
    await failover.prepareDemoFailover();
    expect(JSON.parse(localStorage.getItem('myscoutee.demo.session.v1')!).userId).toBe(localId);
    failover.endDemoFailoverSession();
    localStorage.removeItem('myscoutee.demo.session.v1');
    expect(localStorage.getItem('myscoutee.http.session.v1')).toBeNull();
    expect(localStorage.getItem('myscoutee.demo.failover.pair')).toBeNull();
    const next = JSON.stringify({ kind: 'demo', userId: 'selected-local-admin' });
    localStorage.setItem('myscoutee.demo.session.v1', next);
    mode.activitiesDataSource = 'http';
    vi.stubGlobal('location', { pathname: '/admin', reload: vi.fn() });
    await failover.prepareDemoFailover();
    expect(mode.activitiesDataSource).toBe('local');
    expect(localStorage.getItem('myscoutee.demo.session.v1')).toBe(next);
  });

  it('does not clear a different real identity when ending a local demo pair', async () => {
    snapshot(false);
    const [httpId] = [...await failover.demoSeedUserIds()][0];
    localStorage.setItem('myscoutee.http.session.v1', JSON.stringify({ kind: 'demo', userId: httpId }));
    await failover.prepareDemoFailover();
    const real = JSON.stringify({ kind: 'firebase', profile: { id: 'real-user' }, sessionId: 'real-session' });
    localStorage.setItem('myscoutee.http.session.v1', real);
    failover.endDemoFailoverSession();
    expect(localStorage.getItem('myscoutee.http.session.v1')).toBe(real);
  });

  it('returns from local landing to HTTP through one fresh bootstrap after recovery', async () => {
    snapshot(false);
    await failover.prepareDemoFailover();
    expect(mode.activitiesDataSource).toBe('local');
    await failover.checkDemoFailover();
    expect(location.reload).toHaveBeenCalledOnce();
    expect(`${fetchStatus.mock.calls[0][0]}`).toBe(new URL('/api/runtime-status', base).href);
    expect(fetchStatus.mock.calls[0][1].cache).toBe('no-store');
  });

  it.each(['ui-popup', 'firebase-auth-overlay'])('defers landing recovery while %s is open', async popupClass => {
    await failover.prepareDemoFailover();
    const popup = document.createElement('div');
    popup.className = popupClass; popup.dataset['testPopup'] = '';
    document.body.append(popup);
    fetchStatus.mockImplementation(async () => response(false));
    await failover.checkDemoFailover();
    expect(connectivity.backendUnavailable()).toBe(true);
    expect(location.reload).not.toHaveBeenCalled();
    popup.remove();
    await failover.checkDemoFailover();
    expect(location.reload).toHaveBeenCalledOnce();
  });

  it('does not reload if Firebase login finishes during a pending anonymous readiness check', async () => {
    await failover.prepareDemoFailover();
    let complete!: (value: Response) => void;
    fetchStatus.mockReturnValue(new Promise<Response>(resolve => complete = resolve));
    const check = failover.checkDemoFailover();
    localStorage.setItem('myscoutee.http.session.v1', JSON.stringify({
      kind: 'firebase', profile: { id: 'real-user' }, sessionId: 'real-session'
    }));
    complete(response(false));
    await check;
    expect(location.reload).not.toHaveBeenCalled();
  });

  it('does not probe native GitHub Pages or rewrite a retained real identity', async () => {
    mode.activitiesDataSource = 'local';
    await failover.prepareDemoFailover();
    expect(fetchStatus).not.toHaveBeenCalled();
    mode.activitiesDataSource = 'http';
    const real = JSON.stringify({ kind: 'firebase', profile: { id: 'real-user' }, sessionId: 'real-session' });
    localStorage.setItem('myscoutee.http.session.v1', real);
    fetchStatus.mockImplementation(async () => response(false));
    await failover.prepareDemoFailover();
    expect(mode.activitiesDataSource).toBe('http');
    expect(localStorage.getItem('myscoutee.http.session.v1')).toBe(real);
    expect(localStorage.getItem('myscoutee.demo.session.v1')).toBeNull();
  });

  it('does not let an unrelated API response override a failed readiness sample', () => {
    connectivity.reportBackendReadiness(false);
    connectivity.reportBackendStatus(200);
    expect(connectivity.backendUnavailable()).toBe(true);
    connectivity.reportBackendReadiness(true);
    expect(connectivity.backendUnavailable()).toBe(false);
  });

  it('never overlaps samples and skips requests while hidden', async () => {
    await failover.prepareDemoFailover();
    let complete!: (value: Response) => void;
    fetchStatus.mockClear().mockReturnValue(new Promise<Response>(resolve => complete = resolve));
    const first = failover.checkDemoFailover();
    await failover.checkDemoFailover();
    expect(fetchStatus).toHaveBeenCalledOnce();
    complete(response(true)); await first;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await failover.checkDemoFailover();
    expect(fetchStatus).toHaveBeenCalledOnce();
  });
  it('uses status events without repeated HTTP reads and fails closed on a silent stream', async () => {
    vi.useFakeTimers();
    class FakeEventSource extends EventTarget {
      static instances: FakeEventSource[] = [];
      onerror: (() => void) | null = null;
      close = vi.fn();
      constructor(public url: string) { super(); FakeEventSource.instances.push(this); }
      status(ready: boolean, known = true) {
        this.dispatchEvent(new MessageEvent('status', { data: JSON.stringify({ ready, known }) }));
      }
    }
    vi.stubGlobal('EventSource', FakeEventSource);
    try {
      await failover.prepareDemoFailover();
      failover.startDemoFailover();
      const events = FakeEventSource.instances[0]!;
      expect(events.url).toBe(new URL('/api/runtime-status/events', base).href);
      events.status(true);
      await vi.advanceTimersByTimeAsync(11000);
      expect(fetchStatus).not.toHaveBeenCalled();
      expect(location.reload).not.toHaveBeenCalled();
      const popup = document.createElement('div');
      popup.className = 'ui-popup'; popup.dataset['testPopup'] = ''; document.body.append(popup);
      events.status(false);
      await vi.advanceTimersByTimeAsync(0);
      expect(connectivity.backendUnavailable()).toBe(true);
      expect(location.reload).not.toHaveBeenCalled();
      events.status(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(connectivity.backendUnavailable()).toBe(false);
      events.onerror?.();
      expect(connectivity.backendUnavailable()).toBe(true);
      events.status(true);
      await vi.advanceTimersByTimeAsync(45001);
      expect(events.close).toHaveBeenCalledOnce();
      expect(FakeEventSource.instances).toHaveLength(2);
      expect(connectivity.backendUnavailable()).toBe(true);
      expect(fetchStatus).not.toHaveBeenCalled();
    } finally {
      window.dispatchEvent(new Event('pagehide'));
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

});
