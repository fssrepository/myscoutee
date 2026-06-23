
import { Component, Input } from '@angular/core';

import type * as AssetContracts from '../../../shared/core/contracts/asset.interface';

@Component({
  selector: 'app-asset-ticket-code-popup',
  standalone: true,
  imports: [],
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
}
