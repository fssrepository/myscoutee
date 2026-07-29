import {
  HttpErrorResponse,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { SessionService, type AppSession } from '../base/services/session.service';
import { operatorBootstrapAuthInterceptor } from './operator-bootstrap-auth.interceptor';

describe('operatorBootstrapAuthInterceptor', () => {
  const getOperatorBootstrapToken = vi.fn();
  const clearOperatorBootstrapSession = vi.fn();
  let currentSession: AppSession | null;

  beforeEach(() => {
    currentSession = {
      kind: 'operator-bootstrap',
      email: 'operator@example.test',
      expiresAt: '2099-07-29T12:00:00Z'
    };
    getOperatorBootstrapToken.mockReset().mockReturnValue('signed-token');
    clearOperatorBootstrapSession.mockReset();
    TestBed.configureTestingModule({
      providers: [{
        provide: SessionService,
        useValue: {
          currentSession: () => currentSession,
          getOperatorBootstrapToken,
          clearOperatorBootstrapSession
        }
      }]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('attaches the dedicated authorization scheme to API requests', async () => {
    const next = vi.fn(request => of(new HttpResponse({
      status: 200,
      body: request.headers.get('Authorization')
    })));
    const response = await firstValueFrom(TestBed.runInInjectionContext(() =>
      operatorBootstrapAuthInterceptor(
        new HttpRequest('GET', '/api/auth/me'),
        next
      )
    )) as HttpResponse<string>;

    expect(response.body).toBe('OperatorBootstrap signed-token');
  });

  it('never attaches a stale token to the bootstrap login request', async () => {
    const next = vi.fn(request => of(new HttpResponse({
      status: 200,
      body: request.headers.get('Authorization')
    })));
    const response = await firstValueFrom(TestBed.runInInjectionContext(() =>
      operatorBootstrapAuthInterceptor(
        new HttpRequest('POST', '/api/auth/operator-bootstrap', {}),
        next
      )
    )) as HttpResponse<string | null>;

    expect(response.body).toBeNull();
    expect(getOperatorBootstrapToken).not.toHaveBeenCalled();
  });

  it('clears the bootstrap session when a protected API rejects its token', async () => {
    const next = vi.fn(() => throwError(() => new HttpErrorResponse({
      status: 401
    })));

    await expect(firstValueFrom(TestBed.runInInjectionContext(() =>
      operatorBootstrapAuthInterceptor(
        new HttpRequest('GET', '/api/auth/me'),
        next
      )
    ))).rejects.toMatchObject({ status: 401 });

    expect(clearOperatorBootstrapSession).toHaveBeenCalledOnce();
  });
});
