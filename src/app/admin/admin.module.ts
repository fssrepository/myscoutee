import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { AdminHelpSessionPageComponent } from './components/admin-help-session-page/admin-help-session-page.component';
import { AdminPageComponent } from './components/admin-page/admin-page.component';

@NgModule({
  imports: [
    CommonModule,
    AdminHelpSessionPageComponent,
    AdminPageComponent,
    RouterModule.forChild([
      {
        path: 'help/:token',
        component: AdminHelpSessionPageComponent
      },
      {
        path: 'workspace',
        redirectTo: '',
        pathMatch: 'full'
      },
      {
        path: '',
        component: AdminPageComponent
      }
    ])
  ],
  exports: [
    AdminHelpSessionPageComponent,
    AdminPageComponent
  ]
})
export class AdminModule {}
