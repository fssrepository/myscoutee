import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';

import { DeploymentConfigurationService } from '../base/services/deployment-configuration.service';

export const PAYMENT_PROVIDER_RESPONSE_HEADER = 'X-MyScoutee-Payment-Provider';

export const paymentProviderSyncInterceptor: HttpInterceptorFn = (req, next) => {
  const deploymentConfiguration = inject(DeploymentConfigurationService);
  return next(req).pipe(
    tap(event => {
      if (!(event instanceof HttpResponse)) {
        return;
      }
      const provider = event.headers.get(PAYMENT_PROVIDER_RESPONSE_HEADER);
      if (provider === null) {
        return;
      }
      deploymentConfiguration.applyPaymentProviderId(
        provider.trim().toLowerCase() === 'none' ? null : provider
      );
    })
  );
};
