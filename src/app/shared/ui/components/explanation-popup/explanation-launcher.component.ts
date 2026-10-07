import { Component, DestroyRef, ElementRef, Input, afterEveryRender, computed, inject, signal, untracked } from '@angular/core';
import { ExplanationGuideService } from '../../../core/base/services/explanation-guide.service';
import { ExplanationPopupComponent } from './explanation-popup.component';
import { FloatingLauncherComponent } from '../core/floating-launcher/floating-launcher.component';
import { PopupPresenceStore } from '../../context/stores/popup-presence.store';
import type { AppMenuDragPosition, AppMenuTrigger } from '../core/menu';

@Component({ selector: 'app-explanation-launcher', standalone: true,
  imports: [FloatingLauncherComponent, ExplanationPopupComponent],
  template: `
    @if (guide.launcherVisible()) {
      <div class="floating-launcher-rail" data-guide-surface="landing.guide" [class.is-embedded]="embedded" [style.z-index]="layer()">
        <app-floating-launcher class="explanation-guide-menu" data-guide-field="guide-launcher" [trigger]="trigger()" [position]="position()" [layer]="layer()"
          (positionChange)="position.set($event)" (dismissed)="guide.dismissLauncher()"
          (itemSelect)="$event.sourceEvent.stopPropagation(); guide.openCurrent()"></app-floating-launcher>
      </div>
    }
    @defer (when guide.popupOpen()) { <app-explanation-popup></app-explanation-popup> }`,
  styles: [`.floating-launcher-rail { position: fixed; right: 1.4rem;
    bottom: calc(2.75rem + env(safe-area-inset-bottom, 0px)); pointer-events: none; }
    .floating-launcher-rail.is-embedded { position: relative; right: auto; bottom: auto; }
    @media (max-width: 720px) { .floating-launcher-rail { right: .8rem; } }`]
})
export class ExplanationLauncherComponent {
  @Input() embedded = false;
  @Input() introduce = false;
  protected readonly guide = inject(ExplanationGuideService);
  private readonly popups = inject(PopupPresenceStore);
  protected readonly position = signal<AppMenuDragPosition>({ x: 0, y: 0 });
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterEveryRender({ read: () => {
      // Once offered (or skipped for a returning visitor), stop measuring the
      // launcher on subsequent renders. Eligibility belongs to the guide.
      if (!this.introduce || !this.guide.canOfferLauncherIntroduction()) return;
      const button = host.querySelector<HTMLElement>('.explanation-guide-menu button');
      if (button?.getClientRects().length && getComputedStyle(button).visibility !== 'hidden') {
        untracked(() => this.guide.offerLauncherIntroduction());
      }
    } });
    inject(DestroyRef).onDestroy(() => {
      if (this.guide.currentContextKey() === 'landing.guide') this.guide.closePopup();
    });
  }
  protected readonly layer = computed(() => Math.max(24060, this.popups.topLayer() + 2));
  protected readonly trigger = computed<AppMenuTrigger>(() => ({
    id: 'explanation-guide', icon: 'tips_and_updates',
    palette: this.guide.hasVisiblePopup() ? 'brand' : 'neutral-strong', action: 'custom',
    hideLabel: true, ariaLabel: 'explanations'
  }));
}
