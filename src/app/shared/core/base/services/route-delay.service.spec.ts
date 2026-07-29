import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../../environments/environment';
import type { AppSession } from './session.service';
import { SessionService } from './session.service';
import { RouteDelayService } from './route-delay.service';

describe('RouteDelayService', () => {
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

  it('keeps the original HTTP-build rule even for a demo session', () => {
    environment.activitiesDataSource = 'http';
    environment.firebaseLoginEnabled = true;
    currentSession = { kind: 'demo', userId: 'operator-demo-dev' };

    const service = TestBed.inject(RouteDelayService);

    expect(service.resolveDelayMs('/operator/registry/inspect')).toBe(0);
  });

  it('uses configured local delay regardless of the authentication provider', () => {
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

    const service = TestBed.inject(RouteDelayService);

    expect(service.resolveDelayMs('/operator/registry/inspect')).toBe(650);
  });
});
