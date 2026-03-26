import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NavigatorComponent } from './components/navigator/navigator.component';

@NgModule({
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    NavigatorComponent
  ],
  exports: [
    NavigatorComponent
  ]
})
export class NavigatorModule {}
