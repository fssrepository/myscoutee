import { Routes } from '@angular/router';
import { restrictedAreaGuard } from './shared/core';

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
    path: 'admin/help/:token',
    loadComponent: () => import('./admin/admin-help-session-page.component').then(m => m.AdminHelpSessionPageComponent)
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
