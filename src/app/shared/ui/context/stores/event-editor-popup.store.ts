import { Injectable, Type, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';

import type { AppMenuItem, AppMenuItemSelectEvent } from '../../components/core/menu';

export type EventEditorPresentationMode = 'default' | 'checkout-review';
export type EventEditorCheckoutPhase = 'review' | 'payment';
export type EventEditorPresentationValue<TValue> = TValue | (() => TValue);

export interface EventEditorBasketPricingSummaryRow {
  key: string;
  label: string;
  detail?: string | null;
  amount?: number | null;
  currency?: string | null;
  multiplier?: number | null;
}

export interface EventEditorBasketPresentationItem {
  id: string;
  title: string;
  meta: string;
  detail?: string | null;
  amount: number;
  currency: string;
  quantity?: number | null;
  status?: string | null;
  pricingSummaryRows?: readonly EventEditorBasketPricingSummaryRow[] | null;
}

export interface EventEditorPresentationOptions {
  mode?: EventEditorPresentationMode;
  checkoutPhase?: EventEditorCheckoutPhase | null;
  title?: string | null;
  subtitle?: string | null;
  loading?: EventEditorPresentationValue<boolean | null | undefined> | null;
  hideSubEventsPanel?: boolean | null;
  hideSlotsPanel?: boolean | null;
  showBasketPanel?: EventEditorPresentationValue<boolean | null | undefined> | null;
  showPricingPanel?: EventEditorPresentationValue<boolean | null | undefined> | null;
  basketItems?: EventEditorPresentationValue<readonly EventEditorBasketPresentationItem[] | null | undefined> | null;
  basketPricingSummaryRows?: EventEditorPresentationValue<readonly EventEditorBasketPricingSummaryRow[] | null | undefined> | null;
  basketTotalAmount?: EventEditorPresentationValue<number | null | undefined> | null;
  basketCurrency?: EventEditorPresentationValue<string | null | undefined> | null;
  basketAddDisabled?: EventEditorPresentationValue<boolean | null | undefined> | null;
  onBasketAdd?: (event?: Event) => void | Promise<void>;
  onBasketItemMenuSelect?: (
    item: EventEditorBasketPresentationItem,
    event: AppMenuItemSelectEvent<string>
  ) => void | Promise<void>;
  footerItems?: readonly AppMenuItem<string>[] | null;
  footerMessage?: string | (() => string | null | undefined) | null;
  onFooterItemSelect?: (event: AppMenuItemSelectEvent<string>) => void | Promise<void>;
  onClose?: () => void;
}

export interface EventEditorState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  sourceEvent?: any;
  readOnly?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class EventEditorPopupStore {
  private readonly _isOpen = signal(false);
  private readonly _mode = signal<'create' | 'edit'>('create');
  private readonly _sourceEvent = signal<any>(null);
  private readonly _readOnly = signal(false);
  private readonly _presentation = signal<EventEditorPresentationOptions>({ mode: 'default' });
  private readonly eventEditorPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly _onOpen = new Subject<void>();
  private readonly _onClose = new Subject<void>();

  readonly isOpen = this._isOpen.asReadonly();
  readonly mode = this._mode.asReadonly();
  readonly sourceEvent = this._sourceEvent.asReadonly();
  readonly readOnly = this._readOnly.asReadonly();
  readonly presentation = this._presentation.asReadonly();
  readonly eventEditorPopupComponent = this.eventEditorPopupComponentRef.asReadonly();

  readonly isOpenBoolean = computed(() => this._isOpen());
  readonly onOpen$ = this._onOpen.asObservable();
  readonly onClose$ = this._onClose.asObservable();

  open(
    mode: 'create' | 'edit' = 'create',
    sourceEvent?: any,
    readOnly?: boolean,
    presentation?: EventEditorPresentationOptions | null
  ): void {
    this._mode.set(mode);
    this._sourceEvent.set(sourceEvent ?? null);
    this._readOnly.set(Boolean(readOnly));
    this._presentation.set(this.normalizePresentation(presentation));
    this._isOpen.set(true);
    this._onOpen.next();
  }

  openView(sourceEvent: any): void {
    this.open('edit', sourceEvent, true);
  }

  openEdit(sourceEvent: any): void {
    this.open('edit', sourceEvent, false);
  }

  openCheckoutReview(sourceEvent: any, presentation?: EventEditorPresentationOptions | null): void {
    this.open('edit', sourceEvent, true, {
      ...presentation,
      mode: 'checkout-review',
      hideSubEventsPanel: presentation?.hideSubEventsPanel === true,
      hideSlotsPanel: presentation?.hideSlotsPanel === true
    });
  }

  openCreate(): void {
    this.open('create');
  }

  close(): void {
    this._isOpen.set(false);
    this._sourceEvent.set(null);
    this._readOnly.set(false);
    this._presentation.set({ mode: 'default' });
    this._onClose.next();
  }

  toggle(
    mode: 'create' | 'edit' = 'create',
    sourceEvent?: any,
    readOnly?: boolean,
    presentation?: EventEditorPresentationOptions | null
  ): void {
    if (this._isOpen()) {
      this.close();
      return;
    }
    this.open(mode, sourceEvent, readOnly, presentation);
  }

  get isCurrentlyOpen(): boolean {
    return this._isOpen();
  }

  get currentMode(): 'create' | 'edit' {
    return this._mode();
  }

  get currentSourceEvent(): any {
    return this._sourceEvent();
  }

  get isReadOnly(): boolean {
    return this._readOnly();
  }

  async ensureEventEditorPopupLoaded(): Promise<void> {
    if (this.eventEditorPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-editor-popup/event-editor-popup.component');
    this.eventEditorPopupComponentRef.set(module.EventEditorPopupComponent);
  }

  private normalizePresentation(
    presentation: EventEditorPresentationOptions | null | undefined
  ): EventEditorPresentationOptions {
    const mode = presentation?.mode === 'checkout-review' ? 'checkout-review' : 'default';
    return {
      mode,
      checkoutPhase: mode === 'checkout-review' && presentation?.checkoutPhase === 'payment'
        ? 'payment'
        : 'review',
      title: `${presentation?.title ?? ''}`.trim() || null,
      subtitle: `${presentation?.subtitle ?? ''}`.trim() || null,
      loading: presentation?.loading ?? null,
      hideSubEventsPanel: presentation?.hideSubEventsPanel === true,
      hideSlotsPanel: presentation?.hideSlotsPanel === true,
      showBasketPanel: presentation?.showBasketPanel ?? null,
      showPricingPanel: presentation?.showPricingPanel ?? null,
      basketItems: typeof presentation?.basketItems === 'function'
        ? presentation.basketItems
        : [...(presentation?.basketItems ?? [])],
      basketPricingSummaryRows: typeof presentation?.basketPricingSummaryRows === 'function'
        ? presentation.basketPricingSummaryRows
        : [...(presentation?.basketPricingSummaryRows ?? [])],
      basketTotalAmount: presentation?.basketTotalAmount ?? null,
      basketCurrency: presentation?.basketCurrency ?? null,
      basketAddDisabled: presentation?.basketAddDisabled ?? null,
      onBasketAdd: presentation?.onBasketAdd,
      onBasketItemMenuSelect: presentation?.onBasketItemMenuSelect,
      footerItems: [...(presentation?.footerItems ?? [])],
      footerMessage: presentation?.footerMessage ?? null,
      onFooterItemSelect: presentation?.onFooterItemSelect,
      onClose: presentation?.onClose
    };
  }
}
