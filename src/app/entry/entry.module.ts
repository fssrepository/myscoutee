import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { EntryShellComponent } from './components/entry-shell/entry-shell.component';

@NgModule({
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    EntryShellComponent
  ],
  exports: [
    EntryShellComponent
  ]
})
export class EntryModule {}
