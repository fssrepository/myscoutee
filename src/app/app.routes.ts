import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', loadChildren: () => import('./home/home.module').then(m => m.HomeModule) },
  { path: 'documents', loadChildren: () => import('./document/document.module').then(m => m.DocumentModule) },
  { path: 'offices', loadChildren: () => import('./offices/offices.module').then(m => m.OfficesModule) },
  { path: 'appointments', loadChildren: () => import('./appointments/appointments.module').then(m => m.AppointmentsModule) },
  { path: 'information', loadChildren: () => import('./information/information.module').then(m => m.InformationModule) }
];
