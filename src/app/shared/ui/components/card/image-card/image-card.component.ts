import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { AppUtils } from '../../../../app-utils';
import { LazyBgImageDirective } from '../../../directives/lazy-bg-image.directive';
import {
  AppMenuTriggerComponent,
  type AppMenuItem,
  type AppMenuPalette,
  type AppMenuTrigger
} from '../../menu';
import { ProgressIndicatorComponent } from '../../progress-indicator';
import {
  CARD_MENU_ACTIONS,
  type CardMenuAction,
  type ImageCardData,
  type ImageCardLayout,
  type ImageCardMediaAction,
  type ImageCardMediaActionEvent,
  type ImageCardMediaActionPosition,
  type ImageCardStatusChip
} from '../card.types';

@Component({
  selector: 'app-image-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, LazyBgImageDirective, AppMenuTriggerComponent, ProgressIndicatorComponent],
  templateUrl: './image-card.component.html',
  styleUrl: './image-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageCardComponent {
  protected readonly mediaActionPositions: readonly ImageCardMediaActionPosition[] = [
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right'
  ];

  @Input() card: ImageCardData | null = null;
  @Input() imageUrl = '';
  @Input() title = '';
  @Input() subtitle = '';
  @Input() detail = '';
  @Input() label: string | null = null;
  @Input() placeholder = '';
  @Input() mediaActions: readonly ImageCardMediaAction[] | null = null;
  @Input() menuId: string | null = null;
  @Input() menuTitle: string | null = null;
  @Input() sharedMenuTrigger: AppMenuTrigger | null = null;
  @Input() sharedMenuItems: readonly AppMenuItem<string, unknown>[] | null = null;
  @Input() sharedMenuContext: Record<string, unknown> | null = null;

  @Output() readonly mediaAction = new EventEmitter<ImageCardMediaActionEvent>();

  protected rootClassList(): string[] {
    const classes = [
      'experience-item-card',
      'ui-image-card',
      `ui-image-card--layout-${this.resolvedLayout()}`
    ];
    const toneClass = `${this.card?.toneClass ?? ''}`.trim();
    if (toneClass) {
      classes.push(...toneClass.split(/\s+/));
    }
    if (this.hasBottomRightControls()) {
      classes.push('ui-image-card--with-bottom-right-controls');
    }
    return classes;
  }

  protected resolvedLayout(): ImageCardLayout {
    return this.card?.layout ?? 'stacked';
  }

  protected resolvedImageUrl(): string {
    return AppUtils.mediaImageVariantUrl(
      `${this.card?.imageUrl ?? this.card?.singleImageUrls?.[0] ?? this.imageUrl ?? ''}`.trim(),
      'medium'
    );
  }

  protected resolvedTitle(): string {
    return `${this.card?.title ?? this.title ?? ''}`.trim();
  }

  protected resolvedSubtitle(): string {
    return `${this.card?.subtitle ?? this.subtitle ?? ''}`.trim();
  }

  protected resolvedDetail(): string {
    return `${this.card?.detail ?? this.detail ?? ''}`.trim();
  }

  protected resolvedLabel(): string {
    return `${this.label ?? ''}`.trim();
  }

  protected resolvedPlaceholderLabel(): string {
    return `${this.card?.placeholderLabel ?? this.placeholder ?? ''}`.trim();
  }

  protected resolvedPlaceholderIcon(): string {
    return `${this.card?.placeholderIcon ?? 'image_not_supported'}`.trim();
  }

  protected resolvedStatusChip(): ImageCardStatusChip | null {
    return this.card?.statusChip ?? null;
  }

  protected resolvedMediaActions(): readonly ImageCardMediaAction[] {
    return this.mediaActions ?? this.card?.mediaActions ?? [];
  }

  protected mediaActionsFor(position: ImageCardMediaActionPosition): readonly ImageCardMediaAction[] {
    return this.resolvedMediaActions().filter(action => (action.position ?? 'top-right') === position);
  }

  protected hasPositionControls(position: ImageCardMediaActionPosition): boolean {
    return this.mediaActionsFor(position).length > 0 || this.hasMenuAt(position);
  }

  protected hasMenuAt(position: ImageCardMediaActionPosition): boolean {
    return this.hasMenuActions() && position === 'top-right';
  }

  protected hasBottomRightControls(): boolean {
    return this.hasPositionControls('bottom-right');
  }

  protected mediaActionIcon(action: ImageCardMediaAction): string {
    return `${action.selected && action.selectedIcon ? action.selectedIcon : action.icon}`.trim();
  }

  protected mediaActionClassList(action: ImageCardMediaAction): string[] {
    const classes = [
      'ui-image-card__action',
      `ui-image-card__action--${action.tone ?? 'default'}`
    ];
    if (action.selected) {
      classes.push('is-selected');
    }
    const className = `${action.className ?? ''}`.trim();
    if (className) {
      classes.push(...className.split(/\s+/));
    }
    return classes;
  }

  protected statusChipClassList(chip: ImageCardStatusChip): string[] {
    const classes = [
      'ui-image-card__status-chip',
      `ui-image-card__status-chip--${chip.tone ?? 'default'}`
    ];
    if (chip.label) {
      classes.push('ui-image-card__status-chip--with-label');
    }
    if (chip.palette) {
      classes.push(`ui-image-card__status-chip--palette-${chip.palette}`);
    }
    const className = `${chip.className ?? ''}`.trim();
    if (className) {
      classes.push(...className.split(/\s+/));
    }
    return classes;
  }

  protected onMediaAction(action: ImageCardMediaAction, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.card || action.disabled) {
      return;
    }
    this.mediaAction.emit({
      id: this.card.id,
      action,
      card: this.card,
      sourceEvent: event
    });
  }

  protected sharedMenuId(): string {
    return `${this.menuId ?? `image-card-actions-${this.card?.id ?? 'unknown'}`}`.trim();
  }

  protected sharedMenuTitle(): string | null {
    const title = `${this.menuTitle ?? this.card?.menuTitle ?? this.card?.title ?? ''}`.trim();
    return title || null;
  }

  protected resolvedSharedMenuTrigger(): AppMenuTrigger {
    const counter = Math.max(0, Math.trunc(Number(this.card?.menuBadgeCount) || 0));
    return this.sharedMenuTrigger ?? {
      icon: 'more_vert',
      closeIcon: 'close',
      hideLabel: true,
      layout: 'icon',
      palette: 'default',
      counter: counter > 0 ? { value: counter, max: 99 } : null,
      ariaLabel: 'Open menu'
    };
  }

  protected resolvedSharedMenuItems(): readonly AppMenuItem<string, unknown>[] {
    if (this.sharedMenuItems?.length) {
      return this.sharedMenuItems;
    }
    const card = this.card;
    if (!card?.menuActions?.length) {
      return [];
    }
    return card.menuActions.flatMap(actionId => {
      const config = CARD_MENU_ACTIONS[actionId];
      if (!config) {
        return [];
      }
      const action: CardMenuAction = {
        id: actionId,
        ...config
      };
      return [{
        id: actionId,
        label: config.label,
        icon: config.icon,
        palette: this.sharedMenuActionPalette(config.tone),
        surface: 'tinted',
        context: {
          ...(this.sharedMenuContext ?? {}),
          card,
          action
        }
      }];
    });
  }

  private hasMenuActions(): boolean {
    if (this.sharedMenuItems?.length) {
      return true;
    }
    return (this.card?.menuActions?.length ?? 0) > 0;
  }

  private sharedMenuActionPalette(tone: CardMenuAction['tone']): AppMenuPalette {
    switch (tone) {
      case 'accent':
        return 'brown';
      case 'warning':
      case 'review':
        return 'orange';
      case 'destructive':
        return 'danger';
      default:
        return 'default';
    }
  }
}
