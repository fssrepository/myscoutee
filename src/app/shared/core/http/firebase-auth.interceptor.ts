import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { FirebaseAuthService } from '../base/services/firebase-auth.service';

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
  if (!environment.loginEnabled || req.headers.has('Authorization') || !isApiRequest(req.url)) {
    return next(req);
  }

  const firebaseAuthService = inject(FirebaseAuthService);
  return from(firebaseAuthService.getIdToken()).pipe(
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
