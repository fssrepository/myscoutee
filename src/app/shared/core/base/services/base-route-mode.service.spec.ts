import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../../environments/environment';
import type { AppSession } from './session.service';
import { SessionService } from './session.service';
import { BaseRouteModeService } from './base-route-mode.service';

class TestRouteModeService extends BaseRouteModeService {
  resolve(route: string): 'local' | 'http' {
    return this.resolveRouteService(route, 'local' as const, 'http' as const);
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

  it('uses local storage for selector sessions when the app is built for local data', () => {
    environment.activitiesDataSource = 'local';
    environment.firebaseLoginEnabled = false;
    currentSession = { kind: 'demo', userId: 'demo-user' };

    const service = createService();

    expect(service.resolve('/privacy/consents')).toBe('local');
  });
});

function createService(): TestRouteModeService {
  return TestBed.runInInjectionContext(() => new TestRouteModeService());
}
