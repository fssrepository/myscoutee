import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AppointmentsComponent } from './components/appointments.component';

@NgModule({
  imports: [
    CommonModule,
    AppointmentsComponent,
    RouterModule.forChild([
      { path: '', component: AppointmentsComponent }
    ])
  ]
})
export class AppointmentsModule {}
