import { sessionAuthInterceptor } from './shared/core/http/interceptors/accounts/session-auth.interceptor';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { ApplicationConfig, ErrorHandler, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { I18nService } from './shared/core/base/services/localization/i18n.service';
import { LandingContentService } from './shared/core/base/services/content/landing-content.service';
import { SessionService } from './shared/core/base/services/accounts/session.service';
import { DeploymentConfigurationService } from './shared/core/base/services/platform/deployment-configuration.service';
import { LazyBgImageDirective } from '@fssrepository/myscoutee-components';
import { anonymousLanding, isLandingPage } from './shared/core/common/demo-failover';
import { LandingDebugErrorHandler } from './shared/core/common/landing-debug';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { MYSCOUTEE_UI_PROVIDERS } from './shared/ui/context/ui.providers';
import { paymentProviderSyncInterceptor } from './shared/core/http/interceptors/payments/payment-provider-sync.interceptor';
import { sessionModeInterceptor } from './shared/core/http/interceptors/accounts/session-mode.interceptor';
import { connectivityInterceptor } from './shared/core/http/interceptors/platform/connectivity.interceptor';
import { environment } from '../environments/environment';
import { ROUTE_CONFIG } from './shared/core/base/config';
import { preloadAdapterMode, type AdapterMode } from './shared/core/base/adapter-loaders';

export const appConfig: ApplicationConfig = {
  providers: [
    ...MYSCOUTEE_UI_PROVIDERS,
    provideAppInitializer(initializeApplication),
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: LandingDebugErrorHandler },
    provideRouter(routes),
    provideHttpClient(withXhr(), withInterceptors([
      connectivityInterceptor,
      sessionModeInterceptor,
      sessionAuthInterceptor,
      paymentProviderSyncInterceptor
    ]))
  ]
};

export function initializeApplication(): Promise<void> {
  const translations = inject(I18nService).initialize();
  void inject(DeploymentConfigurationService).initialize().catch(() => {
    // The root component observes the same load and reports initialization errors.
  });
  if (environment.activitiesDataSource === 'http'
    && isLandingPage()
    && !inject(SessionService).currentSession()) {
    // Reuse the landing's pending request/cache while translations are loading.
    // Rendering still waits for the selected language; no state is applied here.
    void inject(LandingContentService).loadOnce().then(state =>
      LazyBgImageDirective.preloadImageUrl(state.slides?.[0]?.imageUrl, { fetchPriority: 'high' })
    ).catch(() => {
      // The routed landing retries a failed request and displays its normal error.
    });
  }
  return Promise.all([translations, inject(SessionService).ensureSession()]).then(() => undefined);
}

export async function loadAppConfig(): Promise<ApplicationConfig> {
  const modes = new Set<AdapterMode>([environment.activitiesDataSource]);
  for (const entry of ROUTE_CONFIG.entries) {
    if (entry.mode) modes.add(entry.mode);
    else if (entry.http) modes.add('http');
  }
  const phase = environment.activitiesDataSource === 'http' && anonymousLanding() ? 'entry' : 'workspace';
  await Promise.all([...modes].map(mode => preloadAdapterMode(mode, phase)));
  return appConfig;
}
