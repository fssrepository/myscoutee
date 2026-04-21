import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { SessionService } from '../base/services/session.service';

export const DEMO_SESSION_HEADER = 'X-App-Session-Kind';
export const DEMO_SESSION_VALUE = 'demo';

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

export const sessionModeInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url) || req.headers.has(DEMO_SESSION_HEADER)) {
    return next(req);
  }

  const sessionService = inject(SessionService);
  const isDemoRequest = sessionService.currentSession()?.kind === 'demo'
    || isDemoSelectorRequest(req.url);
  if (!isDemoRequest) {
    return next(req);
  }

  return next(req.clone({
    setHeaders: {
      [DEMO_SESSION_HEADER]: DEMO_SESSION_VALUE
    }
  }));
};
