import { Injectable, signal } from '@angular/core';

export type OperatorMenuKind =
  | 'registry'
  | 'branding'
  | 'payments'
  | 'firebase'
  | 'leaderboard'
  | 'connections'
  | 'updates'
  | 'community';

export type OperatorRegistrySection =
  | 'configuration'
  | 'identity'
  | 'deployment'
  | 'receipt';

@Injectable({
  providedIn: 'root'
})
export class OperatorMenuStore {
  private readonly activePopupRef = signal<OperatorMenuKind | null>(null);
  private readonly registrySectionRef = signal<OperatorRegistrySection>('configuration');

  readonly activePopup = this.activePopupRef.asReadonly();
  readonly registrySection = this.registrySectionRef.asReadonly();

  open(kind: OperatorMenuKind): void {
    if (kind === 'registry') {
      this.registrySectionRef.set('configuration');
    }
    this.activePopupRef.set(kind);
  }

  openRegistry(section: OperatorRegistrySection = 'configuration'): void {
    this.registrySectionRef.set(section);
    this.activePopupRef.set('registry');
  }

  closePopup(): void {
    this.activePopupRef.set(null);
    this.registrySectionRef.set('configuration');
  }
}
