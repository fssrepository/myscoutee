import { Component, DestroyRef, ElementRef, EventEmitter, Input, Output, ViewChild, afterEveryRender, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AppMenuComponent, type AppMenuDragEvent, type AppMenuDragPosition, type AppMenuItemSelectEvent, type AppMenuTrigger } from '../menu';

@Component({ selector: 'app-floating-launcher', standalone: true,
  imports: [AppMenuComponent, MatIconModule],
  templateUrl: './floating-launcher.component.html', styleUrl: './floating-launcher.component.scss' })
export class FloatingLauncherComponent {
  @Input({ required: true }) trigger!: AppMenuTrigger;
  @Input() position: AppMenuDragPosition = { x: 0, y: 0 };
  @Input() layer = 24060;
  @Output() readonly positionChange = new EventEmitter<AppMenuDragPosition>();
  @Output() readonly itemSelect = new EventEmitter<AppMenuItemSelectEvent>();
  @Output() readonly dismissed = new EventEmitter<void>();
  @ViewChild('dismissTarget') private dismissTarget?: ElementRef<HTMLElement>;
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly lift = signal(0);
  private ratingPanelAnchor = false;
  private frame = 0;
  protected readonly dragging = signal(false);
  protected readonly targeted = signal(false);
  protected get displayPosition(): AppMenuDragPosition {
    return { x: this.position.x, y: this.position.y - this.lift() };
  }

  constructor() {
    // Recheck actual geometry after rendering and scrolling, without polling.
    afterEveryRender({ read: () => this.avoidActions() });
    const document = this.host.nativeElement.ownerDocument;
    const window = document.defaultView;
    const schedule = () => {
      if (!window || this.frame) return;
      this.frame = window.requestAnimationFrame(() => {
        this.frame = 0;
        this.avoidActions();
      });
    };
    document.addEventListener('scroll', schedule, true);
    document.addEventListener('transitionend', schedule, true);
    window?.addEventListener('resize', schedule);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('scroll', schedule, true);
      document.removeEventListener('transitionend', schedule, true);
      window?.removeEventListener('resize', schedule);
      if (this.frame) window?.cancelAnimationFrame(this.frame);
    });
  }

  protected move(position: AppMenuDragPosition): void {
    this.positionChange.emit({ x: position.x, y: position.y + this.lift() });
  }

  protected drag(event: AppMenuDragEvent): void {
    if (event.phase === 'start') { this.dragging.set(true); this.targeted.set(false); return; }
    const rect = this.dismissTarget?.nativeElement.getBoundingClientRect();
    const hit = !!rect && Math.hypot(event.centerX - rect.left - rect.width / 2,
      event.centerY - rect.top - rect.height / 2) <= Math.max(rect.width, rect.height) / 2 + 10;
    if (event.phase === 'move') { this.targeted.set(hit); return; }
    this.dragging.set(false);
    this.targeted.set(false);
    if (event.phase === 'end' && hit) {
      this.positionChange.emit({ x: 0, y: 0 });
      this.dismissed.emit();
    } else if (event.moved && this.lift() && !this.ratingPanelAnchor) {
      // Dropping chooses the visible location, including the previous clearance.
      // Do not jump back down when dragging horizontally away from an obstacle.
      const position = this.displayPosition;
      this.lift.set(0);
      this.positionChange.emit(position);
    }
  }

  private avoidActions(): void {
    const host = this.host.nativeElement;
    const document = host.ownerDocument;
    const viewport = document.defaultView;
    const menu = host.querySelector('app-menu');
    if (this.dragging() || !viewport || !menu) return;
    if (viewport.innerWidth > 760) {
      this.ratingPanelAnchor = false;
      if (this.lift()) this.lift.set(0);
      return;
    }
    if (document.querySelector('.explanation-guide-overlay, .activities-rate-profile-stack.is-resizing')) return;
    const rail = host.closest<HTMLElement>('.floating-launcher-rail:not(.is-embedded)');
    const rates = document.querySelector('app-activities-popup .smart-list__surface--retained-fullscreen');
    if (rail && rates) {
      this.ratingPanelAnchor = true;
      // Anchor both launchers to the panel, independently of scrolling cards
      // and controls appearing/disappearing. Fullscreen has a fixed footer.
      const bottomInset = rates.closest('.activities-popup-rates-fullscreen') ? 96 : 56;
      const bottom = rates.getBoundingClientRect().bottom - bottomInset;
      const lift = rail.getBoundingClientRect().bottom - bottom;
      if (Math.abs(lift - this.lift()) > .5) this.lift.set(lift);
      return;
    }
    this.ratingPanelAnchor = false;
    // Measure the stable drag host, not a button's hover/pressed visual state.
    const rect = menu.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // Keep automatic clearance separate from the user's drag position.
    const baseTop = rect.top + this.lift();
    let top = baseTop;
    const gap = 8;
    const obstacles: { box: DOMRect; element?: HTMLElement; fullscreenCard?: HTMLElement | null }[] =
      [...document.querySelectorAll<HTMLElement>(
        '.document-viewer-actions, .rate__commit, .form-flow__save, .shared-card-profile-view-btn'
      )].flatMap(element => {
        // SmartList retains its list and neighbouring fullscreen cards. Their
        // controls cannot obstruct the launcher; don't measure hidden layouts.
        if (element.closest('[inert], .smart-list__stage-list-shell.is-occluded, .smart-list__fullscreen-card:not(.smart-list__fullscreen-card--active)')) return [];
        const box = element.getBoundingClientRect();
        if (!box.width || !box.height || box.bottom <= 0 || box.top >= viewport.innerHeight
          || rect.right + gap <= box.left || rect.left - gap >= box.right) return [];
        return [{ box, element, fullscreenCard: element.matches('.shared-card-profile-view-btn')
          ? element.closest<HTMLElement>('.smart-list__fullscreen-card--active') : null }];
      });
    // Earlier launchers yield upwards to later ones, preserving rail order and
    // preventing the notification and guide from pushing each other in a loop.
    for (const other of document.querySelectorAll('app-floating-launcher')) {
      if (!(host.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      const box = other.querySelector('app-menu')?.getBoundingClientRect();
      if (box?.width && rect.right + gap > box.left && rect.left - gap < box.right) obstacles.push({ box });
    }
    obstacles.sort((a, b) => b.box.top - a.box.top);
    // Hit-testing can force layout/paint. Only test actual collisions, once per
    // fullscreen card, instead of every eye in all retained list/card surfaces.
    const visibleSurfaces = new Map<HTMLElement, boolean>();
    for (const { box, element, fullscreenCard } of obstacles) {
      const reserveEyeRow = !!fullscreenCard && this.position.x === 0;
      if (!reserveEyeRow && !(top + rect.height + gap > box.top && top - gap < box.bottom)) continue;
      if (element) {
        const surface = fullscreenCard ?? element;
        let visible = visibleSurfaces.get(surface);
        if (visible === undefined) {
          const surfaceBox = fullscreenCard?.getBoundingClientRect() ?? box;
          const x = Math.max(0, Math.min(viewport.innerWidth - 1, (surfaceBox.left + surfaceBox.right) / 2));
          const y = Math.max(0, Math.min(viewport.innerHeight - 1, (surfaceBox.top + surfaceBox.bottom) / 2));
          let hit: Element | null | undefined = document.elementFromPoint(x, y);
          if (hit?.closest('app-floating-launcher')) {
            hit = document.elementsFromPoint(x, y).find(node => !node.closest('app-floating-launcher'));
          }
          visible = !!hit && surface.contains(hit);
          visibleSurfaces.set(surface, visible);
        }
        if (!visible) continue;
      }
      top = Math.min(top, box.top - gap - rect.height);
    }
    const lift = Math.max(0, baseTop - Math.max(gap, top));
    if (Math.abs(lift - this.lift()) > .5) this.lift.set(lift);
  }
}
