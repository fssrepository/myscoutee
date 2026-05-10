import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  inject
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { LazyBgImageDirective } from '../../../directives/lazy-bg-image.directive';
import { I18nPipe } from '../../../../i18n';
import { CounterBadgePipe } from '../../../pipes/counter-badge.pipe';
import type {
  InfoCardClickEvent,
  InfoCardData,
  InfoCardFooterChip,
  InfoCardMenuAction,
  InfoCardMenuActionConfig,
  InfoCardMenuActionEvent,
  InfoCardResolvedMenuAction,
  InfoCardMenuRequestEvent,
  InfoCardMenuTriggerRect,
  InfoCardOverlayAccessory,
  InfoCardOverlayLayout,
  InfoCardOverlayAction,
  InfoCardDetailStyle,
  InfoCardOverlayTone,
  InfoCardOverlayVariant
} from '../card.types';
import { INFO_CARD_AVAILABLE_ACTIONS } from '../card.types';

@Component({
  selector: 'app-info-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, LazyBgImageDirective, CounterBadgePipe, I18nPipe],
  templateUrl: './info-card.component.html',
  styleUrl: './info-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InfoCardComponent implements OnDestroy {
  private static readonly MOBILE_BREAKPOINT_PX = 760;
  private static activeSharedMenuInstance: InfoCardComponent | null = null;
  private static activeDocumentMenuInstance: InfoCardComponent | null = null;
  private static documentPointerDownListener: ((event: PointerEvent) => void) | null = null;
  private static documentPointerDownTarget: Document | null = null;
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly availableActions = INFO_CARD_AVAILABLE_ACTIONS;

  @Input() card: InfoCardData | null = null;
  @Input() useSharedMenu = false;

  @Output() readonly cardClick = new EventEmitter<InfoCardClickEvent>();
  @Output() readonly mediaStartClick = new EventEmitter<InfoCardClickEvent>();
  @Output() readonly mediaEndClick = new EventEmitter<InfoCardClickEvent>();
  @Output() readonly menuAction = new EventEmitter<InfoCardMenuActionEvent>();
  @Output() readonly menuRequest = new EventEmitter<InfoCardMenuRequestEvent>();

  protected isMobileView = false;
  protected menuOpen = false;
  protected menuOpenUp = false;

  protected get menuTriggerOpen(): boolean {
    return this.menuOpen;
  }

  constructor() {
    this.syncMobileViewFromViewport();
  }

  ngOnDestroy(): void {
    if (InfoCardComponent.activeSharedMenuInstance === this) {
      InfoCardComponent.activeSharedMenuInstance = null;
    }
    if (InfoCardComponent.activeDocumentMenuInstance === this) {
      InfoCardComponent.clearDocumentMenuInstance(this);
    }
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
    const trigger = event.currentTarget as HTMLElement | null;
    if (this.useSharedMenu) {
      const wasOpen = this.menuOpen;
      if (wasOpen) {
        this.closeMenu();
        if (InfoCardComponent.activeSharedMenuInstance === this) {
          InfoCardComponent.activeSharedMenuInstance = null;
        }
      } else {
        InfoCardComponent.activeSharedMenuInstance?.closeMenu();
        InfoCardComponent.activeSharedMenuInstance = this;
        this.menuOpenUp = this.shouldOpenMenuUp(trigger);
        this.menuOpen = true;
        this.cdr.markForCheck();
      }
      this.menuRequest.emit({
        rowId: this.card.rowId,
        card: this.card,
        actions: this.card.menuActions,
        triggerRect: this.resolveMenuTriggerRect(trigger),
        openUp: this.shouldOpenMenuUp(trigger),
        closeTrigger: () => this.closeMenu()
      });
      return;
    }
    if (this.menuOpen) {
      this.closeMenu();
      return;
    }
    InfoCardComponent.activeDocumentMenuInstance?.closeMenu();
    InfoCardComponent.setDocumentMenuInstance(this);
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
    if (InfoCardComponent.activeSharedMenuInstance === this) {
      InfoCardComponent.activeSharedMenuInstance = null;
    }
    if (InfoCardComponent.activeDocumentMenuInstance === this) {
      InfoCardComponent.clearDocumentMenuInstance(this);
    }
    this.cdr.markForCheck();
  }

  protected onMenuActionSelected(
    action: InfoCardMenuAction,
    config: InfoCardMenuActionConfig,
    event: Event
  ): void {
    if (!this.card) {
      return;
    }
    const resolvedAction: InfoCardResolvedMenuAction = {
      id: action,
      ...config
    };
    event.preventDefault();
    event.stopPropagation();
    this.menuAction.emit({
      rowId: this.card.rowId,
      actionId: resolvedAction.id,
      action: resolvedAction,
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

  protected overlayProgressRing(action: InfoCardOverlayAction | null | undefined): boolean {
    return action?.progressRing === true;
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

  protected resolvedMenuTitle(): string {
    if (this.card?.menuTitle === null) {
      return '';
    }
    return `${this.card?.menuTitle ?? this.card?.title ?? ''}`.trim();
  }

  protected hasFooterChips(): boolean {
    return (this.card?.footerChips?.length ?? 0) > 0;
  }

  protected trackByActionId(index: number, action: InfoCardMenuAction): string | number {
    // Keep menu buttons stable while the menu is open; recreating them can
    // interact badly with the document-level pointerdown closer.
    return action || index;
  }

  protected trackByFooterChip(index: number, chip: InfoCardFooterChip): string | number {
    return `${chip.label}:${chip.toneClass ?? ''}:${index}`;
  }

  protected rootClassList(): string[] {
    const classes = ['ui-info-card'];
    if ((this.card?.rowId ?? '').startsWith('asset:')) {
      classes.push('ui-info-card--owned-asset');
    }
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

  private resolveMenuTriggerRect(trigger: HTMLElement | null): InfoCardMenuTriggerRect | null {
    if (typeof window === 'undefined' || !trigger) {
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

  private static setDocumentMenuInstance(instance: InfoCardComponent): void {
    InfoCardComponent.activeDocumentMenuInstance = instance;
    InfoCardComponent.ensureDocumentPointerDownListener(instance.hostRef.nativeElement.ownerDocument);
  }

  private static clearDocumentMenuInstance(instance: InfoCardComponent): void {
    if (InfoCardComponent.activeDocumentMenuInstance !== instance) {
      return;
    }
    InfoCardComponent.activeDocumentMenuInstance = null;
    InfoCardComponent.releaseDocumentPointerDownListener();
  }

  private static ensureDocumentPointerDownListener(documentRef: Document): void {
    if (
      InfoCardComponent.documentPointerDownListener
      && InfoCardComponent.documentPointerDownTarget === documentRef
    ) {
      return;
    }
    InfoCardComponent.releaseDocumentPointerDownListener();
    const listener = (event: PointerEvent) => InfoCardComponent.onDocumentPointerDown(event);
    documentRef.addEventListener('pointerdown', listener);
    InfoCardComponent.documentPointerDownListener = listener;
    InfoCardComponent.documentPointerDownTarget = documentRef;
  }

  private static releaseDocumentPointerDownListener(): void {
    if (!InfoCardComponent.documentPointerDownListener || !InfoCardComponent.documentPointerDownTarget) {
      return;
    }
    InfoCardComponent.documentPointerDownTarget.removeEventListener(
      'pointerdown',
      InfoCardComponent.documentPointerDownListener
    );
    InfoCardComponent.documentPointerDownListener = null;
    InfoCardComponent.documentPointerDownTarget = null;
  }

  private static onDocumentPointerDown(event: PointerEvent): void {
    const instance = InfoCardComponent.activeDocumentMenuInstance;
    if (!instance?.menuOpen) {
      return;
    }
    const target = event.target;
    if (target instanceof Node && instance.hostRef.nativeElement.contains(target)) {
      return;
    }
    instance.closeMenu();
  }

}
