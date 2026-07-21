import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  FormFlowComponent,
  I18nPipe,
  PopupComponent,
  type FormFlowModel,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel
} from '../../../../shared/ui';
import {
  EventPromoCodePopupStore,
  type EventPromoCodeAddPopupState
} from './event-promo-code-popup.store';

interface PromoCodeDraftValue {
  code: string;
}

@Component({
  selector: 'app-event-promo-code-add-popup',
  standalone: true,
  imports: [
    FormsModule,
    FormFlowComponent,
    I18nPipe,
    PopupComponent
  ],
  templateUrl: './event-promo-code-add-popup.component.html',
  styleUrl: './event-promo-code-add-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventPromoCodeAddPopupComponent implements OnChanges {
  @Input() popup: EventPromoCodeAddPopupState | null = null;

  protected draftValue: PromoCodeDraftValue = this.emptyDraft();
  protected errorMessageKey = '';
  protected errorMessage = '';

  private readonly popupStore = inject(EventPromoCodePopupStore);
  private activeOwnerId = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['popup'] || !this.popup) {
      return;
    }
    if (this.popup.ownerId !== this.activeOwnerId) {
      this.activeOwnerId = this.popup.ownerId;
      this.draftValue = this.emptyDraft();
      this.errorMessageKey = '';
      this.errorMessage = '';
    }
    this.errorMessageKey = this.popup.validationErrorKey;
    this.errorMessage = this.popup.validationError;
  }

  protected popupModel(popup: EventPromoCodeAddPopupState): PopupModel<unknown> {
    return {
      title: popup.title,
      subtitle: popup.subtitle,
      ariaLabel: 'event.checkout.promo.add.aria',
      closeAriaLabel: 'event.checkout.promo.add.close.aria',
      closeOnBackdrop: !popup.busy,
      size: 'default',
      height: 'auto',
      headerTone: 'accent',
      backdropTone: 'dim',
      headerControls: this.headerControls(popup),
      onClose: event => this.close(popup, event),
      onMenuSelect: event => this.onMenuSelect(popup, event)
    };
  }

  protected flowModel(popup: EventPromoCodeAddPopupState): FormFlowModel {
    return {
      title: popup.title,
      subtitle: popup.subtitle,
      layout: 'grouped',
      header: false,
      summary: { enabled: false },
      completion: { controls: 'required' },
      save: null,
      loadingLabel: 'event.checkout.promo.validating',
      steps: [{
        id: 'promo-code',
        title: '',
        chrome: 'none',
        controls: [{
          id: 'code',
          bind: 'code',
          kind: 'text',
          layout: 'wide',
          label: 'event.checkout.promo.input.label',
          placeholder: 'event.checkout.promo.input.placeholder',
          description: 'event.checkout.promo.input.hint',
          maxLength: 64,
          required: true
        }]
      }]
    };
  }

  protected updateDraft(value: unknown): void {
    const record = value && typeof value === 'object'
      ? value as Record<string, unknown>
      : {};
    this.draftValue = {
      code: `${record['code'] ?? ''}`.toUpperCase()
    };
    this.errorMessageKey = '';
    this.errorMessage = '';
  }

  private headerControls(popup: EventPromoCodeAddPopupState): readonly PopupControl<unknown>[] {
    return [{
      kind: 'menu',
      id: 'promo-code-add-actions',
      menuKind: 'inline',
      closeOnSelect: false,
      items: [{
        id: 'promo-code-add-verify',
        icon: 'done',
        kind: 'action',
        palette: 'green',
        disabled: popup.busy || !this.normalizeCode(this.draftValue.code),
        closeOnSelect: false,
        ariaLabel: 'event.checkout.promo.add.verify.aria',
        progress: {
          state: popup.busy ? 'loading' : null,
          shape: 'circle'
        }
      }]
    }];
  }

  private onMenuSelect(
    popup: EventPromoCodeAddPopupState,
    event: PopupMenuSelectEvent<unknown>
  ): void {
    if (event.itemSelect.id !== 'promo-code-add-verify' || popup.busy) {
      return;
    }
    event.itemSelect.sourceEvent.preventDefault();
    event.itemSelect.sourceEvent.stopPropagation();
    const code = this.validateDraft(popup);
    if (!code) {
      return;
    }
    this.errorMessageKey = '';
    this.errorMessage = '';
    this.popupStore.requestAddPopupVerification(popup.ownerId, code, event.itemSelect.sourceEvent);
  }

  private close(popup: EventPromoCodeAddPopupState, event?: Event): void {
    if (popup.busy) {
      return;
    }
    event?.preventDefault();
    event?.stopPropagation();
    this.popupStore.requestAddPopupClose(popup.ownerId, event);
  }

  private validateDraft(popup: EventPromoCodeAddPopupState): string {
    const code = this.normalizeCode(this.draftValue.code);
    if (!code) {
      this.errorMessageKey = 'event.checkout.promo.required';
      this.errorMessage = '';
      return '';
    }
    if (this.normalizedAppliedCodes(popup).includes(code)) {
      this.errorMessageKey = 'event.checkout.promo.duplicate';
      this.errorMessage = '';
      return '';
    }
    return code;
  }

  private normalizedAppliedCodes(popup: EventPromoCodeAddPopupState): string[] {
    return [...new Set((popup.appliedPromoCodes ?? [])
      .map(code => this.normalizeCode(code))
      .filter(Boolean))];
  }

  private emptyDraft(): PromoCodeDraftValue {
    return { code: '' };
  }

  private normalizeCode(value: string | null | undefined): string {
    return `${value ?? ''}`.trim().toUpperCase();
  }
}
