import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { LazyBgImageDirective } from '../../../../lazy-bg-image.directive';

@Component({
  selector: 'app-info-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, LazyBgImageDirective],
  templateUrl: './info-card.component.html',
  styleUrl: './info-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InfoCardComponent {
  @Input() imageUrl = '';
  @Input() icon = '';
  @Input() title = '';
  @Input() description = '';
  @Input() metaRows: readonly string[] = [];
  @Input() compact = false;
}
