import { resolveRouteConfig } from '../config';
import { resolveOperatorRegistryRouteMode } from './operator-registry.service';

describe('resolveOperatorRegistryRouteMode', () => {
  it('keeps a production Explore session on the browser-local sample', () => {
    expect(resolveOperatorRegistryRouteMode('session', 'demo')).toBe('local');
  });

  it('routes a Firebase operator session through Java', () => {
    expect(resolveOperatorRegistryRouteMode('session', 'firebase')).toBe('http');
  });

  it('keeps a development demo session on Java when HTTP is explicit', () => {
    expect(resolveOperatorRegistryRouteMode('http', 'demo')).toBe('http');
  });

  it('keeps a local build local regardless of session kind', () => {
    expect(resolveOperatorRegistryRouteMode('local', 'firebase')).toBe('local');
  });

  it('uses the centralized 30 second timeout for Java registry operations', () => {
    expect(resolveRouteConfig('/operator/registry/confirm').requestTimeoutMs).toBe(30_000);
    expect(resolveRouteConfig('/operator/registry').demoDelayMs).toBe(1500);
    expect(resolveRouteConfig('/operator/leaderboard').demoDelayMs).toBe(1500);
    expect(resolveRouteConfig('/operator/revenue').requestTimeoutMs).toBe(30_000);
  });
});
