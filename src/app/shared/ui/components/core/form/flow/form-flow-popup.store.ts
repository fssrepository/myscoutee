import { Injectable, Type, signal } from '@angular/core';

export interface FormFlowPricingEditorPopupState {
  ownerId: string;
  title: string;
  subtitle: string;
  zIndex: number;
  value: unknown;
  config: unknown;
  readOnly: boolean;
  canSave: boolean;
}

export interface FormFlowPolicyEditorPopupState {
  ownerId: string;
  title: string;
  subtitle: string;
  zIndex: number;
  value: unknown;
  requiredCheckboxLabel: string;
  readOnly: boolean;
}

interface FormFlowPricingEditorPopupActionBase {
  ownerId: string;
  requestId: number;
  event?: Event;
}

interface FormFlowPolicyEditorPopupActionBase {
  ownerId: string;
  requestId: number;
  event?: Event;
}

export type FormFlowPricingEditorPopupActionRequest =
  | (FormFlowPricingEditorPopupActionBase & { kind: 'close' })
  | (FormFlowPricingEditorPopupActionBase & {
    kind: 'save';
    value: unknown;
  });

export type FormFlowPolicyEditorPopupActionRequest =
  | (FormFlowPolicyEditorPopupActionBase & { kind: 'close' })
  | (FormFlowPolicyEditorPopupActionBase & {
    kind: 'save';
    value: unknown;
  });

type FormFlowPricingEditorPopupActionPayload =
  | (Omit<FormFlowPricingEditorPopupActionBase, 'requestId'> & { kind: 'close' })
  | (Omit<FormFlowPricingEditorPopupActionBase, 'requestId'> & {
    kind: 'save';
    value: unknown;
  });

type FormFlowPolicyEditorPopupActionPayload =
  | (Omit<FormFlowPolicyEditorPopupActionBase, 'requestId'> & { kind: 'close' })
  | (Omit<FormFlowPolicyEditorPopupActionBase, 'requestId'> & {
    kind: 'save';
    value: unknown;
  });

@Injectable({
  providedIn: 'root'
})
export class FormFlowPopupStore {
  readonly pricingEditorPopupRef = signal<FormFlowPricingEditorPopupState | null>(null);
  readonly policyEditorPopupRef = signal<FormFlowPolicyEditorPopupState | null>(null);
  private readonly pricingEditorPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly pricingEditorPopupActionRequestRef = signal<FormFlowPricingEditorPopupActionRequest | null>(null);
  private readonly policyEditorPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly policyEditorPopupActionRequestRef = signal<FormFlowPolicyEditorPopupActionRequest | null>(null);
  private pricingEditorPopupActionSequence = 0;
  private policyEditorPopupActionSequence = 0;
  readonly pricingEditorPopupComponent = this.pricingEditorPopupComponentRef.asReadonly();
  readonly pricingEditorPopupActionRequest = this.pricingEditorPopupActionRequestRef.asReadonly();
  readonly policyEditorPopupComponent = this.policyEditorPopupComponentRef.asReadonly();
  readonly policyEditorPopupActionRequest = this.policyEditorPopupActionRequestRef.asReadonly();

  openPricingEditorPopup(popup: FormFlowPricingEditorPopupState): void {
    this.pricingEditorPopupRef.set({ ...popup });
  }

  updatePricingEditorPopup(popup: FormFlowPricingEditorPopupState): void {
    const current = this.pricingEditorPopupRef();
    if (current && current.ownerId !== popup.ownerId) {
      return;
    }
    this.pricingEditorPopupRef.set({ ...popup });
  }

  closePricingEditorPopup(ownerId?: string): void {
    const current = this.pricingEditorPopupRef();
    if (ownerId && current?.ownerId !== ownerId) {
      return;
    }
    this.pricingEditorPopupRef.set(null);
  }

  openPolicyEditorPopup(popup: FormFlowPolicyEditorPopupState): void {
    this.policyEditorPopupRef.set({ ...popup });
  }

  updatePolicyEditorPopup(popup: FormFlowPolicyEditorPopupState): void {
    const current = this.policyEditorPopupRef();
    if (current && current.ownerId !== popup.ownerId) {
      return;
    }
    this.policyEditorPopupRef.set({ ...popup });
  }

  closePolicyEditorPopup(ownerId?: string): void {
    const current = this.policyEditorPopupRef();
    if (ownerId && current?.ownerId !== ownerId) {
      return;
    }
    this.policyEditorPopupRef.set(null);
  }

  requestPricingEditorPopupClose(ownerId: string, event?: Event): void {
    this.requestPricingEditorPopupAction({ ownerId, kind: 'close', event });
  }

  requestPricingEditorPopupSave(ownerId: string, value: unknown, event?: Event): void {
    this.requestPricingEditorPopupAction({ ownerId, kind: 'save', value, event });
  }

  requestPolicyEditorPopupClose(ownerId: string, event?: Event): void {
    this.requestPolicyEditorPopupAction({ ownerId, kind: 'close', event });
  }

  requestPolicyEditorPopupSave(ownerId: string, value: unknown, event?: Event): void {
    this.requestPolicyEditorPopupAction({ ownerId, kind: 'save', value, event });
  }

  async ensurePricingEditorPopupLoaded(): Promise<void> {
    if (this.pricingEditorPopupComponentRef()) {
      return;
    }
    const module = await import('../inputs/pricing-editor/pricing-editor-popup/pricing-editor-popup.component');
    this.pricingEditorPopupComponentRef.set(module.PricingEditorPopupComponent);
  }

  async ensurePolicyEditorPopupLoaded(): Promise<void> {
    if (this.policyEditorPopupComponentRef()) {
      return;
    }
    const module = await import('../inputs/policies-input/policies-input-popup/policies-input-popup.component');
    this.policyEditorPopupComponentRef.set(module.PoliciesInputPopupComponent);
  }

  private requestPricingEditorPopupAction(request: FormFlowPricingEditorPopupActionPayload): void {
    this.pricingEditorPopupActionSequence += 1;
    this.pricingEditorPopupActionRequestRef.set({
      ...request,
      requestId: this.pricingEditorPopupActionSequence
    });
  }

  private requestPolicyEditorPopupAction(request: FormFlowPolicyEditorPopupActionPayload): void {
    this.policyEditorPopupActionSequence += 1;
    this.policyEditorPopupActionRequestRef.set({
      ...request,
      requestId: this.policyEditorPopupActionSequence
    });
  }
}
