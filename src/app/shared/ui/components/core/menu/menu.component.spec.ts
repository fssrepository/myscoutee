import { TestBed } from '@angular/core/testing';

import { I18nService } from '../../../../core';
import { AppMenuComponent } from './menu.component';
import type { AppMenuDragEvent } from './menu.types';

describe('AppMenuComponent delayed drag', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [AppMenuComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            revision: () => 0,
            translate: (value: string | null | undefined) => value ?? ''
          }
        }
      ]
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('keeps a short press as a custom trigger action without starting a drag', () => {
    const { dragEvents, itemSelections, trigger } = createMenu();

    trigger.dispatchEvent(pointerEvent('pointerdown', 120, 120));
    vi.advanceTimersByTime(99);
    window.dispatchEvent(pointerEvent('pointerup', 120, 120));
    trigger.click();

    expect(dragEvents).toEqual([]);
    expect(itemSelections).toHaveLength(1);
  });

  it('emits start, move, and end after activation and suppresses the ensuing trigger click', () => {
    const {
      component,
      dragEvents,
      dragPositions,
      itemSelections,
      trigger
    } = createMenu();

    trigger.dispatchEvent(pointerEvent('pointerdown', 120, 120));
    vi.advanceTimersByTime(100);

    expect(dragEvents.map(event => event.phase)).toEqual(['start']);
    expect(dragEvents[0]).toMatchObject({
      position: { x: 0, y: 0 },
      centerX: 120,
      centerY: 120,
      moved: false
    });

    window.dispatchEvent(pointerEvent('pointermove', 135, 140));

    expect(dragPositions).toEqual([{ x: 15, y: 20 }]);
    expect(dragEvents.map(event => event.phase)).toEqual(['start', 'move']);
    expect(dragEvents[1]).toMatchObject({
      position: { x: 15, y: 20 },
      centerX: 135,
      centerY: 140,
      moved: true
    });
    expect(component.dragPosition).toEqual({ x: 15, y: 20 });

    window.dispatchEvent(pointerEvent('pointerup', 135, 140));
    trigger.click();

    expect(dragEvents.map(event => event.phase)).toEqual(['start', 'move', 'end']);
    expect(itemSelections).toEqual([]);

    trigger.click();
    expect(itemSelections).toHaveLength(1);
  });

  it('emits cancel when an activated drag receives pointercancel', () => {
    const { dragEvents, trigger } = createMenu();

    trigger.dispatchEvent(pointerEvent('pointerdown', 120, 120));
    vi.advanceTimersByTime(100);
    window.dispatchEvent(pointerEvent('pointercancel', 120, 120));

    expect(dragEvents.map(event => event.phase)).toEqual(['start', 'cancel']);
  });

  it('cancels pending activation when movement exceeds the tolerance before the delay', () => {
    const { dragEvents, dragPositions, itemSelections, trigger } = createMenu();

    trigger.dispatchEvent(pointerEvent('pointerdown', 120, 120));
    window.dispatchEvent(pointerEvent('pointermove', 127, 120));
    vi.advanceTimersByTime(100);
    window.dispatchEvent(pointerEvent('pointerup', 127, 120));
    trigger.click();

    expect(dragEvents).toEqual([]);
    expect(dragPositions).toEqual([]);
    expect(itemSelections).toEqual([]);
  });

  it('suppresses the native context menu only for a draggable trigger', () => {
    const { component, trigger } = createMenu();
    const draggableContextMenu = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    });

    trigger.dispatchEvent(draggableContextMenu);
    expect(draggableContextMenu.defaultPrevented).toBe(true);

    component.draggable = false;
    const staticContextMenu = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    });
    trigger.dispatchEvent(staticContextMenu);

    expect(staticContextMenu.defaultPrevented).toBe(false);
  });

  it('does not trap an overflow-enabled popup menu inside the popup boundary', () => {
    const fixture = TestBed.createComponent(AppMenuComponent);
    const componentView = fixture.componentInstance as unknown as {
      isMenuLayoutBoundary: (element: HTMLElement, style: CSSStyleDeclaration) => boolean;
    };
    const panel = document.createElement('section');
    panel.className = 'ui-popup__panel ui-popup__panel--overflow-visible';
    const body = document.createElement('div');
    body.className = 'ui-popup__body ui-popup__body--overflow';
    const visibleStyle = {
      overflow: 'visible',
      overflowX: 'visible',
      overflowY: 'visible'
    } as CSSStyleDeclaration;

    expect(componentView.isMenuLayoutBoundary(panel, visibleStyle)).toBe(false);
    expect(componentView.isMenuLayoutBoundary(body, visibleStyle)).toBe(false);

    const scrollingStyle = {
      overflow: 'auto',
      overflowX: 'hidden',
      overflowY: 'auto'
    } as CSSStyleDeclaration;
    expect(componentView.isMenuLayoutBoundary(body, scrollingStyle)).toBe(true);
  });

  it('renders generic images in the selected trigger and normal list with a load fallback', () => {
    const fixture = TestBed.createComponent(AppMenuComponent);
    const component = fixture.componentInstance;
    component.kind = 'select';
    component.trigger = {
      label: 'Stripe',
      imageUrl: 'assets/payment-providers/stripe.svg',
      imageAlt: 'Stripe',
      layout: 'field'
    };
    component.items = [{
      id: 'barion',
      label: 'Barion',
      imageUrl: 'assets/payment-providers/barion.svg',
      imageAlt: 'Barion',
      kind: 'radio',
      palette: 'blue'
    }];
    component.open = true;

    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const triggerImage = host.querySelector<HTMLImageElement>(
      '.app-menu__trigger-image img'
    );
    const itemImage = host.querySelector<HTMLImageElement>(
      '.app-menu__item-image img'
    );
    expect(triggerImage?.getAttribute('src')).toBe(
      'assets/payment-providers/stripe.svg'
    );
    expect(triggerImage?.alt).toBe('Stripe');
    expect(itemImage?.getAttribute('src')).toBe(
      'assets/payment-providers/barion.svg'
    );
    expect(itemImage?.alt).toBe('Barion');

    itemImage?.dispatchEvent(new Event('error'));

    const fallback = host.querySelector<HTMLElement>(
      '.app-menu__item-image [data-app-menu-image-fallback]'
    );
    expect(itemImage?.hidden).toBe(true);
    expect(fallback?.hidden).toBe(false);
    expect(fallback?.textContent?.trim()).toBe('B');
  });

  it('renders a labelled inline toggle as a button by default', () => {
    const fixture = TestBed.createComponent(AppMenuComponent);
    const component = fixture.componentInstance;
    component.kind = 'inline';
    component.layout = 'row';
    component.items = [{
      id: 'https-enabled',
      label: 'On',
      kind: 'toggle',
      layout: 'pill',
      active: true,
      checked: true
    }];

    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.app-menu__button-row-label')?.textContent?.trim())
      .toBe('On');
    expect(
      host.querySelector(
        '.app-menu__button-row-toggle.app-menu__tabs-toggle--active'
      )
    ).toBeNull();
  });

  it('renders the switch indicator when a labelled inline toggle config enables it', () => {
    const fixture = TestBed.createComponent(AppMenuComponent);
    const component = fixture.componentInstance;
    component.kind = 'inline';
    component.layout = 'row';
    component.items = [{
      id: 'https-enabled',
      label: 'On',
      kind: 'toggle',
      layout: 'pill',
      active: true,
      checked: true,
      showToggleIndicator: true
    }];

    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector(
        '.app-menu__button-row-toggle.app-menu__tabs-toggle--active'
      )
    ).not.toBeNull();
  });
});

function createMenu(): {
  component: AppMenuComponent;
  dragEvents: AppMenuDragEvent[];
  dragPositions: Array<{ x: number; y: number }>;
  itemSelections: unknown[];
  trigger: HTMLButtonElement;
} {
  const fixture = TestBed.createComponent(AppMenuComponent);
  const component = fixture.componentInstance;
  const dragEvents: AppMenuDragEvent[] = [];
  const dragPositions: Array<{ x: number; y: number }> = [];
  const itemSelections: unknown[] = [];

  component.kind = 'fab';
  component.draggable = true;
  component.dragActivationDelayMs = 100;
  component.trigger = {
    id: 'notifications',
    label: 'Notifications',
    icon: 'notifications',
    layout: 'icon',
    action: 'custom'
  };
  component.dragStateChange.subscribe(event => dragEvents.push(event));
  component.dragPositionChange.subscribe(position => dragPositions.push(position));
  component.itemSelect.subscribe(event => itemSelections.push(event));
  fixture.detectChanges();

  const host = fixture.nativeElement as HTMLElement;
  Object.defineProperty(host, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(100, 100, 40, 40)
  });
  const trigger = host.querySelector<HTMLButtonElement>('.app-menu__trigger');
  if (!trigger) {
    throw new Error('Expected AppMenu trigger button.');
  }

  return {
    component,
    dragEvents,
    dragPositions,
    itemSelections,
    trigger
  };
}

function pointerEvent(
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  clientX: number,
  clientY: number
): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    button: 0,
    clientX,
    clientY,
    isPrimary: true,
    pointerId: 7,
    pointerType: 'mouse'
  });
}
