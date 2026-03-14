import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-navigator-menubar',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './navigator-menubar.component.html',
  styleUrl: './navigator-menubar.component.scss'
})
export class NavigatorMenubarComponent {
  @Input() visible = false;
  @Input() isLoading = false;
  @Input() hasLoadError = false;
  @Input() isOpen = false;
  @Input() canToggle = false;
  @Input() ariaLabel = 'Loading profile';
  @Input() title = 'Loading profile';
  @Input() showLoadRing = false;
  @Input() ringCircumference = 0;
  @Input() gender: 'woman' | 'man' = 'woman';
  @Input() initials = '';
  @Input() imageUrl: string | null = null;
  @Input() badgeCount = 0;

  @Output() readonly toggleMenu = new EventEmitter<void>();

  protected onToggleMenu(): void {
    if (!this.canToggle) {
      return;
    }
    this.toggleMenu.emit();
  }

  protected avatarClassList(): Record<string, boolean> {
    return {
      [`user-color-${this.gender}`]: this.canToggle,
      'has-photo': this.canToggle && !!this.imageUrl,
      'is-placeholder': !this.canToggle
    };
  }

  protected avatarBackgroundImage(): string | null {
    if (!this.canToggle) {
      return null;
    }
    const trimmedImageUrl = this.imageUrl?.trim() ?? '';
    return trimmedImageUrl ? `url(${trimmedImageUrl})` : null;
  }
}
