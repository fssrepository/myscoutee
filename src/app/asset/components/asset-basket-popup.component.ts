import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LazyBgImageDirective } from '../../shared/lazy-bg-image.directive';
import type { AssetPopupHost } from '../asset-popup.host';

@Component({
  selector: 'app-asset-basket-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    LazyBgImageDirective
  ],
  templateUrl: './asset-basket-popup.component.html',
  styleUrls: ['./asset-basket-popup.component.scss']
})
export class AssetBasketPopupComponent {
  @Input({ required: true }) host!: AssetPopupHost;
}
