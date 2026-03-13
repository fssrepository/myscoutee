import { Injectable, signal } from '@angular/core';

import type { AssetPopupHost } from './asset-popup.host';

@Injectable({ providedIn: 'root' })
export class AssetPopupService {
  private readonly hostRef = signal<AssetPopupHost | null>(null);
  private readonly visibleRef = signal(false);

  readonly host = this.hostRef.asReadonly();
  readonly visible = this.visibleRef.asReadonly();

  registerHost(host: AssetPopupHost | null): void {
    this.hostRef.set(host);
  }

  syncVisibility(isPrimaryOpen: boolean, isStackedOpen: boolean): void {
    this.visibleRef.set(isPrimaryOpen || isStackedOpen);
  }
}
