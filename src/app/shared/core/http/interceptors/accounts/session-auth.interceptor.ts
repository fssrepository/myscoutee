import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionService } from '../../../base/services/accounts/session.service';
import { isApiRequest, isSessionLoginRequest } from '../platform/api-request';
import { APP_SESSION_ID_HEADER, DEMO_SESSION_HEADER } from './session-mode.interceptor';

export const sessionAuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url) || isSessionLoginRequest(req.url)) return next(req);
  const sessions = inject(SessionService);
  const router = inject(Router);
  const session = sessions.currentSession();
  const ownRequest = !req.headers.has('Authorization') && !req.headers.has(DEMO_SESSION_HEADER);
  const request = ownRequest && session?.kind === 'authenticated'
    ? req.clone({ setHeaders: { Authorization: `Bearer ${session.accessToken}`,
        [APP_SESSION_ID_HEADER]: session.sessionId } }) : req;
  const sessionId = request.headers.get(APP_SESSION_ID_HEADER);
  const authenticatesCurrentSession = !!sessionId && sessionId === session?.sessionId
    && (session?.kind === 'demo'
      || request.headers.get('Authorization') === `Bearer ${session?.accessToken}`);
  return next(request).pipe(catchError(error => {
    if (error instanceof HttpErrorResponse && error.status === 401
      && authenticatesCurrentSession && sessions.rejectSession(sessionId!)) {
      void router.navigate(['/entry']);
    }
    return throwError(() => error);
  }));
};
