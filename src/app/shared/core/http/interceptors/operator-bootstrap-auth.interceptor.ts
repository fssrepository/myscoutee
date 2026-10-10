import { isApiRequest, isOperatorBootstrapLoginRequest } from './api-request';
import {
  HttpErrorResponse,
  HttpInterceptorFn
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SessionService } from '../../base/services/session.service';

export const operatorBootstrapAuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (
    req.headers.has('Authorization')
    || !isApiRequest(req.url)
    || isOperatorBootstrapLoginRequest(req.url)
  ) {
    return next(req);
  }

  const sessionService = inject(SessionService);
  if (sessionService.currentSession()?.kind !== 'operator-bootstrap') {
    return next(req);
  }
  const token = sessionService.getOperatorBootstrapToken();
  if (!token) {
    return next(req);
  }

  return next(req.clone({
    setHeaders: {
      Authorization: `OperatorBootstrap ${token}`
    }
  })).pipe(
    catchError(error => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        sessionService.clearOperatorBootstrapSession();
      }
      return throwError(() => error);
    })
  );
};
