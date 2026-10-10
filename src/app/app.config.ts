import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { MYSCOUTEE_UI_PROVIDERS } from './shared/ui/context/ui.providers';
import { adminAccessInterceptor } from './shared/core/http/interceptors/admin-access.interceptor';
import { firebaseAuthInterceptor } from './shared/core/http/interceptors/firebase-auth.interceptor';
import { operatorBootstrapAuthInterceptor } from './shared/core/http/interceptors/operator-bootstrap-auth.interceptor';
import { paymentProviderSyncInterceptor } from './shared/core/http/interceptors/payment-provider-sync.interceptor';
import { sessionModeInterceptor } from './shared/core/http/interceptors/session-mode.interceptor';
import { connectivityInterceptor } from './shared/core/http/interceptors/connectivity.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    ...MYSCOUTEE_UI_PROVIDERS,
    provideBrowserGlobalErrorListeners(),
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
