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
  DEMO_USER_HEADER,
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

  it('sends the selected demo member on API posts', async () => {
    const response = await interceptHeader(
      new HttpRequest('POST', '/api/game-cards/query', {}),
      DEMO_USER_HEADER
    );

    expect(response.body).toBe('operator-demo');
  });
});

function interceptHeader(
  request: HttpRequest<unknown>,
  headerName = DEMO_SESSION_HEADER
): Promise<HttpResponse<string | null>> {
  return firstValueFrom(TestBed.runInInjectionContext(() =>
    sessionModeInterceptor(
      request,
      nextRequest => of(new HttpResponse({
        status: 200,
        body: nextRequest.headers.get(headerName)
      }))
    )
  )) as Promise<HttpResponse<string | null>>;
}
