import { environment as devEnvironment } from '../../../../../environments/environment.dev';
import { environment as e2eEnvironment } from '../../../../../environments/environment.e2e';
import { environment as githubEnvironment } from '../../../../../environments/environment.github';
import { environment as localEnvironment } from '../../../../../environments/environment';
import { environment as productionEnvironment } from '../../../../../environments/environment.production';
import { resolveRouteConfig } from '../config';
import { resolveOperatorRegistryRouteMode } from './operator-registry.service';

describe('resolveOperatorRegistryRouteMode', () => {
  it('routes a production Explore session through the isolated Java demo path', () => {
    expect(resolveOperatorRegistryRouteMode('session')).toBe('http');
  });

  it('routes a Firebase operator session through Java', () => {
    expect(resolveOperatorRegistryRouteMode('session')).toBe('http');
  });

  it('keeps a development demo session on Java when HTTP is explicit', () => {
    expect(resolveOperatorRegistryRouteMode('http')).toBe('http');
  });

  it('keeps a local build local regardless of session kind', () => {
    expect(resolveOperatorRegistryRouteMode('local')).toBe('local');
  });

  it('keeps the build matrix backend-connected except for explicit local and GitHub builds', () => {
    expect([
      devEnvironment.operatorRegistryDataSource,
      e2eEnvironment.operatorRegistryDataSource,
      productionEnvironment.operatorRegistryDataSource
    ].map(dataSource => resolveOperatorRegistryRouteMode(dataSource)))
      .toEqual(['http', 'http', 'http']);
    expect([
      localEnvironment.operatorRegistryDataSource,
      githubEnvironment.operatorRegistryDataSource
    ].map(dataSource => resolveOperatorRegistryRouteMode(dataSource)))
      .toEqual(['local', 'local']);
  });

  it('uses the centralized 30 second timeout for Java registry operations', () => {
    expect(resolveRouteConfig('/operator/registry/confirm').requestTimeoutMs).toBe(30_000);
    expect(resolveRouteConfig('/operator/registry').demoDelayMs).toBe(1500);
    expect(resolveRouteConfig('/operator/leaderboard').demoDelayMs).toBe(1500);
    expect(resolveRouteConfig('/operator/revenue').requestTimeoutMs).toBe(30_000);
    expect(resolveRouteConfig('/operator/measurements').requestTimeoutMs).toBe(30_000);
  });
});
