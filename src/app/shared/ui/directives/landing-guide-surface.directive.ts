import { Directive, Input, OnChanges, OnDestroy, inject } from '@angular/core';
import { LANDING_EXPLANATION_GUIDE } from '../../core/base/services/landing-explanation-guide';

@Directive({ selector: '[appLandingGuideSurface]', standalone: true,
  host: { '[attr.data-guide-surface]': 'appLandingGuideSurface' } })
export class LandingGuideSurfaceDirective implements OnChanges, OnDestroy {
  @Input({ required: true }) appLandingGuideSurface: string | null = '';
  private readonly guide = inject(LANDING_EXPLANATION_GUIDE);
  private unregister?: () => void;
  ngOnChanges(): void {
    this.unregister?.();
    this.unregister = this.guide.registerContext(this.appLandingGuideSurface);
  }
  ngOnDestroy(): void { this.unregister?.(); }
}
