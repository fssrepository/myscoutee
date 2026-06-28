import { HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { from, switchMap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SessionService } from '../base/services/session.service';
import { DEMO_SESSION_HEADER, DEMO_SESSION_VALUE } from './session-mode.interceptor';

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

export const firebaseAuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.firebaseLoginEnabled || req.headers.has('Authorization') || !isApiRequest(req.url)) {
    return next(req);
  }

  const sessionService = inject(SessionService);
  if (sessionService.currentSession()?.kind === 'demo'
    || req.headers.get(DEMO_SESSION_HEADER)?.toLowerCase() === DEMO_SESSION_VALUE) {
    return next(req);
  }

  const injector = inject(Injector);
  return from(loadFirebaseIdToken(injector)).pipe(
    switchMap(token => {
      if (!token) {
        return next(req);
      }
      return next(
        req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        })
      );
    })
  );
};

async function loadFirebaseIdToken(injector: Injector): Promise<string | null> {
  const { FirebaseAuthService } = await import('../base/services/firebase-auth.service');
  return injector.get(FirebaseAuthService).getIdToken();
}
