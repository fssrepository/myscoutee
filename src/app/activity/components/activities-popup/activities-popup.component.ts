import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

import { CounterBadgePipe, SmartListComponent } from '../../../shared/ui';
import { EventChatPopupComponent } from '../event-chat-popup/event-chat-popup.component';
import { EventExplorePopupComponent } from '../event-explore-popup/event-explore-popup.component';
import { ActivitiesChatTemplateComponent } from './templates/chat/activities-chat-template.component';
import { ActivitiesEventTemplateComponent } from './templates/event/activities-event-template.component';
import { ActivitiesRateTemplateComponent } from './templates/rate/activities-rate-template.component';
import { ActivitiesPopupToolbarBase } from './activities-popup-toolbar.base';

@Component({
  selector: 'app-activities-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSelectModule,
    SmartListComponent,
    ActivitiesEventTemplateComponent,
    ActivitiesChatTemplateComponent,
    ActivitiesRateTemplateComponent,
    EventChatPopupComponent,
    EventExplorePopupComponent,
    CounterBadgePipe
  ],
  templateUrl: './activities-popup.component.html',
  styleUrl: './activities-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesPopupComponent extends ActivitiesPopupToolbarBase {}
