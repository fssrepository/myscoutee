import { Injectable, Type, signal } from '@angular/core';

export interface EventPromoCodeAddPopupState {
  ownerId: string;
  title: string;
  subtitle: string;
  zIndex: number;
  appliedPromoCodes: readonly string[];
  busy: boolean;
  validationErrorKey: string;
  validationError: string;
}

interface EventPromoCodeAddPopupActionBase {
  ownerId: string;
  requestId: number;
  event?: Event;
}

export type EventPromoCodeAddPopupActionRequest =
  | (EventPromoCodeAddPopupActionBase & { kind: 'close' })
  | (EventPromoCodeAddPopupActionBase & {
    kind: 'verify';
    code: string;
  });

type EventPromoCodeAddPopupActionPayload =
  | (Omit<EventPromoCodeAddPopupActionBase, 'requestId'> & { kind: 'close' })
  | (Omit<EventPromoCodeAddPopupActionBase, 'requestId'> & {
    kind: 'verify';
    code: string;
  });

@Injectable({
  providedIn: 'root'
})
export class EventPromoCodePopupStore {
  private readonly addPopupRef = signal<EventPromoCodeAddPopupState | null>(null);
  private readonly addPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly addPopupLoadingRef = signal(false);
  private readonly addPopupActionRequestRef = signal<EventPromoCodeAddPopupActionRequest | null>(null);
  private addPopupActionSequence = 0;
  private addPopupLoadPromise: Promise<void> | null = null;

  readonly addPopup = this.addPopupRef.asReadonly();
  readonly addPopupComponent = this.addPopupComponentRef.asReadonly();
  readonly addPopupLoading = this.addPopupLoadingRef.asReadonly();
  readonly addPopupActionRequest = this.addPopupActionRequestRef.asReadonly();

  openAddPopup(popup: EventPromoCodeAddPopupState): void {
    this.addPopupRef.set(this.clonePopup(popup));
  }

  updateAddPopup(popup: EventPromoCodeAddPopupState): void {
    const current = this.addPopupRef();
    if (current && current.ownerId !== popup.ownerId) {
      return;
    }
    this.addPopupRef.set(this.clonePopup(popup));
  }

  closeAddPopup(ownerId?: string): void {
    const current = this.addPopupRef();
    if (ownerId && current?.ownerId !== ownerId) {
      return;
    }
    this.addPopupRef.set(null);
  }

  requestAddPopupClose(ownerId: string, event?: Event): void {
    this.requestAddPopupAction({ ownerId, kind: 'close', event });
  }

  requestAddPopupVerification(ownerId: string, code: string, event?: Event): void {
    this.requestAddPopupAction({ ownerId, kind: 'verify', code, event });
  }

  async ensureAddPopupLoaded(): Promise<void> {
    if (this.addPopupComponentRef()) {
      return;
    }
    if (this.addPopupLoadPromise) {
      return this.addPopupLoadPromise;
    }

    this.addPopupLoadingRef.set(true);
    const loadPromise = import('./event-promo-code-add-popup.component')
      .then(module => {
        this.addPopupComponentRef.set(module.EventPromoCodeAddPopupComponent);
      })
      .finally(() => {
        this.addPopupLoadingRef.set(false);
        this.addPopupLoadPromise = null;
      });
    this.addPopupLoadPromise = loadPromise;
    return loadPromise;
  }

  private requestAddPopupAction(request: EventPromoCodeAddPopupActionPayload): void {
    this.addPopupActionSequence += 1;
    this.addPopupActionRequestRef.set({
      ...request,
      requestId: this.addPopupActionSequence
    });
  }

  private clonePopup(popup: EventPromoCodeAddPopupState): EventPromoCodeAddPopupState {
    return {
      ...popup,
      appliedPromoCodes: [...popup.appliedPromoCodes]
    };
  }
}
