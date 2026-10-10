import { isAdminRequest } from './api-request';
import {
  HttpErrorResponse,
  HttpInterceptorFn
} from '@angular/common/http';
import {
  inject
} from '@angular/core';
import {
  Router
} from '@angular/router';
import {
  catchError,
  throwError
} from 'rxjs';
import {
  SessionService
} from '../../base/services/session.service';
import {
  APP_STORAGE_KEYS
} from '../../common/storage-scope';
import { UserProfileStore } from '../../../ui/context/stores/profile/user-profile.store';

const ADMIN_SESSION_STORAGE_KEY = APP_STORAGE_KEYS.adminSession;

export const adminAccessInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const sessionService = inject(SessionService);
  const userProfileStore = inject(UserProfileStore);

  return next(req).pipe(
    catchError(error => {
      if (isAdminRequest(req.url) && error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        const session = sessionService.currentSession();
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
        }
        userProfileStore.setActiveUserId(
          session?.kind === 'firebase' ? session.profile.id.trim() : ''
        );
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
