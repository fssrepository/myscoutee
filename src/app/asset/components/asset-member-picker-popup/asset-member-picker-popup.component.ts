import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import type { AssetPopupHost } from '../../asset-popup.host';

@Component({
  selector: 'app-asset-member-picker-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './asset-member-picker-popup.component.html',
  styleUrls: ['./asset-member-picker-popup.component.scss']
})
export class AssetMemberPickerPopupComponent {
  @Input({ required: true }) host!: AssetPopupHost;
}
