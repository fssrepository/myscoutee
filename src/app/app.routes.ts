import { Routes } from '@angular/router';
import { restrictedAreaGuard } from './shared/core';

const loadEntryPage = () => import('./entry/components/entry-page.component').then(m => m.EntryPageComponent);

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
    path: '',
    canActivate: [restrictedAreaGuard],
    loadComponent: () => import('./app').then(m => m.App),
    children: [
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
