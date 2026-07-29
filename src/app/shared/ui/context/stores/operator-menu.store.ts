import { Injectable, signal } from '@angular/core';

import type { OperatorLeaderboardEntryDto } from '../../../core/contracts/operator.interface';

export type OperatorMenuKind =
  | 'updates'
  | 'registration'
  | 'claim'
  | 'configuration'
  | 'revenue'
  | 'community'
  | 'deployments';

@Injectable({
  providedIn: 'root'
})
export class OperatorMenuStore {
  private readonly activePopupRef = signal<OperatorMenuKind | null>(null);
  private readonly selectedLeaderboardEntryRef =
    signal<OperatorLeaderboardEntryDto | null>(null);

  readonly activePopup = this.activePopupRef.asReadonly();
  readonly selectedLeaderboardEntry =
    this.selectedLeaderboardEntryRef.asReadonly();

  open(kind: OperatorMenuKind): void {
    this.activePopupRef.set(kind);
  }

  openLeaderboardDeployments(entry: OperatorLeaderboardEntryDto): void {
    const groupId = entry.operatorGroupId?.trim() ?? '';
    if (entry.group !== 'CLAIMED' || !groupId) {
      return;
    }
    this.selectedLeaderboardEntryRef.set(structuredClone({
      ...entry,
      operatorGroupId: groupId
    }));
    this.activePopupRef.set('deployments');
  }

  closePopup(): void {
    this.activePopupRef.set(null);
  }
}
