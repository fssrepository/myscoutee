import { describe, expect, it, vi } from 'vitest';
import { LazyBgImageDirective } from './lazy-bg-image.directive';

function background(enabled: boolean, loaded = false) {
  const element = document.createElement('div');
  if (loaded) {
    element.style.backgroundImage = 'url("/ready.jpg")';
    element.classList.add('lazy-bg-loaded');
  }
  const instance = Object.assign(Object.create(LazyBgImageDirective.prototype), {
    appLazyImageEnabled: enabled, isViewReady: true,
    currentUrl: '/ready.jpg', appliedUrl: loaded ? '/ready.jpg' : null, hasLoaded: loaded,
    elementRef: { nativeElement: element },
    loadingClass: 'lazy-bg-loading', loadedClass: 'lazy-bg-loaded', errorClass: 'lazy-bg-error',
    renderer: {
      addClass: (el: HTMLElement, name: string) => el.classList.add(name),
      removeClass: (el: HTMLElement, name: string) => el.classList.remove(name),
      removeStyle: (el: HTMLElement, name: string) => el.style.removeProperty(name),
      setStyle: (el: HTMLElement, name: string, value: string) => el.style.setProperty(name, value)
    },
    disconnectObserver: vi.fn(), cancelBackgroundVisibilityCheck: vi.fn(),
    renderedImageUrl: (url: string) => url,
    loadRenderableUrl: vi.fn(async () => '/ready.jpg'),
    imageFallbackUrl: () => '/fallback.svg'
  });
  return { instance, element };
}

describe('retained view background images', () => {
  it('does not start an inactive view image request, including a queued observer callback', () => {
    const { instance } = background(false);
    instance.setupObserver();
    instance.loadBackgroundUrl('/ready.jpg');
    expect(instance.loadRenderableUrl).not.toHaveBeenCalled();
    expect(instance.disconnectObserver).toHaveBeenCalledOnce();
    expect(instance.cancelBackgroundVisibilityCheck).toHaveBeenCalledOnce();
  });

  it('retains a loaded image through hide/show without restoring its spinner or requesting it again', () => {
    const { instance, element } = background(false, true);
    const original = element.style.backgroundImage;
    instance.setupObserver();
    instance.appLazyImageEnabled = true;
    instance.setupObserver();
    expect(element.style.backgroundImage).toBe(original);
    expect(element.classList.contains('lazy-bg-loaded')).toBe(true);
    expect(element.classList.contains('lazy-bg-loading')).toBe(false);
    expect(instance.loadRenderableUrl).not.toHaveBeenCalled();
  });

  it('does not show the previous row image when an inactive view receives a different row', () => {
    const { instance, element } = background(false, true);
    instance.currentUrl = '/next.jpg';
    instance.hasLoaded = false;
    instance.setupObserver();
    expect(element.style.backgroundImage).toBe('');
    expect(element.classList.contains('lazy-bg-loaded')).toBe(false);
    expect(instance.loadRenderableUrl).not.toHaveBeenCalled();
  });

  it('finishes the loader when a newly activated image completes', async () => {
    const { instance, element } = background(true);
    element.classList.add('lazy-bg-loading');
    instance.loadBackgroundUrl('/ready.jpg');
    await vi.waitFor(() => expect(element.classList.contains('lazy-bg-loaded')).toBe(true));
    expect(element.classList.contains('lazy-bg-loading')).toBe(false);
  });

  it('finishes the loader with the existing fallback when the request fails', async () => {
    const { instance, element } = background(true);
    instance.loadRenderableUrl = vi.fn(async () => null);
    element.classList.add('lazy-bg-loading');
    instance.loadBackgroundUrl('/ready.jpg');
    await vi.waitFor(() => expect(element.classList.contains('lazy-bg-error')).toBe(true));
    expect(element.classList.contains('lazy-bg-loading')).toBe(false);
    expect(element.style.backgroundImage).toContain('/fallback.svg');
  });
});


describe('background request lifecycle', () => {
  it('does not restart an in-flight request on repeated observer callbacks', async () => {
    const { instance, element } = background(true);
    instance.loadBackgroundUrl('/ready.jpg');
    instance.loadBackgroundUrl('/ready.jpg');
    expect(instance.loadRenderableUrl).toHaveBeenCalledOnce();
    expect(element.classList.contains('lazy-bg-loading')).toBe(true);
    await vi.waitFor(() => expect(element.classList.contains('lazy-bg-loaded')).toBe(true));
    expect(element.classList.contains('lazy-bg-loading')).toBe(false);
  });

  it('does not animate a spinner while an offscreen image waits for intersection', () => {
    const observe = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      observe = observe;
      disconnect = vi.fn();
    });
    try {
      const { instance, element } = background(true);
      instance.currentUrl = '/not-yet-visible.jpg';
      instance.scheduleVisibleBackgroundLoad = vi.fn();
      instance.setupObserver();
      expect(observe).toHaveBeenCalledWith(element);
      expect(element.classList.contains('lazy-bg-loading')).toBe(false);
      expect(instance.loadRenderableUrl).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});


describe('fast-scroll image deferral', () => {
  it('skips requests and spinners during a fling, then loads only images still visible', () => {
    const root = document.createElement('div');
    const passed = background(true);
    const visible = background(true);
    const ready = background(true, true);
    root.append(passed.element, visible.element, ready.element);
    passed.instance.isElementWithinPreloadRange = () => false;
    passed.instance.setupObserver = vi.fn();
    visible.instance.isElementWithinPreloadRange = () => true;
    const readyStyle = ready.element.style.backgroundImage;
    const event = { target: root } as unknown as Event;
    try {
      LazyBgImageDirective['onScroll'](event);
      passed.instance.loadBackgroundUrl('/ready.jpg');
      visible.instance.loadBackgroundUrl('/ready.jpg');
      for (const image of [passed, visible]) {
        expect(image.instance.loadRenderableUrl).not.toHaveBeenCalled();
        expect(image.element.classList.contains('lazy-bg-loading')).toBe(false);
      }
      expect(root.hasAttribute('data-lazy-image-scroll-fast')).toBe(true);
      LazyBgImageDirective['onScrollEnd'](event);
      expect(passed.instance.loadRenderableUrl).not.toHaveBeenCalled();
      expect(passed.instance.setupObserver).toHaveBeenCalledOnce();
      expect(visible.instance.loadRenderableUrl).toHaveBeenCalledOnce();
      expect(ready.element.style.backgroundImage).toBe(readyStyle);
      expect(ready.element.classList.contains('lazy-bg-loaded')).toBe(true);
      expect(root.hasAttribute('data-lazy-image-scroll-fast')).toBe(false);
    } finally {
      LazyBgImageDirective['onScrollEnd'](event);
    }
  });

  it('resumes at slow scroll speed without waiting for scrollend', () => {
    const root = document.createElement('div');
    const image = background(true);
    root.append(image.element);
    image.instance.isElementWithinPreloadRange = () => true;
    const event = { target: root } as unknown as Event;
    const clock = vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(120);
    try {
      LazyBgImageDirective['onScroll'](event);
      image.instance.loadBackgroundUrl('/ready.jpg');
      root.scrollTop = 5;
      LazyBgImageDirective['onScroll'](event);
      expect(image.instance.loadRenderableUrl).toHaveBeenCalledOnce();
      expect(root.hasAttribute('data-lazy-image-scroll-fast')).toBe(false);
    } finally {
      LazyBgImageDirective['onScrollEnd'](event);
      clock.mockRestore();
    }
  });
});

describe('cached image paint visibility', () => {
  it('keeps a visible cached image unchanged and reveals an entering cached image only after the fling', () => {
    const root = document.createElement('div');
    const visible = background(true, true);
    const entering = background(true, true);
    root.append(visible.element, entering.element);
    entering.element.classList.add('lazy-bg-suspended');
    entering.instance.isElementWithinPreloadRange = () => true;
    const paint = vi.spyOn(entering.instance.renderer, 'setStyle');
    const event = { target: root } as unknown as Event;
    try {
      LazyBgImageDirective['onScroll'](event);
      visible.instance.loadBackgroundUrl('/ready.jpg');
      entering.instance.loadBackgroundUrl('/ready.jpg');
      expect(visible.element.classList.contains('lazy-bg-suspended')).toBe(false);
      expect(entering.element.classList.contains('lazy-bg-suspended')).toBe(true);
      LazyBgImageDirective['onScrollEnd'](event);
      entering.instance.loadBackgroundUrl('/ready.jpg');
      expect(entering.element.classList.contains('lazy-bg-suspended')).toBe(false);
      expect(entering.element.classList.contains('lazy-bg-loading')).toBe(false);
      expect(entering.instance.loadRenderableUrl).not.toHaveBeenCalled();
      expect(visible.instance.loadRenderableUrl).not.toHaveBeenCalled();
      expect(paint).not.toHaveBeenCalled();
    } finally {
      LazyBgImageDirective['onScrollEnd'](event);
    }
  });

  it('suspends only after leaving the viewport and restores the same cached URL on reentry', () => {
    let callback!: IntersectionObserverCallback;
    vi.stubGlobal('IntersectionObserver', class {
      constructor(handler: IntersectionObserverCallback) { callback = handler; }
      observe = vi.fn();
      disconnect = vi.fn();
    });
    try {
      const { instance, element } = background(true, true);
      instance.scheduleVisibleBackgroundLoad = vi.fn();
      const url = element.style.backgroundImage;
      instance.setupObserver();
      callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
      expect(element.classList.contains('lazy-bg-suspended')).toBe(true);
      expect(element.style.backgroundImage).toBe(url);
      callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      expect(element.classList.contains('lazy-bg-suspended')).toBe(false);
      expect(element.style.backgroundImage).toBe(url);
      expect(instance.loadRenderableUrl).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
