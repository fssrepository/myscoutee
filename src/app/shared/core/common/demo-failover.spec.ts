import { environment } from '../../../../environments/environment';
import { demoFailoverSeedWarmupNeeded, prepareDemoFailover } from './demo-failover';

describe('demo seed startup eligibility', () => {
  let previousDataSource: 'local' | 'http';
  let previousEnvironment: typeof environment;

  beforeEach(async () => {
    previousDataSource = environment.activitiesDataSource;
    previousEnvironment = { ...environment };
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      ready: true, checkedAt: Math.floor(Date.now() / 1000)
    }))));
    environment.activitiesDataSource = 'http';
    localStorage.clear();
    const snapshot = document.createElement('script');
    snapshot.id = 'myscoutee-runtime-status';
    snapshot.type = 'application/json';
    snapshot.textContent = JSON.stringify({ ready: true, checkedAt: Math.floor(Date.now() / 1000) });
    document.head.append(snapshot);
    await prepareDemoFailover();
  });

  afterEach(() => {
    environment.activitiesDataSource = previousDataSource;
    Object.assign(environment, previousEnvironment);
    vi.unstubAllGlobals();
    document.getElementById('myscoutee-runtime-status')?.remove();
    localStorage.clear();
  });

  it('does not evaluate demo builders for an anonymous startup', () => {
    expect(demoFailoverSeedWarmupNeeded()).toBe(false);
  });

  it.each(['firebase', 'operator-bootstrap'])('does not warm synthetic data for a %s session', kind => {
    localStorage.setItem('myscoutee.http.session.v1', JSON.stringify({ kind, userId: 'real-user' }));
    expect(demoFailoverSeedWarmupNeeded()).toBe(false);
  });

  it('preserves online prewarming for an eligible demo session', () => {
    localStorage.setItem('myscoutee.http.session.v1', JSON.stringify({ kind: 'demo', userId: 'demo-user' }));
    expect(demoFailoverSeedWarmupNeeded()).toBe(true);
  });

  it('does not prewarm local replacement data for a support session', () => {
    localStorage.setItem('myscoutee.http.session.v1', JSON.stringify({
      kind: 'demo', userId: 'demo-user', supportContext: { id: 'support-session' }
    }));
    expect(demoFailoverSeedWarmupNeeded()).toBe(false);
  });
});
