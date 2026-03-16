import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EventExplorePopupComponent } from './components/event-explore-popup/event-explore-popup.component';
import { EventEditorPopupComponent } from './components/event-editor-popup/event-editor-popup.component';

@NgModule({
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    EventExplorePopupComponent,
    EventEditorPopupComponent
  ],
  exports: [
    EventExplorePopupComponent,
    EventEditorPopupComponent
  ]
})
export class ActivityModule { }
