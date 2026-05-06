import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Output,
  inject
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type * as AppTypes from '../../../shared/core/base/models';
import type {
  InfoCardData,
  InfoCardMenuAction,
  InfoCardMenuRequestEvent
} from '../../../shared/ui';

export interface ActivitiesEventActionMenuSelectedEvent {
  row: AppTypes.ActivityListRow;
  card: InfoCardData;
  action: InfoCardMenuAction;
}

interface ActivitiesEventActionMenuState {
  row: AppTypes.ActivityListRow;
  card: InfoCardData;
  title: string;
  actions: readonly InfoCardMenuAction[];
  openUp: boolean;
  desktopLeft: number | null;
  desktopTop: number | null;
  closeTrigger: () => void;
}

@Component({
  selector: 'app-activities-event-action-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (menu; as actionMenu) {
      <div
        class="item-action-menu is-open activities-event-action-menu"
        [class.item-action-menu-mobile]="isMobileView"
        [class.item-action-menu-desktop]="!isMobileView"
        [class.is-open-up]="!isMobileView && actionMenu.openUp"
        [style.left.px]="!isMobileView ? actionMenu.desktopLeft : null"
        [style.top.px]="!isMobileView ? actionMenu.desktopTop : null"
        [style.bottom]="!isMobileView ? 'auto' : null"
        (click)="$event.stopPropagation()"
      >
        @if (actionMenu.title) {
          <div class="item-action-menu-title">{{ actionMenu.title }}</div>
        }
        @for (action of actionMenu.actions; track action.id) {
          <button
            type="button"
            class="item-action-menu-btn"
            [class.item-action-menu-btn-publish]="action.tone === 'accent'"
            [class.item-action-menu-btn-warning]="action.tone === 'warning'"
            [class.item-action-menu-btn-destructive]="action.tone === 'destructive'"
            (click)="selectAction(action, $event)"
          >
            <mat-icon>{{ action.icon }}</mat-icon>
            <span>{{ action.label }}</span>
          </button>
        }
      </div>
    }
  `,
  styleUrl: './activities-event-action-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesEventActionMenuComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  @Output() readonly actionSelect = new EventEmitter<ActivitiesEventActionMenuSelectedEvent>();

  protected menu: ActivitiesEventActionMenuState | null = null;
  protected isMobileView = false;

  open(row: AppTypes.ActivityListRow, event: InfoCardMenuRequestEvent, isMobileView: boolean): void {
    if (this.menu?.card.rowId === event.card.rowId) {
      this.close();
      return;
    }

    const desktopPosition = this.resolveDesktopPosition(event, isMobileView);
    this.isMobileView = isMobileView;
    this.menu = {
      row,
      card: event.card,
      title: this.resolveTitle(event.card),
      actions: event.actions,
      openUp: event.openUp,
      desktopLeft: desktopPosition.left,
      desktopTop: desktopPosition.top,
      closeTrigger: event.closeTrigger
    };
    this.cdr.markForCheck();
  }

  close(): void {
    if (!this.menu) {
      return;
    }
    const menu = this.menu;
    this.menu = null;
    menu.closeTrigger();
    this.cdr.markForCheck();
  }

  protected selectAction(action: InfoCardMenuAction, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const menu = this.menu;
    if (!menu) {
      return;
    }
    this.menu = null;
    menu.closeTrigger();
    this.actionSelect.emit({
      row: menu.row,
      card: menu.card,
      action
    });
    this.cdr.markForCheck();
  }

  private resolveTitle(card: InfoCardData): string {
    if (card.menuTitle === null) {
      return '';
    }
    return `${card.menuTitle ?? card.title ?? ''}`.trim();
  }

  private resolveDesktopPosition(event: InfoCardMenuRequestEvent, isMobileView: boolean): {
    left: number | null;
    top: number | null;
  } {
    if (isMobileView || !event.triggerRect || typeof window === 'undefined') {
      return { left: null, top: null };
    }
    const menuWidth = 220;
    const estimatedMenuHeight = Math.min(320, 24 + event.actions.length * 38 + (event.card.menuTitle === null ? 0 : 42));
    const margin = 8;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const left = Math.min(
      Math.max(margin, event.triggerRect.right - menuWidth),
      Math.max(margin, viewportWidth - menuWidth - margin)
    );
    const top = event.openUp
      ? Math.max(margin, event.triggerRect.top - estimatedMenuHeight - margin)
      : Math.min(event.triggerRect.bottom + margin, Math.max(margin, viewportHeight - estimatedMenuHeight - margin));
    return { left, top };
  }
}
