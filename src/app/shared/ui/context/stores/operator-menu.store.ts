import { Injectable, signal } from '@angular/core';

export type OperatorMenuKind =
  | 'updates'
  | 'registration'
  | 'claim'
  | 'configuration'
  | 'community';

@Injectable({
  providedIn: 'root'
})
export class OperatorMenuStore {
  private readonly activePopupRef = signal<OperatorMenuKind | null>(null);

  readonly activePopup = this.activePopupRef.asReadonly();

  open(kind: OperatorMenuKind): void {
    this.activePopupRef.set(kind);
  }

  closePopup(): void {
    this.activePopupRef.set(null);
  }
}
