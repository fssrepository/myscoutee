import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { PricingBuilder } from '../../../../../../../core/base/builders';
import type * as ContractTypes from '../../../../../../../core/contracts';
import { PricingSlotPanelComponent } from '../../../popups/pricing-slot-panel';
import {
  FormFlowPopupStore,
  type FormFlowPricingEditorPopupState
} from '../../../flow/form-flow-popup.store';
import {
  PopupComponent,
  type PopupAction,
  type PopupActionEvent,
  type PopupModel
} from '../../../../popup';
import {
  PricingEditorInputComponent,
  type PricingEditorConfig
} from '../pricing-editor.component';

@Component({
  selector: 'app-pricing-editor-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    PopupComponent,
    PricingSlotPanelComponent
  ],
  templateUrl: './pricing-editor-popup.component.html',
  styleUrls: [
    '../pricing-editor.component.scss',
    './pricing-editor-popup.component.scss'
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PricingEditorPopupComponent extends PricingEditorInputComponent implements OnChanges {
  @Input() popup: FormFlowPricingEditorPopupState | null = null;

  protected draftValue: ContractTypes.PricingConfig = PricingBuilder.createDefaultPricingConfig('event');

  private locallyDirty = false;
  private originalValue: ContractTypes.PricingConfig = PricingBuilder.createDefaultPricingConfig('event');
  private readonly popupStore = inject(FormFlowPopupStore);

  constructor() {
    super(inject(ChangeDetectorRef));
  }

  override ngOnChanges(changes: SimpleChanges): void {
    if (!changes['popup'] || !this.popup) {
      super.ngOnChanges(changes);
      return;
    }
    this.config = this.popupEditorConfig(this.popup);
    this.readOnly = this.popup.readOnly;
    this.disabled = this.popup.readOnly;
    super.ngOnChanges({ config: changes['popup'] });
    this.writeValue(PricingBuilder.clonePricingConfig(this.popup.value as ContractTypes.PricingConfig));
    this.originalValue = PricingBuilder.clonePricingConfig(this.workingPricing);
    this.draftValue = PricingBuilder.clonePricingConfig(this.workingPricing);
    this.locallyDirty = false;
  }

  protected override afterPricingChange(nextPricing: ContractTypes.PricingConfig): void {
    this.draftValue = PricingBuilder.clonePricingConfig(nextPricing);
    this.locallyDirty = this.hasDraftChanges();
  }

  protected pricingPopupModel(popup: FormFlowPricingEditorPopupState): PopupModel {
    return {
      title: popup.title,
      subtitle: popup.subtitle,
      ariaLabel: 'Pricing setup wizard',
      closeAriaLabel: 'Close pricing setup',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      headerActions: this.pricingPopupHeaderActions(popup),
      onClose: event => this.close(popup, event),
      onAction: event => this.onPricingPopupAction(popup, event)
    };
  }

  private close(popup: FormFlowPricingEditorPopupState, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.popupStore.requestPricingEditorPopupClose(popup.ownerId, event);
  }

  private onPricingPopupAction(popup: FormFlowPricingEditorPopupState, event: PopupActionEvent): void {
    if (event.action.id !== 'pricing-save') {
      return;
    }
    this.popupStore.requestPricingEditorPopupSave(popup.ownerId, this.draftValue, event.sourceEvent);
  }

  private pricingPopupHeaderActions(popup: FormFlowPricingEditorPopupState): readonly PopupAction[] {
    if (popup.readOnly) {
      return [];
    }
    const canSave = this.canSubmit(popup);
    return [{
      id: 'pricing-save',
      icon: 'done',
      ariaLabel: 'Apply pricing draft',
      palette: canSave ? 'success' : 'danger',
      disabled: !canSave
    }];
  }

  private canSubmit(popup: FormFlowPricingEditorPopupState): boolean {
    return !popup.readOnly && (popup.canSave || this.locallyDirty || this.hasDraftChanges());
  }

  private hasDraftChanges(): boolean {
    return JSON.stringify(this.draftValue) !== JSON.stringify(this.originalValue);
  }

  private popupEditorConfig(popup: FormFlowPricingEditorPopupState): PricingEditorConfig {
    return popup.config as PricingEditorConfig;
  }
}
