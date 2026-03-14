import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SessionService } from '../services/session.service';

export const restrictedAreaGuard: CanActivateFn = async (_route, state) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);
  const session = await sessionService.ensureSession();
  if (session) {
    return true;
  }
  return router.createUrlTree(['/entry'], {
    queryParams: state.url && state.url !== '/' ? { redirect: state.url } : undefined
  });
};
