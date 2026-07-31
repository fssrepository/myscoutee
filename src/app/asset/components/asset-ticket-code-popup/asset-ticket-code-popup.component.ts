
import { Component, Input } from '@angular/core';

import { I18nPipe } from '../../../shared/ui';

import type * as AssetContracts from '../../../shared/core/contracts/asset.interface';

@Component({
  selector: 'app-asset-ticket-code-popup',
  standalone: true,
  imports: [I18nPipe],
  templateUrl: './asset-ticket-code-popup.component.html',
  styleUrl: './asset-ticket-code-popup.component.scss'
})
export class AssetTicketCodePopupComponent {
  @Input() selectedTicketRow: AssetContracts.AssetTicketDTO | null = null;
  @Input() avatarUrl = '';
  @Input() initials = '';
  @Input() personLine = '';
  @Input() roleEventLine = '';
  @Input() dateLine = '';
  @Input() qrImageUrl = '';

  protected checkedInAtLabel(): string {
    const usedAtIso = `${this.selectedTicketRow?.usedAtIso ?? ''}`.trim();
    if (!usedAtIso) {
      return '';
    }
    const parsed = new Date(usedAtIso);
    if (Number.isNaN(parsed.getTime())) {
      return usedAtIso;
    }
    return parsed.toLocaleString();
  }
}
