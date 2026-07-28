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

  it('keeps artificial delay on an explicitly local Explore route in an HTTP build', () => {
    environment.activitiesDataSource = 'http';
    environment.firebaseLoginEnabled = true;
    currentSession = { kind: 'demo', userId: 'operator-demo-dev' };

    const service = TestBed.inject(RouteDelayService);

    expect(service.resolveDelayMs('/operator/registry/inspect')).toBe(0);
    expect(service.resolveDelayMs('/operator/registry/inspect', 0, true)).toBe(650);
  });
});
