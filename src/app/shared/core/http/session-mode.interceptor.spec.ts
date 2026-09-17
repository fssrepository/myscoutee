import {
  HttpHeaders,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import { SessionService } from '../base/services/session.service';
import {
  APP_SESSION_ID_HEADER,
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

  it('routes new Explore profile uploads to demo storage on Firebase deployments without logging in', async () => {
    session.authMode = 'firebase';
    const body = new FormData();
    body.append('ownerId', 'demo-profile-new-member');
    const request = new HttpRequest('POST', '/api/media/images', body);
    expect((await interceptHeader(request)).body).toBe(DEMO_SESSION_VALUE);
    expect((await interceptHeader(request, DEMO_USER_HEADER)).body).toBeNull();
    expect((await interceptHeader(request, APP_SESSION_ID_HEADER)).body).toBeNull();
  });

  it('keeps completed Explore registration in demo storage on Firebase deployments', async () => {
    session.authMode = 'firebase';
    const request = new HttpRequest('POST', '/api/auth/me/profile-ext', {
      profile: { id: 'demo-profile-new-member' }
    });
    expect((await interceptHeader(request)).body).toBe(DEMO_SESSION_VALUE);

    const realUpload = new FormData();
    realUpload.append('ownerId', 'real-member');
    expect((await interceptHeader(new HttpRequest('POST', '/api/media/images', realUpload))).body).toBeNull();
  });
});

describe('sessionModeInterceptor registration boundaries', () => {
  let activeSession: unknown = null;

  beforeEach(() => {
    activeSession = null;
    TestBed.configureTestingModule({
      providers: [{ provide: SessionService, useValue: {
        currentSession: () => activeSession,
        authMode: 'firebase'
      } }]
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  function draftImage(): FormData {
    const body = new FormData();
    body.append('ownerId', 'demo-profile-new-member');
    return body;
  }

  it.each(['firebase', 'operator-bootstrap'])('does not reroute an existing %s session, even for a demo-looking owner', async kind => {
    activeSession = { kind, profile: { id: 'real-member' }, sessionId: 'real-session' };
    for (const request of [
      new HttpRequest('POST', '/api/media/images', draftImage()),
      new HttpRequest('POST', '/api/auth/me/profile-ext', { profile: { id: 'demo-profile-new-member' } })
    ]) {
      expect((await interceptHeader(request)).body).toBeNull();
      expect((await interceptHeader(request, DEMO_USER_HEADER)).body).toBeNull();
    }
  });

  it('preserves the registered demo identity and session', async () => {
    activeSession = { kind: 'demo', userId: 'existing-demo-member', sessionId: 'existing-session' };
    const request = new HttpRequest('POST', '/api/media/images', draftImage());
    expect((await interceptHeader(request)).body).toBe('demo');
    expect((await interceptHeader(request, DEMO_USER_HEADER)).body).toBe('existing-demo-member');
    expect((await interceptHeader(request, APP_SESSION_ID_HEADER)).body).toBe('existing-session');
  });

  it.each([
    '/api/media/audio', '/api/media/images/import', '/api/auth/me/profile',
    '/api/auth/operator-bootstrap', '/api/admin/users', '/api/assets',
    'https://external.example/api/media/images'
  ])('does not mark other routes as anonymous registration: %s', async url => {
    expect((await interceptHeader(new HttpRequest('POST', url, draftImage()))).body).toBeNull();
  });

  it.each(['PUT', 'PATCH', 'DELETE'])('does not mark %s image requests as registration', async method => {
    expect((await interceptHeader(new HttpRequest(method, '/api/media/images', draftImage()))).body).toBeNull();
  });

  it.each([null, {}, { ownerId: 'demo-profile-new-member' }])('does not treat a non-multipart image body as a draft upload: %j', async body => {
    expect((await interceptHeader(new HttpRequest('POST', '/api/media/images', body))).body).toBeNull();
  });

  it.each([null, {}, { profile: null }, { profile: { id: 123 } }, { profile: { id: 'real-member' } }])('does not reroute missing or real profile identities: %j', async body => {
    expect((await interceptHeader(new HttpRequest('POST', '/api/auth/me/profile-ext', body))).body).toBeNull();
  });

  it('preserves an explicitly selected route and does not mutate the original request', async () => {
    const explicit = new HttpRequest('POST', '/api/media/images', draftImage(), {
      headers: new HttpHeaders({ [DEMO_SESSION_HEADER]: 'real' })
    });
    expect((await interceptHeader(explicit)).body).toBe('real');
    const draft = new HttpRequest('POST', '/api/media/images', draftImage());
    expect((await interceptHeader(draft)).body).toBe('demo');
    expect(draft.headers.has(DEMO_SESSION_HEADER)).toBe(false);
  });

  it.each([
    '/api/media/images?size=original',
    new URL('/api/media/images', document.baseURI).toString()
  ])('recognizes the same upload route with query or absolute URL: %s', async url => {
    expect((await interceptHeader(new HttpRequest('POST', url, draftImage()))).body).toBe('demo');
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
