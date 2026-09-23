import { AfterViewInit, Directive, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, inject } from '@angular/core';

/** Reports actual clipped viewport exposure, never prefetch or rendered offscreen rows. */
@Directive({ selector: '[appViewportSeen]', standalone: true })
export class ViewportSeenDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input() appViewportSeen = false;
  @Output() readonly viewportSeen = new EventEmitter<void>();
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private observer?: IntersectionObserver;
  private reported = false;
  private initialized = false;
  private readonly onVisible = () => this.observe();
  ngAfterViewInit(): void {
    this.initialized = true;
    document.addEventListener('visibilitychange', this.onVisible);
    this.observe();
  }
  ngOnChanges(): void { if (this.initialized) this.observe(); }
  private observe(): void {
    this.observer?.disconnect();
    if (!this.appViewportSeen || this.reported || document.visibilityState !== 'visible') return;
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          const rect = entry.intersectionRect;
          if (!entry.isIntersecting || rect.width <= 0 || rect.height <= 0 || document.visibilityState !== 'visible') continue;
          const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          if (!top || !this.host.nativeElement.contains(top)) continue;
          this.reported = true;
          this.observer?.disconnect();
          // Deliberately stays outside Angular: this only appends to an in-memory outbox.
          this.viewportSeen.emit();
          break;
        }
      }, { rootMargin: '0px', threshold: [0, 0.01, 0.25, 0.5, 0.75, 1] });
      this.observer.observe(this.host.nativeElement);
    });
  }
  ngOnDestroy(): void {
    this.observer?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisible);
  }
}
