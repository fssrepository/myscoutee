import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  Type,
  computed,
  effect,
  inject,
  untracked
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type * as ContractTypes from '../../../../shared/core/contracts';
import { I18nService } from '../../../../shared/core/base/services/i18n.service';
import { EVENT_CHECKOUT_PROMO_CODE_INVALID_MESSAGE_KEY } from '../../../../shared/core/contracts';
import {
  I18nPipe,
  IndicatorComponent,
  PopupComponent,
  SingleRowComponent,
  type CardMenuActionEvent,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel,
  type SingleRowData
} from '../../../../shared/ui';
import {
  EventPromoCodePopupStore,
  type EventPromoCodeAddPopupActionRequest,
  type EventPromoCodeAddPopupState
} from './event-promo-code-popup.store';

type PromoCodePopupMenuContext = {
  menu: 'promo-code-setup';
  action: 'add';
};

interface PromoCodeValidationError {
  key: string;
  message: string;
}

@Component({
  selector: 'app-event-promo-code-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    I18nPipe,
    IndicatorComponent,
    PopupComponent,
    SingleRowComponent
  ],
  templateUrl: './event-promo-code-popup.component.html',
  styleUrl: './event-promo-code-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventPromoCodePopupComponent implements OnChanges, OnDestroy {
  private static ownerSequence = 0;

  @Input() open = false;
  @Input() availablePromoCodes: readonly ContractTypes.PricingPromoCode[] = [];
  @Input() appliedPromoCodes: readonly string[] = [];
  @Input() validatePromoCode: ((code: string) => Promise<ContractTypes.EventCheckoutPromoCodeValidationResult | null>) | null = null;

  @Output() readonly closeSelect = new EventEmitter<void>();
  @Output() readonly addSelect = new EventEmitter<ContractTypes.EventCheckoutPromoCodeValidationResult>();
  @Output() readonly removeSelect = new EventEmitter<string>();

  private readonly i18n = inject(I18nService);
  private readonly popupStore = inject(EventPromoCodePopupStore);
  private readonly ownerId = this.nextOwnerId();
  private readonly destroyEffects: Array<{ destroy: () => void }> = [];
  private lastAddPopupActionRequestId = 0;
  private addPopupStateSignature = '';
  private addPopupVerificationBusy = false;
  private addPopupValidationErrorKey = '';
  private addPopupValidationError = '';
  private addPopupVerificationSequence = 0;

  protected readonly addPopupOutletInputs = computed(() => {
    const popup = this.popupStore.addPopup();
    return {
      popup: popup?.ownerId === this.ownerId ? popup : null
    };
  });

  constructor() {
    this.destroyEffects.push(
      effect(() => {
        if (this.addPopupIsOpen()) {
          void this.popupStore.ensureAddPopupLoaded();
        }
      }),
      effect(() => {
        const request = this.popupStore.addPopupActionRequest();
        if (!request || request.requestId <= this.lastAddPopupActionRequestId) {
          return;
        }
        this.lastAddPopupActionRequestId = request.requestId;
        untracked(() => this.handleAddPopupActionRequest(request));
      })
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && !this.open) {
      this.closeAddPopup(undefined, true);
      return;
    }
    if (!this.addPopupIsOpen()) {
      return;
    }
    if (changes['availablePromoCodes'] || changes['appliedPromoCodes']) {
      this.syncAddPopupState();
    }
  }

  ngOnDestroy(): void {
    this.destroyEffects.forEach(item => item.destroy());
    if (this.addPopupIsOpen()) {
      this.closeAddPopup(undefined, true);
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected handleEscape(event: Event): void {
    if (!this.open || this.addPopupVerificationBusy) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (this.addPopupIsOpen()) {
      this.closeAddPopup(event);
      return;
    }
    this.close(event);
  }

  protected popupModel(): PopupModel<PromoCodePopupMenuContext> {
    return {
      title: 'event.checkout.promo.setup.title',
      subtitle: 'event.checkout.promo.setup.subtitle',
      ariaLabel: 'event.checkout.promo.setup.aria',
      closeAriaLabel: 'event.checkout.promo.setup.close.aria',
      closeOnBackdrop: true,
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      headerControls: this.headerControls(),
      onClose: event => this.close(event),
      onMenuSelect: event => this.onPopupMenuSelect(event)
    };
  }

  protected popupZIndex(): number {
    return 12800;
  }

  protected addPopupLoadingModel(): PopupModel<unknown> {
    return {
      title: 'event.checkout.promo.add.title',
      subtitle: 'event.checkout.promo.add.subtitle',
      ariaLabel: 'event.checkout.promo.add.aria',
      closeAriaLabel: 'event.checkout.promo.add.close.aria',
      size: 'default',
      height: 'auto',
      headerTone: 'accent',
      backdropTone: 'dim',
      onClose: event => this.closeAddPopup(event)
    };
  }

  protected addPopupZIndex(): number {
    return 12900;
  }

  protected addPopupLoading(): boolean {
    return this.addPopupIsOpen()
      && this.popupStore.addPopupLoading()
      && !this.popupStore.addPopupComponent();
  }

  protected addPopupComponent(): Type<unknown> | null {
    return this.addPopupIsOpen()
      ? this.popupStore.addPopupComponent()
      : null;
  }

  protected promoCodeRows(): SingleRowData<ContractTypes.PricingPromoCode | null>[] {
    return this.normalizedAppliedCodes().map(code => {
      const definition = this.promoDefinition(code);
      return {
        id: code,
        title: code,
        detail: this.i18n.translate('event.checkout.promo.applied.description'),
        icon: 'redeem',
        avatarShape: 'circle',
        surfaceTone: 'success',
        badges: [{
          label: definition
            ? this.promoEffectLabel(definition.action)
            : this.i18n.translate('event.checkout.promo.applied'),
          tone: 'success',
          position: 'top-right'
        }],
        menuActions: ['delete'],
        eagerDetail: definition
      };
    });
  }

  protected onPromoCodeMenuAction(event: CardMenuActionEvent<SingleRowData>): void {
    if (event.actionId !== 'delete') {
      return;
    }
    const code = this.normalizeCode(event.id);
    if (code) {
      this.removeSelect.emit(code);
    }
  }

  protected trackPromoCode(_index: number, row: SingleRowData): string {
    return row.id;
  }

  private headerControls(): readonly PopupControl<PromoCodePopupMenuContext>[] {
    return [{
      kind: 'menu',
      id: 'promo-code-setup-actions',
      menuKind: 'inline',
      closeOnSelect: false,
      items: [{
        id: 'promo-code-add',
        icon: 'add',
        kind: 'action',
        palette: 'blue',
        disabled: false,
        closeOnSelect: false,
        ariaLabel: 'event.checkout.promo.add.aria',
        context: {
          menu: 'promo-code-setup',
          action: 'add'
        }
      }],
      panelAlign: 'end',
      mobileBreakpointPx: 900
    }];
  }

  private onPopupMenuSelect(event: PopupMenuSelectEvent<PromoCodePopupMenuContext>): void {
    const context = event.itemSelect.context;
    if (context?.menu !== 'promo-code-setup' || context.action !== 'add') {
      return;
    }
    event.itemSelect.sourceEvent.preventDefault();
    event.itemSelect.sourceEvent.stopPropagation();
    this.openAddPopup();
  }

  private openAddPopup(): void {
    if (!this.open || this.addPopupIsOpen()) {
      return;
    }
    this.addPopupValidationErrorKey = '';
    this.addPopupValidationError = '';
    const popup = this.buildAddPopupState();
    this.addPopupStateSignature = this.buildAddPopupStateSignature(popup);
    this.popupStore.openAddPopup(popup);
  }

  private closeAddPopup(event?: Event, force = false): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!force && this.addPopupVerificationBusy && this.addPopupIsOpen()) {
      return;
    }
    this.addPopupVerificationSequence += 1;
    this.addPopupVerificationBusy = false;
    this.addPopupValidationErrorKey = '';
    this.addPopupValidationError = '';
    this.addPopupStateSignature = '';
    this.popupStore.closeAddPopup(this.ownerId);
  }

  private close(event?: Event): void {
    if (this.addPopupVerificationBusy) {
      return;
    }
    event?.preventDefault();
    event?.stopPropagation();
    this.closeAddPopup();
    this.closeSelect.emit();
  }

  private addPopupIsOpen(): boolean {
    return this.popupStore.addPopup()?.ownerId === this.ownerId;
  }

  private syncAddPopupState(): void {
    if (!this.addPopupIsOpen()) {
      return;
    }
    const popup = this.buildAddPopupState();
    const signature = this.buildAddPopupStateSignature(popup);
    if (signature === this.addPopupStateSignature) {
      return;
    }
    this.addPopupStateSignature = signature;
    this.popupStore.updateAddPopup(popup);
  }

  private buildAddPopupState(): EventPromoCodeAddPopupState {
    return {
      ownerId: this.ownerId,
      title: 'event.checkout.promo.add.title',
      subtitle: 'event.checkout.promo.add.subtitle',
      zIndex: this.addPopupZIndex(),
      appliedPromoCodes: this.appliedPromoCodes ?? [],
      busy: this.addPopupVerificationBusy,
      validationErrorKey: this.addPopupValidationErrorKey,
      validationError: this.addPopupValidationError
    };
  }

  private buildAddPopupStateSignature(popup: EventPromoCodeAddPopupState): string {
    return JSON.stringify({
      busy: popup.busy,
      validationErrorKey: popup.validationErrorKey,
      validationError: popup.validationError,
      applied: this.normalizedAppliedCodes()
    });
  }

  private handleAddPopupActionRequest(request: EventPromoCodeAddPopupActionRequest): void {
    if (request.ownerId !== this.ownerId) {
      return;
    }
    switch (request.kind) {
      case 'close':
        this.closeAddPopup(request.event);
        return;
      case 'verify':
        if (this.addPopupVerificationBusy) {
          return;
        }
        void this.verifyAddPopupCode(request.code);
        return;
    }
  }

  private async verifyAddPopupCode(code: string): Promise<void> {
    const normalizedInput = this.normalizeCode(code);
    if (!normalizedInput || !this.validatePromoCode || !this.addPopupIsOpen()) {
      this.addPopupValidationErrorKey = 'event.checkout.promo.verify.failed';
      this.addPopupValidationError = '';
      this.syncAddPopupState();
      return;
    }

    const verificationSequence = ++this.addPopupVerificationSequence;
    this.addPopupVerificationBusy = true;
    this.addPopupValidationErrorKey = '';
    this.addPopupValidationError = '';
    this.syncAddPopupState();

    let result: ContractTypes.EventCheckoutPromoCodeValidationResult | null = null;
    try {
      result = await this.validatePromoCode(normalizedInput);
    } catch (error) {
      if (verificationSequence === this.addPopupVerificationSequence && this.addPopupIsOpen()) {
        const validationError = this.validationFailure(error);
        this.addPopupValidationErrorKey = validationError.key;
        this.addPopupValidationError = validationError.message;
      }
    }

    if (verificationSequence !== this.addPopupVerificationSequence || !this.addPopupIsOpen()) {
      return;
    }

    this.addPopupVerificationBusy = false;
    if (!result && (this.addPopupValidationErrorKey || this.addPopupValidationError)) {
      this.syncAddPopupState();
      return;
    }
    const canonicalCode = this.normalizeCode(result?.code);
    if (!result?.valid || !canonicalCode || !result.promoCode?.action) {
      const validationError = this.normalizedValidationError(
        result?.messageKey,
        result?.message
      );
      this.addPopupValidationErrorKey = validationError.key
        || EVENT_CHECKOUT_PROMO_CODE_INVALID_MESSAGE_KEY;
      this.addPopupValidationError = validationError.message;
      this.syncAddPopupState();
      return;
    }

    const validatedResult: ContractTypes.EventCheckoutPromoCodeValidationResult = {
      ...result,
      code: canonicalCode
    };
    this.closeAddPopup(undefined, true);
    this.addSelect.emit(validatedResult);
  }

  private validationFailure(error: unknown): PromoCodeValidationError {
    if (error && typeof error === 'object') {
      const record = error as Record<string, unknown>;
      const nested = record['error'];
      if (nested && typeof nested === 'object') {
        const nestedRecord = nested as Record<string, unknown>;
        const validationError = this.normalizedValidationError(
          nestedRecord['messageKey'],
          nestedRecord['message']
        );
        if (validationError.key || validationError.message) {
          return validationError;
        }
      }
      const validationError = this.normalizedValidationError(record['messageKey'], record['message']);
      if (validationError.key || validationError.message) {
        return validationError;
      }
    }
    return { key: 'event.checkout.promo.verify.failed', message: '' };
  }

  private normalizedValidationError(messageKey: unknown, message: unknown): PromoCodeValidationError {
    const normalizedMessageKey = `${messageKey ?? ''}`.trim();
    const normalizedMessage = `${message ?? ''}`.trim();
    return {
      key: normalizedMessageKey || (normalizedMessage === 'A promo code is invalid or no longer active.'
        ? EVENT_CHECKOUT_PROMO_CODE_INVALID_MESSAGE_KEY
        : ''),
      message: normalizedMessage
    };
  }

  private normalizedAppliedCodes(): string[] {
    return [...new Set((this.appliedPromoCodes ?? [])
      .map(code => this.normalizeCode(code))
      .filter(Boolean))];
  }

  private promoDefinition(code: string): ContractTypes.PricingPromoCode | null {
    const normalizedCode = this.normalizeCode(code);
    return (this.availablePromoCodes ?? [])
      .find(item => this.normalizeCode(item.code) === normalizedCode) ?? null;
  }

  private promoEffectLabel(action: ContractTypes.PricingAction): string {
    const value = Math.max(0, Number(action?.value) || 0);
    const formattedValue = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2
    }).format(value);
    switch (action?.kind) {
      case 'decrease_percent':
        return `-${formattedValue}%`;
      case 'increase_percent':
        return `+${formattedValue}%`;
      case 'decrease_amount':
        return `-${formattedValue}`;
      case 'increase_amount':
        return `+${formattedValue}`;
      default:
        return `= ${formattedValue}`;
    }
  }

  private normalizeCode(value: string | null | undefined): string {
    return `${value ?? ''}`.trim().toUpperCase();
  }

  private nextOwnerId(): string {
    EventPromoCodePopupComponent.ownerSequence += 1;
    return `event-promo-code-popup-${Date.now()}-${EventPromoCodePopupComponent.ownerSequence}`;
  }
}
