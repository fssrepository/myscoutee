import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { firebaseAuthInterceptor } from './shared/core/http/firebase-auth.interceptor';
import { sessionModeInterceptor } from './shared/core/http/session-mode.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([sessionModeInterceptor, firebaseAuthInterceptor]))
  ]
};
