import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { EventEditorComponent } from './components/event-editor/event-editor.component';
import { SubEventFormComponent } from './components/sub-event-form/sub-event-form.component';
import { SubEventGroupFormComponent } from './components/sub-event-group-form/sub-event-group-form.component';
import { SubEventListComponent } from './components/sub-event-list/sub-event-list.component';
import { SubEventStageComponent } from './components/sub-event-stage/sub-event-stage.component';
import { LeaderboardEntryPopupComponent } from './components/leaderboard-entry-popup/leaderboard-entry-popup.component';
import { PublishConfirmComponent } from './components/publish-confirm/publish-confirm.component';
import { EventMembersComponent } from './components/event-members/event-members.component';
import { EventTopicsSelectorComponent } from './components/event-topics-selector/event-topics-selector.component';
import { EventVisibilityPickerComponent } from './components/event-visibility-picker/event-visibility-picker.component';
import { EventFrequencySelectorComponent } from './components/event-frequency-selector/event-frequency-selector.component';

@NgModule({
  // Import standalone components to allow re-exporting them
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    EventEditorComponent,
    SubEventFormComponent,
    SubEventGroupFormComponent,
    SubEventListComponent,
    SubEventStageComponent,
    LeaderboardEntryPopupComponent,
    PublishConfirmComponent,
    EventMembersComponent,
    EventTopicsSelectorComponent,
    EventVisibilityPickerComponent,
    EventFrequencySelectorComponent
  ],
  exports: [
    EventEditorComponent,
    SubEventFormComponent,
    SubEventGroupFormComponent,
    SubEventListComponent,
    SubEventStageComponent,
    LeaderboardEntryPopupComponent,
    PublishConfirmComponent,
    EventMembersComponent,
    EventTopicsSelectorComponent,
    EventVisibilityPickerComponent,
    EventFrequencySelectorComponent
  ]
})
export class EventEditorModule {}
