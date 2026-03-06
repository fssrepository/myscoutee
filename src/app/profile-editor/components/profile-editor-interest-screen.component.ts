import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { InterestOptionGroup } from '../profile-editor.types';

@Component({
  selector: 'app-profile-editor-interest-screen',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './profile-editor-interest-screen.component.html',
  styleUrl: './profile-editor-interest-screen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileEditorInterestScreenComponent {
  @Input({ required: true }) selected: string[] = [];
  @Input({ required: true }) groups: InterestOptionGroup[] = [];

  @Output() clearRequested = new EventEmitter<void>();
  @Output() removeRequested = new EventEmitter<string>();
  @Output() toggleRequested = new EventEmitter<string>();

  protected toneIcon(toneClass: string): string {
    switch (toneClass) {
      case 'section-social':
        return 'celebration';
      case 'section-arts':
        return 'palette';
      case 'section-food':
        return 'restaurant';
      case 'section-active':
        return 'hiking';
      case 'section-mind':
        return 'self_improvement';
      case 'section-identity':
        return 'public';
      default:
        return 'label';
    }
  }

  protected isSelected(option: string): boolean {
    return this.selected.includes(option);
  }
}

