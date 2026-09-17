import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { SessionService } from '../base/services/session.service';

export const DEMO_SESSION_HEADER = 'X-App-Session-Kind';
export const DEMO_SESSION_VALUE = 'demo';
export const DEMO_USER_HEADER = 'X-Demo-User-Id';
export const APP_SESSION_ID_HEADER = 'X-App-Session-Id';

const apiBaseUrl = (environment.apiBaseUrl ?? '/api').trim() || '/api';

function isApiRequest(url: string): boolean {
  if (url.startsWith(apiBaseUrl)) {
    return true;
  }
  if (typeof document === 'undefined') {
    return false;
  }
  const absoluteApiBaseUrl = new URL(apiBaseUrl, document.baseURI).toString();
  return url.startsWith(absoluteApiBaseUrl);
}

function isDemoSelectorRequest(url: string): boolean {
  if (!isApiRequest(url)) {
    return false;
  }
  return url.includes('/auth/demo-users');
}

function isOperatorBootstrapLoginRequest(url: string): boolean {
  if (!isApiRequest(url)) {
    return false;
  }
  const normalizedApiBase = apiBaseUrl.replace(/\/+$/, '');
  if (url === `${normalizedApiBase}/auth/operator-bootstrap`) {
    return true;
  }
  if (typeof document === 'undefined') {
    return false;
  }
  const absoluteApiBaseUrl = new URL(
    normalizedApiBase,
    document.baseURI
  ).toString().replace(/\/+$/, '');
  return url === `${absoluteApiBaseUrl}/auth/operator-bootstrap`;
}

function isDemoRegistrationRequest(req: HttpRequest<unknown>): boolean {
  if (req.method !== 'POST') {
    return false;
  }
  const route = req.url.split(/[?#]/, 1)[0];
  let ownerId: unknown;
  if (route.endsWith('/media/images') && req.body instanceof FormData) {
    ownerId = req.body.get('ownerId');
  } else if (route.endsWith('/auth/me/profile-ext')) {
    ownerId = (req.body as { profile?: { id?: unknown } } | null)?.profile?.id;
  }
  // A draft has no session yet. Route its writes to the same demo store as
  // the session created after onboarding; never turn it into a real identity.
  return typeof ownerId === 'string' && ownerId.startsWith('demo-profile-');
}

export const sessionModeInterceptor: HttpInterceptorFn = (req, next) => {
  if (
    !isApiRequest(req.url)
    || req.headers.has(DEMO_SESSION_HEADER)
    || isOperatorBootstrapLoginRequest(req.url)
  ) {
    return next(req);
  }

  const sessionService = inject(SessionService);
  const session = sessionService.currentSession();
  const isDemoRequest = session?.kind === 'demo'
    || isDemoSelectorRequest(req.url)
    // Explore registration is also available on Firebase-enabled deployments.
    || (!session && isDemoRegistrationRequest(req));
  if (!isDemoRequest) {
    return next(req);
  }

  const demoUserId = session?.kind === 'demo' ? session.userId.trim() : '';
  return next(req.clone({
    setHeaders: {
      [DEMO_SESSION_HEADER]: DEMO_SESSION_VALUE,
      ...(demoUserId ? { [DEMO_USER_HEADER]: demoUserId } : {}),
      ...(session?.kind === 'demo' && session.sessionId
        ? { [APP_SESSION_ID_HEADER]: session.sessionId }
        : {})
    }
  }));
};
