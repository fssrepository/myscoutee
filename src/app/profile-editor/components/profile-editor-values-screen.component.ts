import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ValuesOptionGroup } from '../profile-editor.types';

@Component({
  selector: 'app-profile-editor-values-screen',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './profile-editor-values-screen.component.html',
  styleUrl: './profile-editor-values-screen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileEditorValuesScreenComponent {
  @Input({ required: true }) selected: string[] = [];
  @Input({ required: true }) groups: ValuesOptionGroup[] = [];

  @Output() clearRequested = new EventEmitter<void>();
  @Output() removeRequested = new EventEmitter<string>();
  @Output() toggleRequested = new EventEmitter<string>();

  protected toneIcon(toneClass: string): string {
    switch (toneClass) {
      case 'section-family':
        return 'family_restroom';
      case 'section-ambition':
        return 'rocket_launch';
      case 'section-lifestyle':
        return 'eco';
      case 'section-beliefs':
        return 'auto_awesome';
      default:
        return 'label';
    }
  }

  protected isSelected(option: string): boolean {
    return this.selected.includes(option);
  }
}

