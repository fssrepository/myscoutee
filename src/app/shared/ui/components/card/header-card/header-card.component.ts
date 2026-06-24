import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ProgressIndicatorComponent, type ProgressIndicatorState } from '../../progress-indicator';

export interface HeaderCardModel {
  title?: string | null;
  meta?: string | null;
  metaIcon?: string | null;
  imageUrl?: string | null;
  initials?: string | null;
  gender?: string | null;
  statusClass?: string | null;
  badgeLabel?: string | null;
  badgeStyle?: Record<string, string> | null;
  editAriaLabel?: string | null;
  showEdit?: boolean | null;
  editDisabled?: boolean | null;
  showRing?: boolean | null;
  ringState?: ProgressIndicatorState | null;
  ringTitle?: string | null;
  admin?: boolean | null;
}

@Component({
  selector: 'app-header-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, ProgressIndicatorComponent],
  templateUrl: './header-card.component.html',
  styleUrl: './header-card.component.scss'
})
export class HeaderCardComponent {
  @Input() model: HeaderCardModel | null = null;

  @Output() edit = new EventEmitter<Event>();

  protected onEdit(event: Event): void {
    event.stopPropagation();
    if (this.model?.editDisabled === true) {
      return;
    }
    this.edit.emit(event);
  }
}
