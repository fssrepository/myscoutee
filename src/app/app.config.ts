import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { LandingDebugErrorHandler } from './shared/core/common/landing-debug';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { MYSCOUTEE_UI_PROVIDERS } from './shared/ui/context/ui.providers';
import { adminAccessInterceptor } from './shared/core/http/interceptors/access/admin-access.interceptor';
import { firebaseAuthInterceptor } from './shared/core/http/interceptors/accounts/firebase-auth.interceptor';
import { operatorBootstrapAuthInterceptor } from './shared/core/http/interceptors/operator/operator-bootstrap-auth.interceptor';
import { paymentProviderSyncInterceptor } from './shared/core/http/interceptors/payments/payment-provider-sync.interceptor';
import { sessionModeInterceptor } from './shared/core/http/interceptors/accounts/session-mode.interceptor';
import { connectivityInterceptor } from './shared/core/http/interceptors/platform/connectivity.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    ...MYSCOUTEE_UI_PROVIDERS,
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: LandingDebugErrorHandler },
    provideRouter(routes),
    provideHttpClient(withInterceptors([
      connectivityInterceptor,
      sessionModeInterceptor,
      operatorBootstrapAuthInterceptor,
      firebaseAuthInterceptor,
      adminAccessInterceptor,
      paymentProviderSyncInterceptor
    ]))
  ]
};
