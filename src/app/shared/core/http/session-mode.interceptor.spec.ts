import {
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import { SessionService } from '../base/services/session.service';
import {
  DEMO_SESSION_HEADER,
  DEMO_SESSION_VALUE,
  sessionModeInterceptor
} from './session-mode.interceptor';

describe('sessionModeInterceptor bootstrap isolation', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{
        provide: SessionService,
        useValue: {
          currentSession: () => ({
            kind: 'demo',
            userId: 'operator-demo'
          })
        }
      }]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('does not mark a fresh operator bootstrap login as a demo request', async () => {
    const response = await interceptHeader(
      new HttpRequest('POST', '/api/auth/operator-bootstrap', {})
    );

    expect(response.body).toBeNull();
  });

  it('continues marking normal API calls made by a demo session', async () => {
    const response = await interceptHeader(
      new HttpRequest('GET', '/api/auth/me')
    );

    expect(response.body).toBe(DEMO_SESSION_VALUE);
  });
});

function interceptHeader(
  request: HttpRequest<unknown>
): Promise<HttpResponse<string | null>> {
  return firstValueFrom(TestBed.runInInjectionContext(() =>
    sessionModeInterceptor(
      request,
      nextRequest => of(new HttpResponse({
        status: 200,
        body: nextRequest.headers.get(DEMO_SESSION_HEADER)
      }))
    )
  )) as Promise<HttpResponse<string | null>>;
}
