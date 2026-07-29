import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../../environments/environment';
import { environment as devEnvironment } from '../../../../../environments/environment.dev';
import { environment as e2eEnvironment } from '../../../../../environments/environment.e2e';
import { environment as githubEnvironment } from '../../../../../environments/environment.github';
import { environment as productionEnvironment } from '../../../../../environments/environment.production';
import type { AppSession } from './session.service';
import { SessionService } from './session.service';
import {
  BaseRouteModeService,
  resolveDataSourceRouteMode
} from './base-route-mode.service';

class TestRouteModeService extends BaseRouteModeService {
  resolve(route: string): 'local' | 'http' {
    return this.resolveRouteService(route, 'local' as const, 'http' as const);
  }

  resolveWithMode(route: string, mode: 'local' | 'http' | null): 'local' | 'http' {
    return this.resolveRouteService(route, 'local' as const, 'http' as const, { mode });
  }
}

describe('BaseRouteModeService', () => {
  const originalActivitiesDataSource = environment.activitiesDataSource;
  const originalFirebaseLoginEnabled = environment.firebaseLoginEnabled;
  let currentSession: AppSession | null;

  beforeEach(() => {
    currentSession = null;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SessionService,
          useValue: {
            currentSession: () => currentSession
          }
        }
      ]
    });
  });

  afterEach(() => {
    environment.activitiesDataSource = originalActivitiesDataSource;
    environment.firebaseLoginEnabled = originalFirebaseLoginEnabled;
    TestBed.resetTestingModule();
  });

  it('keeps demo-session traffic on HTTP routes when the app is built for HTTP', () => {
    environment.activitiesDataSource = 'http';
    environment.firebaseLoginEnabled = false;
    currentSession = { kind: 'demo', userId: 'demo-user' };

    const service = createService();

    expect(service.resolve('/privacy/active')).toBe('http');
    expect(service.resolve('/privacy/consents')).toBe('http');
  });

  it('uses local storage only when the app is explicitly built for local data', () => {
    environment.activitiesDataSource = 'local';
    environment.firebaseLoginEnabled = true;
    currentSession = {
      kind: 'firebase',
      profile: {
        id: 'real-user',
        name: 'Real User',
        email: 'real@example.com',
        initials: 'RU'
      }
    };

    const service = createService();

    expect(service.resolve('/privacy/consents')).toBe('local');
  });

  it('keeps dev, e2e, and production HTTP while local and GitHub remain explicit offline builds', () => {
    expect([
      devEnvironment.activitiesDataSource,
      e2eEnvironment.activitiesDataSource,
      productionEnvironment.activitiesDataSource
    ].map(resolveDataSourceRouteMode)).toEqual(['http', 'http', 'http']);
    expect([
      environment.activitiesDataSource,
      githubEnvironment.activitiesDataSource
    ].map(resolveDataSourceRouteMode)).toEqual(['local', 'local']);
  });

  it('uses requested local or HTTP mode when provided by the caller', () => {
    environment.activitiesDataSource = 'http';
    environment.firebaseLoginEnabled = true;
    currentSession = {
      kind: 'firebase',
      profile: {
        id: 'real-user',
        name: 'Real User',
        email: 'real@example.com',
        initials: 'RU'
      }
    };

    const service = createService();

    expect(service.resolveWithMode('/auth/me/experiences', 'local')).toBe('local');
    expect(service.resolveWithMode('/auth/me/experiences', 'http')).toBe('http');
  });
});

function createService(): TestRouteModeService {
  return TestBed.runInInjectionContext(() => new TestRouteModeService());
}
