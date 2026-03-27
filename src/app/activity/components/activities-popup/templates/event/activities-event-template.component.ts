import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import {
  InfoCardComponent,
  type InfoCardData,
  type InfoCardMenuActionEvent
} from '../../../../../shared/ui';

@Component({
  selector: 'app-activities-event-template',
  standalone: true,
  imports: [CommonModule, InfoCardComponent],
  templateUrl: './activities-event-template.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesEventTemplateComponent {
  @Input() card: InfoCardData | null = null;

  @Output() readonly mediaEndClick = new EventEmitter<void>();
  @Output() readonly menuAction = new EventEmitter<InfoCardMenuActionEvent>();

  protected onMediaEndClick(): void {
    this.mediaEndClick.emit();
  }

  protected onMenuAction(event: InfoCardMenuActionEvent): void {
    this.menuAction.emit(event);
  }
}
