import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import type * as AppTypes from '../../shared/app-types';

@Component({
  selector: 'app-asset-ticket-code-popup',
  standalone: true,
  imports: [CommonModule],
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
