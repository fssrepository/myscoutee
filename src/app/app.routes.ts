import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'game', pathMatch: 'full' },
  { path: 'home', redirectTo: 'game', pathMatch: 'full' },
  {
    path: 'game',
    loadComponent: () => import('./home/components/home.component').then(m => m.HomeComponent),
    data: { section: 'game' }
  },
  { path: '**', redirectTo: 'game' }
];
