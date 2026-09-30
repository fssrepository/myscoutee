import { Component, Input, computed, inject, signal } from '@angular/core';
import { ExplanationGuideService } from '../../../core/base/services/explanation-guide.service';
import { ExplanationPopupComponent } from './explanation-popup.component';
import { FloatingLauncherComponent } from '../core/floating-launcher/floating-launcher.component';
import { PopupPresenceStore } from '../../context/stores/popup-presence.store';
import type { AppMenuDragPosition, AppMenuTrigger } from '../core/menu';

@Component({ selector: 'app-explanation-launcher', standalone: true,
  imports: [FloatingLauncherComponent, ExplanationPopupComponent],
  template: `
    @if (guide.launcherVisible()) {
      <div class="floating-launcher-rail" [class.is-embedded]="embedded" [style.z-index]="layer()">
        <app-floating-launcher class="explanation-guide-menu" [trigger]="trigger()" [position]="position()" [layer]="layer()"
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
  protected readonly guide = inject(ExplanationGuideService);
  private readonly popups = inject(PopupPresenceStore);
  protected readonly position = signal<AppMenuDragPosition>({ x: 0, y: 0 });
  protected readonly layer = computed(() => Math.max(24060, this.popups.topLayer() + 2));
  protected readonly trigger = computed<AppMenuTrigger>(() => ({
    id: 'explanation-guide', icon: 'tips_and_updates',
    palette: this.guide.popupOpen() ? 'brand' : 'neutral-strong', action: 'custom',
    hideLabel: true, ariaLabel: 'explanations'
  }));
}
