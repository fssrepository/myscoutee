import { environment } from '../../../../environments/environment';
import { demoFailoverSeedWarmupNeeded, prepareDemoFailover } from './demo-failover';

describe('demo seed startup eligibility', () => {
  let previousDataSource: 'local' | 'http';

  beforeEach(async () => {
    previousDataSource = environment.activitiesDataSource;
    environment.activitiesDataSource = 'http';
    localStorage.clear();
    await prepareDemoFailover();
  });

  afterEach(() => {
    environment.activitiesDataSource = previousDataSource;
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
