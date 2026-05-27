import { AfterViewInit, Directive, ElementRef, Input, OnChanges, OnDestroy, Renderer2, SimpleChanges, effect, inject } from '@angular/core';

import { I18nService } from '../../i18n';

@Directive({
  selector: '[appLazyBgImage]',
  standalone: true
})
export class LazyBgImageDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input() appLazyBgImage: string | null = null;
  @Input() appLazyHtmlImages: boolean | string | null = false;
  @Input() appLazyImageFallback: string | null = null;

  private static readonly PRELOAD_ROOT_MARGIN = '1200px 0px';
  private static readonly SEEDED_IMAGE_REF_PREFIX = 'help-seeded-image:';
  private static readonly SEEDED_IMAGE_ASSET_ROOT = 'assets/help-center/explanations';
  private static readonly HTML_IMAGE_PLACEHOLDER_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  private static readonly HTML_IMAGE_PLACEHOLDER_LAZY_SRC_MARKER = '#lazy-src=';
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
  private static readonly localizedSvgUrls = new Map<string, string>();
  private static readonly localizedSvgPromises = new Map<string, Promise<string | null>>();
  private static readonly nonSvgUrls = new Set<string>();

  private readonly i18n = inject(I18nService);
  private readonly loadingClass = 'lazy-bg-loading';
  private readonly loadedClass = 'lazy-bg-loaded';
  private readonly errorClass = 'lazy-bg-error';
  private observer: IntersectionObserver | null = null;
  private htmlImageObserver: MutationObserver | null = null;
  private hasLoaded = false;
  private isViewReady = false;
  private currentUrl: string | null = null;
  private appliedUrl: string | null = null;
  private readonly i18nRevisionEffect = effect(() => {
    this.i18n.revision();
    if (!this.isViewReady) {
      return;
    }
    this.refreshHtmlImages();
    if (this.shouldManageBackground() && this.currentUrl) {
      this.hasLoaded = false;
      this.setupObserver();
    }
  });
  private readonly htmlImageLoadHandler = (event: Event) => {
    const image = event.target instanceof HTMLImageElement ? event.target : null;
    if (!image) {
      return;
    }
    this.setHtmlImageLoadingState(image, false);
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

  static preloadImageUrl(url: string | null | undefined, options: { crossOrigin?: string | null } = {}): Promise<boolean> {
    const normalizedUrl = `${url ?? ''}`.trim();
    if (!normalizedUrl) {
      return Promise.resolve(false);
    }
    const cacheKey = options.crossOrigin === undefined
      ? normalizedUrl
      : `${options.crossOrigin ?? ''}:${normalizedUrl}`;
    if (LazyBgImageDirective.loadedUrls.has(cacheKey)) {
      return Promise.resolve(true);
    }

    const existingPromise = LazyBgImageDirective.loadingPromises.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const loadingPromise = new Promise<boolean>(resolve => {
      const img = new Image();
      if (options.crossOrigin !== undefined) {
        img.crossOrigin = options.crossOrigin ?? '';
      }
      img.onload = () => {
        const decodePromise = typeof img.decode === 'function'
          ? img.decode().catch(() => undefined)
          : Promise.resolve();
        decodePromise.then(() => {
          LazyBgImageDirective.loadedUrls.add(cacheKey);
          LazyBgImageDirective.loadingPromises.delete(cacheKey);
          resolve(true);
        });
      };
      img.onerror = () => {
        LazyBgImageDirective.loadingPromises.delete(cacheKey);
        resolve(false);
      };
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = normalizedUrl;
    });

    LazyBgImageDirective.loadingPromises.set(cacheKey, loadingPromise);
    return loadingPromise;
  }

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
    this.i18nRevisionEffect.destroy();
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

    const renderedUrl = this.renderedImageUrl(url);
    if (LazyBgImageDirective.loadedUrls.has(renderedUrl)) {
      this.applyBackground(renderedUrl);
      return;
    }

    if (this.hasLoaded && this.appliedUrl === renderedUrl) {
      this.renderer.removeClass(this.elementRef.nativeElement, this.loadingClass);
      this.renderer.addClass(this.elementRef.nativeElement, this.loadedClass);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      this.loadRenderableUrl(url).then(loadedUrl => {
        if (this.currentUrl !== url) {
          return;
        }
        if (loadedUrl) {
          this.applyBackground(loadedUrl);
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
        this.loadRenderableUrl(url).then(loadedUrl => {
          if (this.currentUrl !== url) {
            return;
          }
          if (loadedUrl) {
            this.applyBackground(loadedUrl);
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
      attributeFilter: ['src', 'data-lazy-src']
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
      const sourceUrl = this.htmlImageSourceUrl(image);
      const currentSrc = image.getAttribute('src')?.trim() ?? '';
      if (!sourceUrl) {
        this.applyHtmlImageFallback(image);
        continue;
      }
      image.dataset['lazyImageSourceUrl'] = sourceUrl;
      if (this.localizeHtmlSvgImage(image, sourceUrl)) {
        this.setHtmlImageLoadingState(image, true);
        continue;
      }
      const renderedSourceUrl = this.renderedImageUrl(sourceUrl);
      if (renderedSourceUrl && renderedSourceUrl !== currentSrc) {
        image.src = renderedSourceUrl;
      }
      if (image.dataset['lazyImageManagedSrc'] !== renderedSourceUrl) {
        image.dataset['lazyImageManagedSrc'] = renderedSourceUrl;
        if (renderedSourceUrl !== this.imageFallbackUrl()) {
          delete image.dataset['lazyImageFallbackActive'];
          this.setHtmlImageFallbackState(image, false);
        }
      }
      if (image.complete) {
        if (image.naturalWidth > 0 || image.dataset['lazyImageFallbackActive'] === 'true') {
          this.setHtmlImageLoadingState(image, false);
        } else {
          this.applyHtmlImageFallback(image);
        }
      } else {
        this.setHtmlImageLoadingState(image, true);
      }
    }
  }

  private applyHtmlImageFallback(image: HTMLImageElement): void {
    if (image.dataset['lazyImageFallbackActive'] === 'true') {
      this.setHtmlImageLoadingState(image, false);
      this.setHtmlImageFallbackState(image, true);
      return;
    }
    const fallbackUrl = this.imageFallbackUrl();
    image.dataset['lazyImageFallbackActive'] = 'true';
    image.dataset['lazyImageOriginalSrc'] = this.htmlImageSourceUrl(image);
    image.dataset['lazyImageManagedSrc'] = fallbackUrl;
    this.setHtmlImageLoadingState(image, false);
    this.setHtmlImageFallbackState(image, true);
    image.alt = image.alt?.trim() || 'No image';
    image.src = fallbackUrl;
  }

  private setHtmlImageLoadingState(image: HTMLImageElement, loading: boolean): void {
    image.classList.toggle('lazy-image-loading', loading);
    image.classList.toggle('lazy-image-loaded', !loading);

    const frame = this.htmlImageFrame(image);
    frame?.classList.toggle('lazy-image-frame-loading', loading);
    frame?.classList.toggle('lazy-image-frame-loaded', !loading);
  }

  private setHtmlImageFallbackState(image: HTMLImageElement, active: boolean): void {
    image.classList.toggle('lazy-image-fallback-active', active);
    this.htmlImageFrame(image)?.classList.toggle('lazy-image-frame-fallback-active', active);
  }

  private clearHtmlImageState(image: HTMLImageElement): void {
    image.classList.remove('lazy-image-loading', 'lazy-image-loaded', 'lazy-image-fallback-active');
    this.htmlImageFrame(image)?.classList.remove(
      'lazy-image-frame-loading',
      'lazy-image-frame-loaded',
      'lazy-image-frame-fallback-active'
    );
  }

  private htmlImageFrame(image: HTMLImageElement): HTMLElement | null {
    const figure = image.closest('figure');
    if (figure instanceof HTMLElement && this.elementRef.nativeElement.contains(figure)) {
      return figure;
    }
    return image.parentElement;
  }

  private htmlImageSourceUrl(image: HTMLImageElement): string {
    const lazySrc = image.getAttribute('data-lazy-src')?.trim() ?? '';
    if (lazySrc) {
      return lazySrc;
    }
    const src = image.getAttribute('src')?.trim() ?? '';
    const placeholderLazySrc = this.placeholderLazyImageSourceUrl(src);
    if (placeholderLazySrc) {
      return placeholderLazySrc;
    }
    if (src === LazyBgImageDirective.HTML_IMAGE_PLACEHOLDER_URL) {
      return '';
    }
    const managedSourceUrl = image.dataset['lazyImageSourceUrl']?.trim() ?? '';
    if (managedSourceUrl && (!src || src === image.dataset['lazyImageManagedSrc'] || this.isGeneratedSvgObjectUrl(src))) {
      return managedSourceUrl;
    }
    return src;
  }

  private placeholderLazyImageSourceUrl(src: string): string {
    if (!src.startsWith(LazyBgImageDirective.HTML_IMAGE_PLACEHOLDER_URL)) {
      return '';
    }
    const markerIndex = src.indexOf(LazyBgImageDirective.HTML_IMAGE_PLACEHOLDER_LAZY_SRC_MARKER);
    if (markerIndex < 0) {
      return '';
    }
    const encodedValue = src.slice(markerIndex + LazyBgImageDirective.HTML_IMAGE_PLACEHOLDER_LAZY_SRC_MARKER.length);
    try {
      return decodeURIComponent(encodedValue).trim();
    } catch {
      return '';
    }
  }

  private localizeHtmlSvgImage(image: HTMLImageElement, src: string): boolean {
    const currentSrc = image.getAttribute('src')?.trim() ?? '';
    const originalSrc = this.isGeneratedSvgObjectUrl(src)
      ? image.dataset['lazyImageSvgOriginalSrc'] || src
      : src;
    if (this.isGeneratedSvgObjectUrl(src)) {
      const revision = `${this.i18n.revision()}`;
      if (image.dataset['lazyImageSvgRevision'] === revision) {
        return false;
      }
    }
    if (!this.shouldTrySvgLocalization(image, originalSrc)) {
      return false;
    }
    const revision = `${this.i18n.revision()}`;
    if (image.dataset['lazyImageSvgOriginalSrc'] === originalSrc
      && image.dataset['lazyImageSvgRevision'] === revision
      && this.isGeneratedSvgObjectUrl(currentSrc)) {
      return false;
    }
    image.dataset['lazyImageSvgOriginalSrc'] = originalSrc;
    image.dataset['lazyImageSvgRevision'] = revision;
    this.prepareRenderableImageUrl(originalSrc, this.forceSvgLocalization(image)).then(localizedUrl => {
      if (!localizedUrl || image.dataset['lazyImageSvgOriginalSrc'] !== originalSrc) {
        return;
      }
      if (localizedUrl === image.getAttribute('src')) {
        return;
      }
      image.dataset['lazyImageManagedSrc'] = localizedUrl;
      image.src = localizedUrl;
    });
    return true;
  }

  private detachHtmlImageHandlers(): void {
    for (const image of this.htmlImages()) {
      image.removeEventListener('load', this.htmlImageLoadHandler);
      image.removeEventListener('error', this.htmlImageErrorHandler);
      delete image.dataset['lazyImageWired'];
      this.clearHtmlImageState(image);
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

  private async loadRenderableUrl(url: string): Promise<string | null> {
    const renderedUrl = await this.prepareRenderableImageUrl(url);
    const finalUrl = renderedUrl ?? this.resolveImageSourceUrl(url);
    return await this.preloadUrl(finalUrl) ? finalUrl : null;
  }

  private renderedImageUrl(sourceUrl: string): string {
    const resolvedUrl = this.resolveImageSourceUrl(sourceUrl);
    return LazyBgImageDirective.localizedSvgUrls.get(this.localizedSvgCacheKey(resolvedUrl)) ?? resolvedUrl;
  }

  private async prepareRenderableImageUrl(url: string, forceSvg = false): Promise<string | null> {
    const normalizedUrl = this.normalizeUrl(this.resolveImageSourceUrl(url));
    if (!normalizedUrl || (!forceSvg && !this.maybeSvgUrl(normalizedUrl))) {
      return normalizedUrl;
    }
    if (!forceSvg && LazyBgImageDirective.nonSvgUrls.has(normalizedUrl)) {
      return normalizedUrl;
    }
    const cacheKey = this.localizedSvgCacheKey(normalizedUrl);
    const cached = LazyBgImageDirective.localizedSvgUrls.get(cacheKey);
    if (cached) {
      return cached;
    }
    const existingPromise = LazyBgImageDirective.localizedSvgPromises.get(cacheKey);
    if (existingPromise) {
      return await existingPromise;
    }
    const promise = this.buildLocalizedSvgObjectUrl(normalizedUrl, forceSvg);
    LazyBgImageDirective.localizedSvgPromises.set(cacheKey, promise);
    const localizedUrl = await promise;
    LazyBgImageDirective.localizedSvgPromises.delete(cacheKey);
    if (localizedUrl) {
      LazyBgImageDirective.localizedSvgUrls.set(cacheKey, localizedUrl);
      return localizedUrl;
    }
    if (!forceSvg) {
      LazyBgImageDirective.nonSvgUrls.add(normalizedUrl);
    }
    return normalizedUrl;
  }

  private async buildLocalizedSvgObjectUrl(url: string, forceSvg: boolean): Promise<string | null> {
    if (typeof fetch === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
      return null;
    }
    try {
      const response = await fetch(url);
      if (!response.ok && response.status !== 0) {
        return null;
      }
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      const svgText = await response.text();
      if (!forceSvg && !contentType.includes('image/svg+xml') && !this.looksLikeSvg(svgText)) {
        return null;
      }
      const localizedSvg = this.localizeSvg(svgText);
      if (!localizedSvg) {
        return null;
      }
      return URL.createObjectURL(new Blob([localizedSvg], { type: 'image/svg+xml' }));
    } catch {
      return null;
    }
  }

  private localizeSvg(svgText: string): string | null {
    if (!this.looksLikeSvg(svgText) || typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
      return null;
    }
    try {
      const document = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      const svg = document.documentElement;
      if (!svg || svg.tagName.toLowerCase() !== 'svg') {
        return null;
      }
      this.sanitizeSvg(svg);
      let changed = false;
      svg.querySelectorAll<SVGElement>('[data-i18n-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-key')?.trim() ?? '';
        if (!key) {
          return;
        }
        const fallback = element.textContent?.trim() ?? '';
        const translated = this.i18n.translate(key, fallback);
        if (translated && translated !== element.textContent) {
          element.textContent = translated;
          changed = true;
        }
      });
      svg.querySelectorAll<SVGElement>('[data-i18n-title-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-title-key')?.trim() ?? '';
        if (!key) {
          return;
        }
        const translated = this.i18n.translate(key, element.getAttribute('title') ?? '');
        if (translated) {
          element.setAttribute('title', translated);
          changed = true;
        }
      });
      return changed ? new XMLSerializer().serializeToString(document) : svgText;
    } catch {
      return null;
    }
  }

  private sanitizeSvg(svg: Element): void {
    svg.querySelectorAll('script, foreignObject').forEach(element => element.remove());
    svg.querySelectorAll('*').forEach(element => {
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim().toLowerCase();
        if (name.startsWith('on') || ((name === 'href' || name.endsWith(':href')) && value.startsWith('javascript:'))) {
          element.removeAttribute(attribute.name);
        }
      }
    });
  }

  private shouldTrySvgLocalization(image: HTMLImageElement, url: string): boolean {
    return this.forceSvgLocalization(image) || this.maybeSvgUrl(url) || this.isGeneratedSvgObjectUrl(url);
  }

  private forceSvgLocalization(image: HTMLImageElement): boolean {
    return image.dataset['i18nSvg'] === 'true' || image.getAttribute('data-i18n-svg') === 'true';
  }

  private maybeSvgUrl(url: string): boolean {
    const normalized = this.resolveImageSourceUrl(url).trim().toLowerCase();
    return normalized.startsWith('data:image/svg+xml')
      || normalized.includes('image/svg+xml')
      || /\.svg(?:[?#]|$)/i.test(normalized)
      || normalized.startsWith('blob:');
  }

  private isGeneratedSvgObjectUrl(url: string): boolean {
    return url.startsWith('blob:') && Array.from(LazyBgImageDirective.localizedSvgUrls.values()).includes(url);
  }

  private looksLikeSvg(text: string): boolean {
    return /^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text);
  }

  private localizedSvgCacheKey(url: string): string {
    return `${this.i18n.revision()}::${url}`;
  }

  private resolveImageSourceUrl(url: string): string {
    const rawUrl = this.normalizeUrl(url) ?? '';
    const normalized = rawUrl.startsWith('unsafe:') ? rawUrl.slice('unsafe:'.length) : rawUrl;
    if (!normalized.startsWith(LazyBgImageDirective.SEEDED_IMAGE_REF_PREFIX)) {
      return normalized;
    }
    const ref = normalized.slice(LazyBgImageDirective.SEEDED_IMAGE_REF_PREFIX.length);
    const parts = ref.split('/').map(part => this.seededImagePathSegment(part)).filter(Boolean);
    if (parts.length < 3) {
      return normalized;
    }
    const [lang, context, section] = parts;
    return `${LazyBgImageDirective.SEEDED_IMAGE_ASSET_ROOT}/${lang}/${context}/${section}.svg`;
  }

  private seededImagePathSegment(value: string | null | undefined): string {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    return /^[a-z0-9-]+$/.test(normalized) ? normalized : '';
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
    return LazyBgImageDirective.preloadImageUrl(url);
  }
}
