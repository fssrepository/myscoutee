import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import {
  PairCardComponent,
  SingleCardComponent,
  type PairCardData,
  type SingleCardData
} from '../../../../../shared/ui';

@Component({
  selector: 'app-activities-rate-template',
  standalone: true,
  imports: [CommonModule, SingleCardComponent, PairCardComponent],
  templateUrl: './activities-rate-template.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesRateTemplateComponent {
  @Input() singleCard: SingleCardData | null = null;
  @Input() pairCard: PairCardData | null = null;

  @Output() readonly badgeClick = new EventEmitter<void>();

  protected onBadgeClick(): void {
    this.badgeClick.emit();
  }
}
