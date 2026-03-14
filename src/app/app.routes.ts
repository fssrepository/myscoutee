import { Routes } from '@angular/router';
import { restrictedAreaGuard } from './shared/core';

export const routes: Routes = [
  {
    path: 'entry',
    loadComponent: () => import('./entry/components/entry-page.component').then(m => m.EntryPageComponent)
  },
  {
    path: '',
    canActivate: [restrictedAreaGuard],
    loadComponent: () => import('./app').then(m => m.App),
    children: [
      { path: '', redirectTo: 'game', pathMatch: 'full' },
      { path: 'home', redirectTo: 'game', pathMatch: 'full' },
      {
        path: 'game',
        loadComponent: () => import('./home/components/home.component').then(m => m.HomeComponent),
        data: { section: 'game' }
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
