import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { SessionService } from '../../../base/services/accounts/session.service';
import { sessionAuthInterceptor } from './session-auth.interceptor';

describe('sessionAuthInterceptor', () => {
  const session = { kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', sessionId: 'session', profile: { id: 'account' } };
  const rejectSession = vi.fn();
  const navigate = vi.fn();
  beforeEach(() => {
    rejectSession.mockReset().mockReturnValue(true); navigate.mockReset();
    TestBed.configureTestingModule({ providers: [
      { provide: SessionService, useValue: { currentSession: () => session, rejectSession } },
      { provide: Router, useValue: { navigate, events: of(), url: '/entry' } }
    ] });
  });
  afterEach(() => TestBed.resetTestingModule());
  const intercept = (request: HttpRequest<unknown>, status = 200) => firstValueFrom(TestBed.runInInjectionContext(() =>
    sessionAuthInterceptor(request, next => status === 200 ? of(new HttpResponse({ body: next.headers }))
      : throwError(() => new HttpErrorResponse({ status })))));
  it('attaches the common credential and tracked session ID to protected API requests', async () => {
    const response = await intercept(new HttpRequest('GET', '/api/auth/me')) as HttpResponse<any>;
    expect(response.body.get('Authorization')).toBe('Bearer app-token');
    expect(response.body.get('X-App-Session-Id')).toBe('session');
  });
  it.each(['/api/auth/session/login', '/api-external/auth/me', 'https://external.example.test/api/auth/me'])('leaves login proofs and external requests unchanged (%s)', async url => {
    const response = await intercept(new HttpRequest('GET', url)) as HttpResponse<any>;
    expect(response.body.has('Authorization')).toBe(false);
  });
  it('preserves an explicit credential', async () => {
    const response = await intercept(new HttpRequest('GET', '/api/admin/probe').clone({ setHeaders: { Authorization: 'Bearer explicit' } })) as HttpResponse<any>;
    expect(response.body.get('Authorization')).toBe('Bearer explicit');
  });
  it.each(['/api/auth/me', '/api/admin/probe', '/api/operator/probe'])('rejects the same session on 401 for every area (%s)', async url => {
    await expect(intercept(new HttpRequest('GET', url), 401)).rejects.toHaveProperty('status', 401);
    expect(rejectSession).toHaveBeenCalledWith('session'); expect(navigate).toHaveBeenCalledWith(['/entry']);
  });
  it('propagates 403 without removing the valid session', async () => {
    await expect(intercept(new HttpRequest('GET', '/api/admin/probe'), 403)).rejects.toHaveProperty('status', 403);
    expect(rejectSession).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
  });
  it('does not redirect when a late response belongs to an older session', async () => {
    rejectSession.mockReturnValue(false);
    await expect(intercept(new HttpRequest('GET', '/api/auth/me'), 401)).rejects.toHaveProperty('status', 401);
    expect(navigate).not.toHaveBeenCalled();
  });
});
