import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SessionService, UsersService } from '../shared/core';
import { AppUtils } from '../shared/app-utils';
import { CURRENT_PROFILE_FORM_VERSION } from '../shared/core/common/constants';
import type { UserDto } from '../shared/core/contracts/user.interface';

export const restrictedAreaGuard: CanActivateFn = async (_route, state) => {
  const sessionService = inject(SessionService);
  const usersService = inject(UsersService);
  const router = inject(Router);
  const session = await sessionService.ensureSession();
  if (session) {
    if (session.kind === 'firebase') {
      const user = await usersService.loadUserById(undefined, 8000).catch(() => null);
      if (user?.admin === true) {
        return router.createUrlTree(['/admin']);
      }
      if (requiresProfileOnboarding(user)) {
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

function requiresProfileOnboarding(user: UserDto | null | undefined): boolean {
  if (!user || user.admin === true || user.profileStatus === 'blocked' || user.profileStatus === 'deleted' || user.hostTier === 'Admin') {
    return false;
  }
  return user.profileStatus === 'onboarding'
    || AppUtils.positiveInteger(user.profileFormVersion) < CURRENT_PROFILE_FORM_VERSION;
}
