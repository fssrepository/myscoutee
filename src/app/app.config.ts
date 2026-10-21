import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, ErrorHandler, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { I18nService } from './shared/core/base/services/localization/i18n.service';
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
import { environment } from '../environments/environment';
import { ROUTE_CONFIG } from './shared/core/base/config';
import { preloadAdapterMode, type AdapterMode } from './shared/core/base/adapter-loaders';

export const appConfig: ApplicationConfig = {
  providers: [
    ...MYSCOUTEE_UI_PROVIDERS,
    provideAppInitializer(() => inject(I18nService).initialize()),
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

export async function loadAppConfig(): Promise<ApplicationConfig> {
  const modes = new Set<AdapterMode>([environment.activitiesDataSource]);
  for (const entry of ROUTE_CONFIG.entries) {
    if (entry.mode) modes.add(entry.mode);
    else if (entry.http) modes.add('http');
  }
  await Promise.all([...modes].map(mode => preloadAdapterMode(mode)));
  return appConfig;
}
