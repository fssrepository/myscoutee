import { Injector, inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';

import { AppUtils } from './shared/app-utils';
import { CURRENT_PROFILE_FORM_VERSION } from './shared/core/common/constants';
import { SessionService } from './shared/core/base/services/session.service';
import type { UserDto } from './shared/core/contracts/user.interface';

const loadEntryPage = () => import('./entry/components/entry-page/entry-page.component').then(m => m.EntryPageComponent);

const restrictedAreaGuard: CanActivateFn = async (_route, state) => {
  const injector = inject(Injector);
  const sessionService = inject(SessionService);
  const router = inject(Router);
  const session = await sessionService.ensureSession();
  if (session) {
    if (session.kind === 'firebase') {
      const { UsersService } = await import('./shared/core/base/services/users.service');
      const usersService = injector.get(UsersService);
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

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: loadEntryPage
  },
  {
    path: 'entry',
    loadComponent: loadEntryPage
  },
  {
    path: 'privacy-policy',
    loadComponent: () => import('./shared/ui/components/document-viewer/document-viewer.component').then(m => m.DocumentViewerComponent),
    data: { documentKind: 'privacy' }
  },
  {
    path: 'terms',
    loadComponent: () => import('./shared/ui/components/document-viewer/document-viewer.component').then(m => m.DocumentViewerComponent),
    data: { documentKind: 'terms' }
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
  },
  {
    path: '',
    canActivate: [restrictedAreaGuard],
    children: [
      { path: 'home', redirectTo: 'game', pathMatch: 'full' },
      {
        path: 'game',
        loadComponent: () => import('./home/components/home/home.component').then(m => m.HomeComponent),
        data: { section: 'game' }
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
