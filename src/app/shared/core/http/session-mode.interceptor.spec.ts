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

describe('sessionModeInterceptor anonymous demo registration', () => {
  const session = { currentSession: () => null, authMode: 'selector' };

  beforeEach(() => {
    session.authMode = 'selector';
    TestBed.configureTestingModule({
      providers: [{ provide: SessionService, useValue: session }]
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('routes draft image uploads to demo storage without inventing a logged-in user', async () => {
    const body = new FormData();
    body.append('ownerId', 'demo-profile-new-member');
    const request = new HttpRequest('POST', '/api/media/images', body);
    expect((await interceptHeader(request)).body).toBe(DEMO_SESSION_VALUE);
    expect((await interceptHeader(request, DEMO_USER_HEADER)).body).toBeNull();
  });

  it('saves the completed draft in the demo database', async () => {
    const request = new HttpRequest('POST', '/api/auth/me/profile-ext', {
      profile: { id: 'demo-profile-new-member' }
    });
    expect((await interceptHeader(request)).body).toBe(DEMO_SESSION_VALUE);
  });

  it('keeps real-owner uploads and unrelated writes outside demo registration', async () => {
    const body = new FormData();
    body.append('ownerId', 'real-member');
    expect((await interceptHeader(new HttpRequest('POST', '/api/media/images', body))).body).toBeNull();
    expect((await interceptHeader(new HttpRequest('POST', '/api/admin/users', {
      profile: { id: 'demo-profile-new-member' }
    }))).body).toBeNull();
  });

  it('does not mark unauthenticated Firebase-mode uploads as demo', async () => {
    session.authMode = 'firebase';
    const body = new FormData();
    body.append('ownerId', 'demo-profile-new-member');
    expect((await interceptHeader(new HttpRequest('POST', '/api/media/images', body))).body).toBeNull();
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
