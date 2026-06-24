import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ProgressIndicatorComponent, type ProgressIndicatorState } from '../../progress-indicator';

@Component({
  selector: 'app-header-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, ProgressIndicatorComponent],
  templateUrl: './header-card.component.html',
  styleUrl: './header-card.component.scss'
})
export class HeaderCardComponent {
  @Input() title = '';
  @Input() meta = '';
  @Input() metaIcon = 'location_on';
  @Input() imageUrl: string | null = null;
  @Input() initials = '';
  @Input() gender: string | null = null;
  @Input() statusClass = 'status-inactive';
  @Input() badgeLabel = '';
  @Input() badgeStyle: Record<string, string> | null = null;
  @Input() editAriaLabel = 'Edit';
  @Input() showEdit = false;
  @Input() editDisabled = false;
  @Input() showRing = false;
  @Input() ringState: ProgressIndicatorState = 'loading';
  @Input() ringTitle: string | null = null;
  @Input() admin = false;

  @Output() edit = new EventEmitter<Event>();

  protected get avatarClassList(): string[] {
    const classes = ['header-card__avatar'];
    const normalizedGender = `${this.gender ?? ''}`.trim();
    if (normalizedGender) {
      classes.push(`user-color-${normalizedGender}`);
    }
    if (`${this.imageUrl ?? ''}`.trim()) {
      classes.push('has-photo');
    }
    return classes;
  }

  protected onEdit(event: Event): void {
    event.stopPropagation();
    if (this.editDisabled) {
      return;
    }
    this.edit.emit(event);
  }
}
