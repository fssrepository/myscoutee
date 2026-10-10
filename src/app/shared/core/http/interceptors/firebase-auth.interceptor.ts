import { isApiRequest, isOperatorBootstrapLoginRequest } from './api-request';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { SessionService } from '../../base/services/session.service';
import { DEMO_SESSION_HEADER, DEMO_SESSION_VALUE } from './session-mode.interceptor';
import { FirebaseSessionRegistryService } from '../services/firebase-session-registry.service';
import { isFirebaseLoginEnabled } from '../../common/firebase-login-mode';

export const firebaseAuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (
    !isFirebaseLoginEnabled()
    || req.headers.has('Authorization')
    || !isApiRequest(req.url)
    || isOperatorBootstrapLoginRequest(req.url)
  ) {
    return next(req);
  }

  const sessionService = inject(SessionService);
  const session = sessionService.currentSession();
  if (session?.kind !== 'firebase'
    || req.headers.get(DEMO_SESSION_HEADER)?.toLowerCase() === DEMO_SESSION_VALUE) {
    return next(req);
  }

  return from(sessionService.getFirebaseIdToken()).pipe(
    switchMap(token => {
      if (!token) {
        return next(req);
      }
      return next(
        req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
            [FirebaseSessionRegistryService.SESSION_ID_HEADER]: session.sessionId
          }
        })
      );
    })
  );
};
