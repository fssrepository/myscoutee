import {
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SessionService } from '../base/services/session.service';
import { firebaseAuthInterceptor } from './firebase-auth.interceptor';

describe('firebaseAuthInterceptor bootstrap isolation', () => {
  const originalFirebaseLoginEnabled = environment.firebaseLoginEnabled;
  const getFirebaseIdToken = vi.fn();

  beforeEach(() => {
    environment.firebaseLoginEnabled = true;
    getFirebaseIdToken.mockReset().mockResolvedValue('firebase-token');
    TestBed.configureTestingModule({
      providers: [{
        provide: SessionService,
        useValue: {
          currentSession: () => ({
            kind: 'firebase',
            profile: {
              id: 'firebase-user',
              name: 'Firebase User',
              email: 'firebase@example.test',
              initials: 'FU'
            }
          }),
          getFirebaseIdToken
        }
      }]
    });
  });

  afterEach(() => {
    environment.firebaseLoginEnabled = originalFirebaseLoginEnabled;
    TestBed.resetTestingModule();
  });

  it('does not attach a stale Firebase token to operator bootstrap login', async () => {
    const response = await interceptAuthorization(
      new HttpRequest('POST', '/api/auth/operator-bootstrap', {})
    );

    expect(response.body).toBeNull();
    expect(getFirebaseIdToken).not.toHaveBeenCalled();
  });

  it('continues attaching Firebase tokens to normal API requests', async () => {
    const response = await interceptAuthorization(
      new HttpRequest('GET', '/api/auth/me')
    );

    expect(response.body).toBe('Bearer firebase-token');
    expect(getFirebaseIdToken).toHaveBeenCalledOnce();
  });
});

function interceptAuthorization(
  request: HttpRequest<unknown>
): Promise<HttpResponse<string | null>> {
  return firstValueFrom(TestBed.runInInjectionContext(() =>
    firebaseAuthInterceptor(
      request,
      nextRequest => of(new HttpResponse({
        status: 200,
        body: nextRequest.headers.get('Authorization')
      }))
    )
  )) as Promise<HttpResponse<string | null>>;
}
