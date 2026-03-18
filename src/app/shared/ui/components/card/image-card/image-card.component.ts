import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { LazyBgImageDirective } from '../../../../lazy-bg-image.directive';

@Component({
  selector: 'app-image-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, LazyBgImageDirective],
  templateUrl: './image-card.component.html',
  styleUrl: './image-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageCardComponent {
  @Input() imageUrl = '';
  @Input() title = '';
  @Input() subtitle = '';
  @Input() detail = '';
  @Input() label: string | null = null;
  @Input() placeholder = '';
}
