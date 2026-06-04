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
import { I18nPipe } from '../../../shared/i18n';
import { INFO_CARD_AVAILABLE_ACTIONS } from '../../../shared/ui';
import type {
  InfoCardData,
  InfoCardMenuAction,
  InfoCardMenuActionConfig,
  InfoCardMenuTriggerRect,
  InfoCardResolvedMenuAction,
  InfoCardMenuRequestEvent
} from '../../../shared/ui';

export interface ActivitiesEventActionMenuSelectedEvent {
  row: AppTypes.ActivityListRow;
  card: InfoCardData;
  action: InfoCardResolvedMenuAction;
}

interface ActivitiesEventActionMenuState {
  row: AppTypes.ActivityListRow;
  card: InfoCardData;
  title: string;
  actions: readonly InfoCardMenuAction[];
  openUp: boolean;
  desktopLeft: number | null;
  desktopTop: number | null;
  desktopBottom: number | null;
  desktopMaxHeight: number | null;
  triggerRect: InfoCardMenuTriggerRect | null;
  positioned: boolean;
  closeTrigger: () => void;
}

@Component({
  selector: 'app-activities-event-action-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule, I18nPipe],
  template: `
    @if (menu; as actionMenu) {
      <div
        class="item-action-menu is-open activities-event-action-menu"
        [class.item-action-menu-mobile]="isMobileView"
        [class.item-action-menu-desktop]="!isMobileView"
        [class.is-open-up]="!isMobileView && actionMenu.openUp"
        [class.is-positioned]="isMobileView || actionMenu.positioned"
        [style.left.px]="!isMobileView ? actionMenu.desktopLeft : null"
        [style.top.px]="!isMobileView ? actionMenu.desktopTop : null"
        [style.bottom.px]="!isMobileView ? actionMenu.desktopBottom : null"
        [style.max-height.px]="!isMobileView ? actionMenu.desktopMaxHeight : null"
        [style.transform]="!isMobileView && actionMenu.openUp ? 'translateY(calc(-100% - 8px))' : null"
        [style.animation]="!isMobileView && actionMenu.openUp ? 'none' : null"
        (click)="$event.stopPropagation()"
      >
        @if (actionMenu.title) {
          <div class="item-action-menu-title">{{ actionMenu.title }}</div>
        }
        @for (action of actionMenu.actions; track action) {
          @if (availableActions[action]; as menuAction) {
            <button
              type="button"
              class="item-action-menu-btn"
              [class.item-action-menu-btn-publish]="menuAction.tone === 'accent'"
              [class.item-action-menu-btn-review]="menuAction.tone === 'review'"
              [class.item-action-menu-btn-warning]="menuAction.tone === 'warning'"
              [class.item-action-menu-btn-destructive]="menuAction.tone === 'destructive'"
              (click)="selectAction(action, menuAction, $event)"
            >
              <mat-icon>{{ menuAction.icon }}</mat-icon>
              <span>{{ menuAction.label | i18n }}</span>
            </button>
          }
        }
      </div>
    }
  `,
  styleUrl: './activities-event-action-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesEventActionMenuComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private repositionTimers: number[] = [];
  protected readonly availableActions = INFO_CARD_AVAILABLE_ACTIONS;

  @Output() readonly actionSelect = new EventEmitter<ActivitiesEventActionMenuSelectedEvent>();

  protected menu: ActivitiesEventActionMenuState | null = null;
  protected isMobileView = false;

  open(row: AppTypes.ActivityListRow, event: InfoCardMenuRequestEvent, isMobileView: boolean): void {
    if (this.menu?.card.id === event.card.id) {
      this.close();
      return;
    }
    const previousMenu = this.menu;
    if (previousMenu) {
      this.clearRepositionTimers();
      previousMenu.closeTrigger();
    }

    const desktopPosition = this.resolveDesktopPosition(event, isMobileView);
    this.isMobileView = isMobileView;
    this.menu = {
      row,
      card: event.card,
      title: this.resolveTitle(event.card),
      actions: event.actions,
      openUp: desktopPosition.openUp,
      desktopLeft: desktopPosition.left,
      desktopTop: desktopPosition.top,
      desktopBottom: desktopPosition.bottom,
      desktopMaxHeight: desktopPosition.maxHeight,
      triggerRect: event.triggerRect,
      positioned: isMobileView,
      closeTrigger: event.closeTrigger
    };
    this.cdr.markForCheck();
    this.scheduleDesktopReposition();
  }

  close(): void {
    if (!this.menu) {
      return;
    }
    this.clearRepositionTimers();
    const menu = this.menu;
    this.menu = null;
    menu.closeTrigger();
    this.cdr.markForCheck();
  }

  protected selectAction(
    action: InfoCardMenuAction,
    config: InfoCardMenuActionConfig,
    event: Event
  ): void {
    event.preventDefault();
    event.stopPropagation();
    const menu = this.menu;
    if (!menu) {
      return;
    }
    this.clearRepositionTimers();
    const resolvedAction: InfoCardResolvedMenuAction = {
      id: action,
      ...config
    };
    this.menu = null;
    menu.closeTrigger();
    this.actionSelect.emit({
      row: menu.row,
      card: menu.card,
      action: resolvedAction
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
    bottom: number | null;
    maxHeight: number | null;
    openUp: boolean;
  } {
    return this.resolveDesktopPositionForRect(
      event.triggerRect,
      event.actions,
      event.card.menuTitle === null,
      isMobileView
    );
  }

  private resolveDesktopPositionForRect(
    triggerRect: InfoCardMenuTriggerRect | null,
    actions: readonly InfoCardMenuAction[],
    withoutTitle: boolean,
    isMobileView: boolean,
    measuredMenuHeight: number | null = null
  ): {
    left: number | null;
    top: number | null;
    bottom: number | null;
    maxHeight: number | null;
    openUp: boolean;
  } {
    if (isMobileView || !triggerRect || typeof window === 'undefined') {
      return { left: null, top: null, bottom: null, maxHeight: null, openUp: false };
    }
    const menuWidth = 220;
    const estimatedMenuHeight = Number.isFinite(measuredMenuHeight as number) && (measuredMenuHeight as number) > 0
      ? measuredMenuHeight as number
      : Math.min(320, 24 + actions.length * 38 + (withoutTitle ? 0 : 42));
    const margin = 8;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const spaceAbove = Math.max(0, triggerRect.top - margin);
    const spaceBelow = Math.max(0, viewportHeight - triggerRect.bottom - margin);
    const openUp = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
    const left = Math.min(
      Math.max(margin, triggerRect.right - menuWidth),
      Math.max(margin, viewportWidth - menuWidth - margin)
    );
    if (openUp) {
      return {
        left,
        top: triggerRect.top,
        bottom: null,
        maxHeight: Math.max(120, spaceAbove - margin),
        openUp
      };
    }
    return {
      left,
      top: triggerRect.bottom + margin,
      bottom: null,
      maxHeight: Math.max(120, spaceBelow - margin),
      openUp
    };
  }

  private scheduleDesktopReposition(): void {
    this.clearRepositionTimers();
    if (this.isMobileView || typeof window === 'undefined') {
      return;
    }
    this.repositionTimers.push(window.setTimeout(() => this.repositionDesktopMenuFromLiveTrigger(), 0));
  }

  private clearRepositionTimers(): void {
    if (typeof window === 'undefined') {
      this.repositionTimers = [];
      return;
    }
    for (const timer of this.repositionTimers) {
      window.clearTimeout(timer);
    }
    this.repositionTimers = [];
  }

  private repositionDesktopMenuFromLiveTrigger(): void {
    const menu = this.menu;
    if (!menu || this.isMobileView || typeof window === 'undefined') {
      return;
    }
    const triggerRect = this.resolveLiveMenuTriggerRect() ?? menu.triggerRect;
    if (!triggerRect) {
      this.revealDesktopMenu();
      return;
    }
    const menuElement = document.querySelector<HTMLElement>('.activities-event-action-menu.item-action-menu.is-open');
    const measuredMenuHeight = menuElement
      ? Math.max(menuElement.getBoundingClientRect().height, menuElement.scrollHeight)
      : null;
    const position = this.resolveDesktopPositionForRect(
      triggerRect,
      menu.actions,
      menu.card.menuTitle === null,
      false,
      measuredMenuHeight
    );
    this.menu = {
      ...menu,
      openUp: position.openUp,
      desktopLeft: position.left,
      desktopTop: position.top,
      desktopBottom: position.bottom,
      desktopMaxHeight: position.maxHeight,
      triggerRect,
      positioned: true
    };
    this.cdr.markForCheck();
  }

  private revealDesktopMenu(): void {
    const menu = this.menu;
    if (!menu || menu.positioned) {
      return;
    }
    this.menu = {
      ...menu,
      positioned: true
    };
    this.cdr.markForCheck();
  }

  private resolveLiveMenuTriggerRect(): InfoCardMenuTriggerRect | null {
    const trigger = this.resolveLiveMenuTrigger();
    if (!trigger) {
      return null;
    }
    const rect = trigger.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
  }

  private resolveLiveMenuTrigger(): HTMLElement | null {
    const root = document.querySelector('.popup-panel-activities') ?? document;
    const selectors = [
      '.ui-info-card--menu-open .ui-info-card__menu-trigger',
      '.ui-info-card__menu-trigger.is-open',
      '.experience-action-menu-trigger.is-open'
    ];
    for (const selector of selectors) {
      const trigger = Array.from(root.querySelectorAll<HTMLElement>(selector))
        .filter(element => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0
            && rect.height > 0
            && style.visibility !== 'hidden'
            && style.display !== 'none';
        })
        .at(-1) ?? null;
      if (trigger) {
        return trigger;
      }
    }
    return null;
  }
}
