import { NgComponentOutlet } from '@angular/common';
import { Component, DestroyRef, ElementRef, ErrorHandler, Input, type Type, afterEveryRender, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  ExplanationGuideService,
  FloatingLauncherComponent,
  IndicatorComponent,
  type IndicatorTone,
  I18nPipe,
  PopupPresenceStore,
  type AppMenuDragPosition,
  type AppMenuTrigger
} from '@fssrepository/myscoutee-components';
import { AppSetupStore } from '../../context/stores/app/app-setup.store';
import { POPUP_ADAPTER } from '../../context/popup-adapter-loaders';
import { PopupAdapterProxyService } from '../../context/popup-adapter-proxy.service';

@Component({ selector: 'app-explanation-launcher', standalone: true,
  imports: [FloatingLauncherComponent, NgComponentOutlet, IndicatorComponent, I18nPipe],
  template: `
    @if (guide.popupOpen() && (guide.loading() || !guide.hasVisiblePopup())) {
      <div class="explanation-guide-loading" role="status" aria-busy="true"
        [style.z-index]="layer() - 1" [attr.aria-label]="'loading.explanation.content' | i18n">
        @if (guide.loading()) {
          <app-indicator kind="load-ring" state="loading" [tone]="loadingTone"></app-indicator>
        }
      </div>
    }
    @if (guide.launcherVisible() || setup.launcherVisible()) {
      <div class="floating-launcher-rail" data-guide-surface="landing.guide" [class.is-embedded]="embedded" [style.z-index]="layer()">
        @if (setup.launcherVisible()) {
          <app-floating-launcher class="setup-launcher" data-guide-field="setup-launcher"
            [trigger]="setupTrigger()" [position]="setup.dragPosition()" [layer]="layer()"
            (positionChange)="setup.dragPosition.set($event)" (dismissed)="setup.launcherDismissed.set(true)"
            (itemSelect)="$event.sourceEvent.stopPropagation(); guide.closePopup(); setup.open()"></app-floating-launcher>
        }
        @if (guide.launcherVisible()) {
        <app-floating-launcher class="explanation-guide-menu" data-guide-field="guide-launcher" [style.visibility]="guide.popupOpen() ? 'visible' : null" [trigger]="trigger()" [position]="position()" [layer]="layer()"
          (positionChange)="position.set($event)" (dismissed)="guide.dismissLauncher()"
          (itemSelect)="$event.sourceEvent.stopPropagation(); guide.openCurrent()"></app-floating-launcher>
        }
      </div>
    }
    @if (guide.popupOpen() && !guide.loading()) {
      <ng-container *ngComponentOutlet="popupComponent()"></ng-container>
    }`,
  styles: [`.explanation-guide-loading { position: fixed; inset: 0; display: grid; place-items: center;
    background: rgba(10, 18, 37, 0.73); }
    .floating-launcher-rail { position: fixed; right: 1.4rem;
    display: flex; flex-direction: column; align-items: flex-end; gap: 1rem;
    bottom: calc(2.75rem + env(safe-area-inset-bottom, 0px)); pointer-events: none; }
    .floating-launcher-rail.is-embedded { position: relative; right: auto; bottom: auto; }
    @media (max-width: 720px) { .floating-launcher-rail { right: .8rem; } }`]
})
export class ExplanationLauncherComponent {
  @Input() embedded = false;
  @Input() introduce = false;
  @Input() loadingTone: IndicatorTone = 'bright';
  protected readonly guide = inject(ExplanationGuideService);
  protected readonly setup = inject(AppSetupStore);
  private readonly popups = inject(PopupPresenceStore);
  private readonly popupAdapters = inject(PopupAdapterProxyService);
  private readonly errors = inject(ErrorHandler);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tourComponent = signal<Type<unknown> | null>(null);
  private readonly documentComponent = signal<Type<unknown> | null>(null);
  protected readonly popupComponent = computed(() => this.guide.popupMode() === 'tour'
    ? this.tourComponent() : this.documentComponent());
  protected readonly position = signal<AppMenuDragPosition>({ x: 0, y: 0 });
  constructor() {
    effect(() => {
      if (!this.guide.popupOpen() || this.guide.loading() || this.popupComponent()) return;
      const loading = this.guide.popupMode() === 'tour'
        ? this.popupAdapters.load(POPUP_ADAPTER.EXPLANATION_GUIDE)
          .then(module => { if (!this.destroyRef.destroyed) this.tourComponent.set(module.ExplanationGuideOverlayComponent); })
        : this.popupAdapters.load(POPUP_ADAPTER.EXPLANATION_DOCUMENT)
          .then(module => { if (!this.destroyRef.destroyed) this.documentComponent.set(module.ExplanationPopupComponent); });
      void loading.catch(error => this.errors.handleError(error));
    });
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterEveryRender({ read: () => {
      if (this.setup.guideRequested() && !this.guide.popupOpen()) {
        // A new sign-in action can introduce setup after the guide was dragged away.
        // Keep the user's explicit guide-enabled preference.
        untracked(() => this.guide.beginVisit());
        const setupButton = host.querySelector<HTMLElement>('.setup-launcher button');
        if (this.guide.launcherVisible() && setupButton?.getClientRects().length) untracked(() => this.guide.openCurrent());
      }
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
  protected readonly setupTrigger = computed<AppMenuTrigger>(() => ({
    id: 'app-setup', icon: this.setup.launcherIcon(), palette: this.setup.launcherPalette(),
    counter: this.setup.missingCount(), hideLabel: true, action: 'custom', ariaLabel: 'app.setup.title'
  }));
  // Opening/loading/positioning are already guide mode; keep its launcher stable.
  protected readonly trigger = computed<AppMenuTrigger>(() => ({
    id: 'explanation-guide', icon: 'tips_and_updates',
    palette: this.guide.popupOpen() ? 'brand' : 'neutral-strong', action: 'custom',
    hideLabel: true, ariaLabel: 'explanations'
  }));
}
