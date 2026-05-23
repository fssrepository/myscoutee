import { AfterViewInit, Directive, ElementRef, Input, OnChanges, OnDestroy, Renderer2, SimpleChanges } from '@angular/core';

@Directive({
  selector: '[appLazyBgImage]',
  standalone: true
})
export class LazyBgImageDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input() appLazyBgImage: string | null = null;
  @Input() appLazyHtmlImages: boolean | string | null = false;
  @Input() appLazyImageFallback: string | null = null;

  private static readonly PRELOAD_ROOT_MARGIN = '1200px 0px';
  private static readonly DEFAULT_IMAGE_FALLBACK_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540">
  <rect width="960" height="540" rx="36" fill="#edf4fd"/>
  <rect x="36" y="36" width="888" height="468" rx="28" fill="#f7fbff" stroke="#c8d8ee" stroke-width="4" stroke-dasharray="18 14"/>
  <path d="M352 334l78-92 64 68 46-48 96 112H312z" fill="#c7d8ee"/>
  <circle cx="594" cy="198" r="38" fill="#d8e5f5"/>
  <rect x="300" y="146" width="360" height="250" rx="28" fill="none" stroke="#91abc9" stroke-width="20"/>
  <text x="480" y="444" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#5c7595">No image</text>
</svg>
`)}`;
  private static readonly loadedUrls = new Set<string>();
  private static readonly loadingPromises = new Map<string, Promise<boolean>>();

  private readonly loadingClass = 'lazy-bg-loading';
  private readonly loadedClass = 'lazy-bg-loaded';
  private readonly errorClass = 'lazy-bg-error';
  private observer: IntersectionObserver | null = null;
  private htmlImageObserver: MutationObserver | null = null;
  private hasLoaded = false;
  private isViewReady = false;
  private currentUrl: string | null = null;
  private appliedUrl: string | null = null;
  private readonly htmlImageLoadHandler = (event: Event) => {
    const image = event.target instanceof HTMLImageElement ? event.target : null;
    if (!image) {
      return;
    }
    image.classList.remove('lazy-image-loading');
    image.classList.add('lazy-image-loaded');
  };
  private readonly htmlImageErrorHandler = (event: Event) => {
    const image = event.target instanceof HTMLImageElement ? event.target : null;
    if (!image) {
      return;
    }
    this.applyHtmlImageFallback(image);
  };

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2
  ) {}

  ngAfterViewInit(): void {
    this.isViewReady = true;
    this.currentUrl = this.normalizeUrl(this.appLazyBgImage);
    this.syncHtmlImageMode();
    this.syncBackgroundMode();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['appLazyBgImage'];
    if (change) {
      const nextUrl = this.normalizeUrl(change.currentValue as string | null);
      if (nextUrl !== this.currentUrl) {
        this.currentUrl = nextUrl;
        this.hasLoaded = false;
      }
    }
    if (!this.isViewReady) {
      return;
    }
    this.syncHtmlImageMode();
    this.syncBackgroundMode();
  }

  ngOnDestroy(): void {
    this.disconnectObserver();
    this.disconnectHtmlImageObserver();
    this.detachHtmlImageHandlers();
  }

  private syncBackgroundMode(): void {
    if (this.shouldManageBackground()) {
      this.setupObserver();
      return;
    }
    this.disconnectObserver();
    this.clearBackgroundState();
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
        this.applyBackgroundFallback();
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
          this.applyBackgroundFallback();
        });
        this.disconnectObserver();
      },
      { rootMargin: LazyBgImageDirective.PRELOAD_ROOT_MARGIN }
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

  private applyBackgroundFallback(): void {
    const fallbackUrl = this.imageFallbackUrl();
    this.renderer.setStyle(this.elementRef.nativeElement, 'background-image', `url("${fallbackUrl}")`);
    this.renderer.removeClass(this.elementRef.nativeElement, this.loadingClass);
    this.renderer.addClass(this.elementRef.nativeElement, this.loadedClass);
    this.renderer.addClass(this.elementRef.nativeElement, this.errorClass);
    this.appliedUrl = fallbackUrl;
    this.hasLoaded = true;
  }

  private clearBackgroundState(): void {
    this.renderer.removeStyle(this.elementRef.nativeElement, 'background-image');
    this.renderer.removeClass(this.elementRef.nativeElement, this.loadingClass);
    this.renderer.removeClass(this.elementRef.nativeElement, this.loadedClass);
    this.renderer.removeClass(this.elementRef.nativeElement, this.errorClass);
    this.appliedUrl = null;
    this.hasLoaded = false;
  }

  private disconnectObserver(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private syncHtmlImageMode(): void {
    if (!this.htmlImagesEnabled()) {
      this.disconnectHtmlImageObserver();
      this.detachHtmlImageHandlers();
      return;
    }
    this.refreshHtmlImages();
    this.observeHtmlImages();
  }

  private observeHtmlImages(): void {
    if (typeof MutationObserver === 'undefined') {
      return;
    }
    this.htmlImageObserver?.disconnect();
    this.htmlImageObserver = new MutationObserver(() => this.refreshHtmlImages());
    this.htmlImageObserver.observe(this.elementRef.nativeElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
  }

  private disconnectHtmlImageObserver(): void {
    this.htmlImageObserver?.disconnect();
    this.htmlImageObserver = null;
  }

  private refreshHtmlImages(): void {
    for (const image of this.htmlImages()) {
      if (image.dataset['lazyImageWired'] !== 'true') {
        image.dataset['lazyImageWired'] = 'true';
        image.addEventListener('load', this.htmlImageLoadHandler);
        image.addEventListener('error', this.htmlImageErrorHandler);
      }
      if (!image.hasAttribute('loading')) {
        image.loading = 'lazy';
      }
      if (!image.hasAttribute('decoding')) {
        image.decoding = 'async';
      }
      const src = image.getAttribute('src')?.trim() ?? '';
      if (!src) {
        this.applyHtmlImageFallback(image);
        continue;
      }
      if (image.dataset['lazyImageManagedSrc'] !== src) {
        image.dataset['lazyImageManagedSrc'] = src;
        if (src !== this.imageFallbackUrl()) {
          delete image.dataset['lazyImageFallbackActive'];
          image.classList.remove('lazy-image-fallback-active');
        }
      }
      if (image.complete) {
        if (image.naturalWidth > 0 || image.dataset['lazyImageFallbackActive'] === 'true') {
          image.classList.remove('lazy-image-loading');
          image.classList.add('lazy-image-loaded');
        } else {
          this.applyHtmlImageFallback(image);
        }
      } else {
        image.classList.add('lazy-image-loading');
        image.classList.remove('lazy-image-loaded');
      }
    }
  }

  private applyHtmlImageFallback(image: HTMLImageElement): void {
    if (image.dataset['lazyImageFallbackActive'] === 'true') {
      return;
    }
    const fallbackUrl = this.imageFallbackUrl();
    image.dataset['lazyImageFallbackActive'] = 'true';
    image.dataset['lazyImageOriginalSrc'] = image.getAttribute('src')?.trim() ?? '';
    image.dataset['lazyImageManagedSrc'] = fallbackUrl;
    image.classList.remove('lazy-image-loading');
    image.classList.add('lazy-image-loaded', 'lazy-image-fallback-active');
    image.alt = image.alt?.trim() || 'No image';
    image.src = fallbackUrl;
  }

  private detachHtmlImageHandlers(): void {
    for (const image of this.htmlImages()) {
      image.removeEventListener('load', this.htmlImageLoadHandler);
      image.removeEventListener('error', this.htmlImageErrorHandler);
      delete image.dataset['lazyImageWired'];
    }
  }

  private htmlImages(): HTMLImageElement[] {
    return Array.from(this.elementRef.nativeElement.querySelectorAll('img'));
  }

  private shouldManageBackground(): boolean {
    return Boolean(this.currentUrl) || !this.htmlImagesEnabled();
  }

  private normalizeUrl(url: string | null | undefined): string | null {
    const trimmed = url?.trim();
    return trimmed ? trimmed : null;
  }

  private htmlImagesEnabled(): boolean {
    return this.coerceBoolean(this.appLazyHtmlImages);
  }

  private coerceBoolean(value: boolean | string | null | undefined): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (value == null) {
      return false;
    }
    const normalized = `${value}`.trim().toLowerCase();
    return normalized !== '' && normalized !== 'false' && normalized !== '0';
  }

  private imageFallbackUrl(): string {
    return this.normalizeUrl(this.appLazyImageFallback) ?? LazyBgImageDirective.DEFAULT_IMAGE_FALLBACK_URL;
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
        const decodePromise = typeof img.decode === 'function'
          ? img.decode().catch(() => undefined)
          : Promise.resolve();
        decodePromise.then(() => {
          LazyBgImageDirective.loadedUrls.add(url);
          LazyBgImageDirective.loadingPromises.delete(url);
          resolve(true);
        });
      };
      img.onerror = () => {
        LazyBgImageDirective.loadingPromises.delete(url);
        resolve(false);
      };
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = url;
    });

    LazyBgImageDirective.loadingPromises.set(url, loadingPromise);
    return loadingPromise;
  }
}
