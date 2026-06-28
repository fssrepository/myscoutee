import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SessionService } from '../base/services/session.service';
import { APP_STORAGE_KEYS } from '../common/storage-scope';

const ADMIN_SESSION_STORAGE_KEY = APP_STORAGE_KEYS.adminSession;
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

function isAdminRequest(url: string): boolean {
  if (!isApiRequest(url)) {
    return false;
  }
  const normalizedApiBase = apiBaseUrl.replace(/\/+$/, '');
  if (url.startsWith(`${normalizedApiBase}/admin/`)) {
    return true;
  }
  if (url === `${normalizedApiBase}/admin`) {
    return true;
  }
  if (typeof document === 'undefined') {
    return false;
  }
  const absoluteApiBaseUrl = new URL(normalizedApiBase, document.baseURI).toString().replace(/\/+$/, '');
  return url === `${absoluteApiBaseUrl}/admin` || url.startsWith(`${absoluteApiBaseUrl}/admin/`);
}

export const adminAccessInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const injector = inject(Injector);
  const sessionService = inject(SessionService);

  return next(req).pipe(
    catchError(error => {
      if (isAdminRequest(req.url) && error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        const session = sessionService.currentSession();
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
        }
        void import('../../ui/context/app.context')
          .then(module => {
            injector.get(module.AppContext).userProfileStore.setActiveUserId(
              session?.kind === 'firebase' ? session.profile.id.trim() : ''
            );
          });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('adminAccessDenied'));
        }
        if (router.url.split('?')[0].startsWith('/admin')) {
          void router.navigateByUrl('/admin', { replaceUrl: true });
        }
      }
      return throwError(() => error);
    })
  );
};
