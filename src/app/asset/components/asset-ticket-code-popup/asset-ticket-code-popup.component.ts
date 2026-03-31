
import { Component, Input } from '@angular/core';

import type * as AppTypes from '../../../shared/core/base/models';

@Component({
  selector: 'app-asset-ticket-code-popup',
  standalone: true,
  imports: [],
  templateUrl: './asset-ticket-code-popup.component.html',
  styleUrl: './asset-ticket-code-popup.component.scss'
})
export class AssetTicketCodePopupComponent {
  @Input() selectedTicketRow: AppTypes.ActivityListRow | null = null;
  @Input() avatarUrl = '';
  @Input() initials = '';
  @Input() personLine = '';
  @Input() roleEventLine = '';
  @Input() dateLine = '';
  @Input() qrImageUrl = '';
}
