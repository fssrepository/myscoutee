import { Injectable, Type, signal } from '@angular/core';

export interface FormFlowRouteInputPopupSaveValue {
  routeEnabled: boolean;
  routes: readonly string[];
}

export interface FormFlowRouteInputPopupState {
  ownerId: string;
  title: string;
  subtitle: string;
  zIndex: number;
  routeEnabled: boolean;
  routes: string[];
  onSave?: (
    value: FormFlowRouteInputPopupSaveValue
  ) => void | FormFlowRouteInputPopupSaveValue | Promise<void | FormFlowRouteInputPopupSaveValue>;
}

@Injectable({
  providedIn: 'root'
})
export class FormFlowPopupStore {
  readonly routeInputPopupRef = signal<FormFlowRouteInputPopupState | null>(null);

  private readonly routeInputPopupComponentRef = signal<Type<unknown> | null>(null);

  readonly routeInputPopupComponent = this.routeInputPopupComponentRef.asReadonly();

  openRouteInputPopup(popup: FormFlowRouteInputPopupState): void {
    this.routeInputPopupRef.set(this.cloneRouteInputPopup(popup));
  }

  closeRouteInputPopup(ownerId?: string): void {
    const popup = this.routeInputPopupRef();
    if (ownerId && popup?.ownerId !== ownerId) {
      return;
    }
    this.routeInputPopupRef.set(null);
  }

  async ensureRouteInputPopupLoaded(): Promise<void> {
    if (this.routeInputPopupComponentRef()) {
      return;
    }
    const module = await import('../inputs/route-input/route-input-popup/route-input-popup.component');
    this.routeInputPopupComponentRef.set(module.RouteInputPopupComponent);
  }

  private cloneRouteInputPopup(popup: FormFlowRouteInputPopupState): FormFlowRouteInputPopupState {
    return {
      ...popup,
      routes: [...popup.routes]
    };
  }
}
