import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OfficesComponent } from './components/offices.component';

@NgModule({
  imports: [
    CommonModule,
    OfficesComponent,
    RouterModule.forChild([
      { path: '', component: OfficesComponent }
    ])
  ]
})
export class OfficesModule {}
