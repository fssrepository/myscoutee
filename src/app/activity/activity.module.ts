import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EventEditorPopupComponent } from './components/event-editor-popup/event-editor-popup.component';

@NgModule({
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    EventEditorPopupComponent
  ],
  exports: [
    EventEditorPopupComponent
  ]
})
export class ActivityModule { }
