import { AfterViewInit, Directive, ElementRef, Input, OnChanges, OnDestroy, Renderer2, SimpleChanges } from '@angular/core';

@Directive({
  selector: '[appLazyBgImage]',
  standalone: true
})
export class LazyBgImageDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input() appLazyBgImage: string | null = null;

  private static readonly loadedUrls = new Set<string>();
  private static readonly loadingPromises = new Map<string, Promise<boolean>>();

  private readonly loadingClass = 'lazy-bg-loading';
  private readonly loadedClass = 'lazy-bg-loaded';
  private readonly errorClass = 'lazy-bg-error';
  private observer: IntersectionObserver | null = null;
  private hasLoaded = false;
  private isViewReady = false;
  private currentUrl: string | null = null;
  private appliedUrl: string | null = null;

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2
  ) {}

  ngAfterViewInit(): void {
    this.isViewReady = true;
    this.currentUrl = this.normalizeUrl(this.appLazyBgImage);
    this.setupObserver();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['appLazyBgImage'];
    if (!change) {
      return;
    }
    const nextUrl = this.normalizeUrl(change.currentValue as string | null);
    if (nextUrl === this.currentUrl) {
      return;
    }
    this.currentUrl = nextUrl;
    this.hasLoaded = false;
    if (!this.isViewReady) {
      return;
    }
    this.setupObserver();
  }

  ngOnDestroy(): void {
    this.disconnectObserver();
  }

  private setupObserver(): void {
    this.disconnectObserver();
    this.renderer.addClass(this.elementRef.nativeElement, this.loadingClass);
    this.renderer.removeClass(this.elementRef.nativeElement, this.loadedClass);
    this.renderer.removeClass(this.elementRef.nativeElement, this.errorClass);

    const url = this.currentUrl;
    if (!url) {
      this.applyLoadError();
      return;
    }

    if (LazyBgImageDirective.loadedUrls.has(url)) {
      this.applyBackground(url);
      return;
    }

    if (this.hasLoaded && this.appliedUrl === url) {
      this.renderer.removeClass(this.elementRef.nativeElement, this.loadingClass);
      this.renderer.addClass(this.elementRef.nativeElement, this.loadedClass);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      this.preloadUrl(url).then(loaded => {
        if (this.currentUrl !== url) {
          return;
        }
        if (loaded) {
          this.applyBackground(url);
          return;
        }
        this.applyLoadError();
      });
      return;
    }

    this.observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) {
          return;
        }
        this.preloadUrl(url).then(loaded => {
          if (this.currentUrl !== url) {
            return;
          }
          if (loaded) {
            this.applyBackground(url);
            return;
          }
          this.applyLoadError();
        });
        this.disconnectObserver();
      },
      { rootMargin: '200px 0px' }
    );

    this.observer.observe(this.elementRef.nativeElement);
  }

  private applyBackground(url: string): void {
    if (this.hasLoaded && this.appliedUrl === url) {
      return;
    }
    this.renderer.setStyle(this.elementRef.nativeElement, 'background-image', `url("${url}")`);
    this.renderer.removeClass(this.elementRef.nativeElement, this.errorClass);
    this.renderer.removeClass(this.elementRef.nativeElement, this.loadingClass);
    this.renderer.addClass(this.elementRef.nativeElement, this.loadedClass);
    LazyBgImageDirective.loadedUrls.add(url);
    this.appliedUrl = url;
    this.hasLoaded = true;
  }

  private applyLoadError(): void {
    this.renderer.removeStyle(this.elementRef.nativeElement, 'background-image');
    this.renderer.removeClass(this.elementRef.nativeElement, this.loadingClass);
    this.renderer.removeClass(this.elementRef.nativeElement, this.loadedClass);
    this.renderer.addClass(this.elementRef.nativeElement, this.errorClass);
    this.appliedUrl = null;
    this.hasLoaded = false;
  }

  private disconnectObserver(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private normalizeUrl(url: string | null | undefined): string | null {
    const trimmed = url?.trim();
    return trimmed ? trimmed : null;
  }

  private preloadUrl(url: string): Promise<boolean> {
    if (LazyBgImageDirective.loadedUrls.has(url)) {
      return Promise.resolve(true);
    }

    const existingPromise = LazyBgImageDirective.loadingPromises.get(url);
    if (existingPromise) {
      return existingPromise;
    }

    const loadingPromise = new Promise<boolean>(resolve => {
      const img = new Image();
      img.onload = () => {
        LazyBgImageDirective.loadedUrls.add(url);
        LazyBgImageDirective.loadingPromises.delete(url);
        resolve(true);
      };
      img.onerror = () => {
        LazyBgImageDirective.loadingPromises.delete(url);
        resolve(false);
      };
      img.src = url;
    });

    LazyBgImageDirective.loadingPromises.set(url, loadingPromise);
    return loadingPromise;
  }
}
