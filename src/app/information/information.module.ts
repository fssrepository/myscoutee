import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { InformationComponent } from './components/information.component';

@NgModule({
  imports: [
    CommonModule,
    InformationComponent,
    RouterModule.forChild([
      { path: '', component: InformationComponent }
    ])
  ]
})
export class InformationModule {}
