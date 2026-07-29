import {
  HttpErrorResponse,
  HttpInterceptorFn
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SessionService } from '../base/services/session.service';

const apiBaseUrl = (environment.apiBaseUrl ?? '/api').trim() || '/api';
const operatorBootstrapLoginPath = '/auth/operator-bootstrap';

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

function isOperatorBootstrapLoginRequest(url: string): boolean {
  const normalizedApiBase = apiBaseUrl.replace(/\/+$/, '');
  if (url === `${normalizedApiBase}${operatorBootstrapLoginPath}`) {
    return true;
  }
  if (typeof document === 'undefined') {
    return false;
  }
  const absoluteApiBaseUrl = new URL(
    normalizedApiBase,
    document.baseURI
  ).toString().replace(/\/+$/, '');
  return url === `${absoluteApiBaseUrl}${operatorBootstrapLoginPath}`;
}

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
