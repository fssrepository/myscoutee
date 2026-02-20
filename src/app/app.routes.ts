import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'game', pathMatch: 'full' },
  { path: 'home', redirectTo: 'game', pathMatch: 'full' },
  {
    path: 'game',
    loadComponent: () => import('./home/components/home.component').then(m => m.HomeComponent),
    data: { section: 'game' }
  },
  { path: 'documents', loadChildren: () => import('./document/document.module').then(m => m.DocumentModule) },
  { path: 'offices', loadChildren: () => import('./offices/offices.module').then(m => m.OfficesModule) },
  { path: 'appointments', loadChildren: () => import('./appointments/appointments.module').then(m => m.AppointmentsModule) },
  { path: 'information', loadChildren: () => import('./information/information.module').then(m => m.InformationModule) }
];
