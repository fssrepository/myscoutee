import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger
} from '../../../menu';

export type TextCardTone =
  | 'neutral'
  | 'blue'
  | 'cyan'
  | 'green'
  | 'violet'
  | 'amber'
  | 'danger'
  | 'muted';

@Component({
  selector: 'app-text-card',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    AppMenuComponent
  ],
  templateUrl: './text-card.component.html',
  styleUrl: './text-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextCardComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() meta = '';
  @Input() detail = '';
  @Input() icon = '';
  @Input() tone: TextCardTone = 'neutral';
  @Input() menuTitle: string | null = null;
  @Input() menuPalette: AppMenuPalette = 'default';
  @Input() menuItems: readonly AppMenuItem<string, unknown>[] = [];

  @Output() menuSelect = new EventEmitter<AppMenuItemSelectEvent<string, unknown>>();

  protected rootClassList(): string[] {
    return [
      'ui-text-card',
      `ui-text-card--tone-${this.tone || 'neutral'}`
    ];
  }

  protected resolvedTitle(): string {
    return `${this.title ?? ''}`.trim();
  }

  protected resolvedSubtitle(): string {
    return `${this.subtitle ?? ''}`.trim();
  }

  protected resolvedMeta(): string {
    return `${this.meta ?? ''}`.trim();
  }

  protected resolvedDetail(): string {
    return `${this.detail ?? ''}`.trim();
  }

  protected resolvedIcon(): string {
    return `${this.icon ?? ''}`.trim();
  }

  protected hasMenu(): boolean {
    return this.menuItems.length > 0;
  }

  protected resolvedMenuTitle(): string | null {
    const title = `${this.menuTitle ?? this.resolvedTitle()}`.trim();
    return title || null;
  }

  protected menuTrigger(): AppMenuTrigger {
    return {
      icon: 'more_vert',
      closeIcon: 'close',
      hideLabel: true,
      layout: 'icon',
      palette: this.menuPalette,
      ariaLabel: 'Open card menu'
    };
  }
}
