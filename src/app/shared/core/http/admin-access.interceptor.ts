import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AppContext } from '../base/context';
import { SessionService } from '../base/services/session.service';
import { scopedStorageKey } from '../base/storage-scope';

const ADMIN_SESSION_STORAGE_KEY = scopedStorageKey('admin.session.v1');
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
  const appCtx = inject(AppContext);
  const sessionService = inject(SessionService);

  return next(req).pipe(
    catchError(error => {
      if (isAdminRequest(req.url) && error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        const session = sessionService.currentSession();
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
        }
        if (session?.kind === 'firebase') {
          appCtx.setActiveUserId(session.profile.id.trim());
        } else {
          appCtx.setActiveUserId('');
        }
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
