import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { EntryPageComponent } from './components/entry-page/entry-page.component';

@NgModule({
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    EntryPageComponent
  ],
  exports: [
    EntryPageComponent
  ]
})
export class EntryModule {}
