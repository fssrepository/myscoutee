import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { ProfileOnboardingService } from '../services/profile-onboarding.service';
import { SessionService } from '../services/session.service';
import { UsersService } from '../services/users.service';

export const restrictedAreaGuard: CanActivateFn = async (_route, state) => {
  const sessionService = inject(SessionService);
  const onboardingService = inject(ProfileOnboardingService);
  const usersService = inject(UsersService);
  const router = inject(Router);
  const session = await sessionService.ensureSession();
  if (session) {
    if (session.kind === 'firebase') {
      const user = await usersService.loadUserById(undefined, 8000).catch(() => null);
      if (onboardingService.shouldPrompt(user)) {
        return router.createUrlTree(['/entry'], {
          queryParams: {
            redirect: state.url && state.url !== '/' ? state.url : '/game',
            onboarding: '1'
          }
        });
      }
    }
    return true;
  }
  return router.createUrlTree(['/entry'], {
    queryParams: state.url && state.url !== '/' ? { redirect: state.url } : undefined
  });
};
