import { Routes } from '@angular/router';
import { restrictedAreaGuard } from './routing/restricted-area.guard';

const loadEntryPage = () => import('./entry/components/entry-page/entry-page.component').then(m => m.EntryPageComponent);

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
    loadComponent: () => import('./shared/ui/components/privacy-policy-popup/privacy-policy-popup.component').then(m => m.PrivacyPolicyPopupComponent)
  },
  {
    path: 'terms',
    loadComponent: () => import('./shared/ui/components/terms-policy/terms-policy.component').then(m => m.TermsPolicyComponent)
  },
  {
    path: 'admin/help/:token',
    loadComponent: () => import('./admin/components/admin-help-session-page/admin-help-session-page.component')
      .then(m => m.AdminHelpSessionPageComponent)
  },
  {
    path: 'admin/workspace',
    loadComponent: () => import('./admin/components/admin-page/admin-page.component').then(m => m.AdminPageComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin/components/admin-page/admin-page.component').then(m => m.AdminPageComponent)
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
