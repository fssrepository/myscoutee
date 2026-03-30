import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { LazyBgImageDirective } from '../../../directives/lazy-bg-image.directive';
import { CounterBadgePipe } from '../../../pipes/counter-badge.pipe';
import type {
  InfoCardClickEvent,
  InfoCardData,
  InfoCardFooterChip,
  InfoCardMenuAction,
  InfoCardMenuActionEvent,
  InfoCardOverlayAccessory,
  InfoCardOverlayLayout,
  InfoCardOverlayAction,
  InfoCardDetailStyle,
  InfoCardOverlayTone,
  InfoCardOverlayVariant
} from '../card.types';

@Component({
  selector: 'app-info-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, LazyBgImageDirective, CounterBadgePipe],
  templateUrl: './info-card.component.html',
  styleUrl: './info-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InfoCardComponent {
  private static readonly MOBILE_BREAKPOINT_PX = 860;
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() card: InfoCardData | null = null;

  @Output() readonly cardClick = new EventEmitter<InfoCardClickEvent>();
  @Output() readonly mediaStartClick = new EventEmitter<InfoCardClickEvent>();
  @Output() readonly mediaEndClick = new EventEmitter<InfoCardClickEvent>();
  @Output() readonly menuAction = new EventEmitter<InfoCardMenuActionEvent>();

  protected isMobileView = false;
  protected menuOpen = false;
  protected menuOpenUp = false;

  constructor() {
    this.syncMobileViewFromViewport();
  }

  @HostListener('window:resize')
  protected onViewportResize(): void {
    this.syncMobileViewFromViewport();
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    if (!this.menuOpen) {
      return;
    }
    event.stopPropagation();
    this.closeMenu();
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: PointerEvent): void {
    if (!this.menuOpen) {
      return;
    }
    const target = event.target;
    if (target instanceof Node && this.hostRef.nativeElement.contains(target)) {
      return;
    }
    this.closeMenu();
  }

  protected onCardActivated(event?: Event): void {
    if (!this.card?.clickable) {
      return;
    }
    event?.stopPropagation();
    this.cardClick.emit({
      rowId: this.card.rowId,
      card: this.card
    });
  }

  protected onMediaStartActivated(event: Event): void {
    if (!this.card || !this.isOverlayInteractive(this.card.mediaStart)) {
      return;
    }
    event.stopPropagation();
    this.mediaStartClick.emit({
      rowId: this.card.rowId,
      card: this.card
    });
  }

  protected onMediaEndActivated(event: Event): void {
    if (!this.card || !this.isOverlayInteractive(this.card.mediaEnd)) {
      return;
    }
    event.stopPropagation();
    this.mediaEndClick.emit({
      rowId: this.card.rowId,
      card: this.card
    });
  }

  protected toggleMenu(event: Event): void {
    event.stopPropagation();
    if (!this.card?.menuActions?.length) {
      return;
    }
    if (this.menuOpen) {
      this.closeMenu();
      return;
    }
    const trigger = event.currentTarget as HTMLElement | null;
    this.menuOpenUp = this.shouldOpenMenuUp(trigger);
    this.menuOpen = true;
    this.cdr.markForCheck();
  }

  protected closeMenu(event?: Event): void {
    event?.stopPropagation();
    if (!this.menuOpen && !this.menuOpenUp) {
      return;
    }
    this.menuOpen = false;
    this.menuOpenUp = false;
    this.cdr.markForCheck();
  }

  protected onMenuActionSelected(action: InfoCardMenuAction, event: Event): void {
    if (!this.card) {
      return;
    }
    event.stopPropagation();
    this.menuAction.emit({
      rowId: this.card.rowId,
      actionId: action.id,
      action,
      card: this.card
    });
    this.closeMenu();
  }

  protected isOverlayInteractive(action: InfoCardOverlayAction | null | undefined): boolean {
    return !!action && action.interactive !== false && !action.disabled;
  }

  protected overlayVariant(action: InfoCardOverlayAction | null | undefined): InfoCardOverlayVariant {
    return action?.variant ?? 'badge';
  }

  protected overlayLayout(action: InfoCardOverlayAction | null | undefined): InfoCardOverlayLayout {
    return action?.layout ?? 'default';
  }

  protected overlayTone(action: InfoCardOverlayAction | null | undefined): InfoCardOverlayTone {
    return action?.tone ?? 'default';
  }

  protected overlayLeadingAccessory(action: InfoCardOverlayAction | null | undefined): InfoCardOverlayAccessory | null {
    return action?.leadingAccessory ?? null;
  }

  protected overlayLabel(action: InfoCardOverlayAction | null | undefined): string {
    if (!action) {
      return '';
    }
    if (action.selected && action.selectedLabel) {
      return action.selectedLabel;
    }
    return action.label ?? '';
  }

  protected overlayDetailLabel(action: InfoCardOverlayAction | null | undefined): string {
    return action?.detailLabel ?? '';
  }

  protected overlayIcon(action: InfoCardOverlayAction | null | undefined): string | null {
    if (!action) {
      return null;
    }
    if (action.selected && action.selectedIcon) {
      return action.selectedIcon;
    }
    return action.icon ?? null;
  }

  protected overlayDetailIcon(action: InfoCardOverlayAction | null | undefined): string | null {
    return action?.detailIcon ?? null;
  }

  protected visibleMetaRows(): readonly string[] {
    const rows = this.card?.metaRows ?? [];
    const limit = this.card?.metaRowsLimit;
    if (!Number.isFinite(limit as number) || (limit as number) <= 0) {
      return rows;
    }
    return rows.slice(0, Math.trunc(limit as number));
  }

  protected descriptionLines(): number {
    const value = Math.trunc(Number(this.card?.descriptionLines));
    return Number.isFinite(value) && value > 0 ? value : 3;
  }

  protected detailStyle(): InfoCardDetailStyle {
    return this.card?.detailStyle ?? 'default';
  }

  protected hasMenuActions(): boolean {
    return (this.card?.menuActions?.length ?? 0) > 0;
  }

  protected hasFooterChips(): boolean {
    return (this.card?.footerChips?.length ?? 0) > 0;
  }

  protected trackByActionId(index: number, action: InfoCardMenuAction): string | number {
    // Keep menu buttons stable while the menu is open; recreating them can
    // interact badly with the document-level pointerdown closer.
    return action.id;
  }

  protected trackByFooterChip(index: number, chip: InfoCardFooterChip): string | number {
    return `${chip.label}:${chip.toneClass ?? ''}:${index}`;
  }

  protected menuActionClass(action: InfoCardMenuAction): string {
    return `ui-info-card__menu-action--${action.tone ?? 'default'}`;
  }

  protected rootClassList(): string[] {
    const classes = ['ui-info-card'];
    if (this.card?.surfaceTone && this.card.surfaceTone !== 'default') {
      classes.push(`ui-info-card--tone-${this.card.surfaceTone}`);
    }
    if (this.card?.state && this.card.state !== 'default') {
      classes.push(`ui-info-card--state-${this.card.state}`);
    }
    if (this.card?.clickable) {
      classes.push('ui-info-card--clickable');
    }
    if (this.menuOpen) {
      classes.push('ui-info-card--menu-open');
    }
    return classes;
  }

  private syncMobileViewFromViewport(): void {
    if (typeof window === 'undefined') {
      this.isMobileView = false;
      return;
    }
    const next = window.innerWidth <= InfoCardComponent.MOBILE_BREAKPOINT_PX;
    if (next === this.isMobileView) {
      return;
    }
    this.isMobileView = next;
    this.cdr.markForCheck();
  }

  private shouldOpenMenuUp(trigger: HTMLElement | null): boolean {
    if (this.isMobileView || typeof window === 'undefined' || !trigger) {
      return false;
    }
    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const estimatedMenuHeight = 248;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    return spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
  }
}
