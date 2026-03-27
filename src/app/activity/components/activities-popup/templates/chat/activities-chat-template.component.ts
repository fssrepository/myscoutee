import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { CounterBadgePipe } from '../../../../../shared/ui';
import type { ActivitiesChatTemplateData } from './activities-chat-template.builder';

@Component({
  selector: 'app-activities-chat-template',
  standalone: true,
  imports: [CommonModule, CounterBadgePipe],
  templateUrl: './activities-chat-template.component.html',
  styleUrl: './activities-chat-template.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesChatTemplateComponent {
  @Input() data: ActivitiesChatTemplateData | null = null;

  @Output() readonly rowClick = new EventEmitter<MouseEvent>();

  protected onRowClick(event: MouseEvent): void {
    this.rowClick.emit(event);
  }
}
