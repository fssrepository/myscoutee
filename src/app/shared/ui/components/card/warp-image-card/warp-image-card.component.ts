import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { I18nPipe } from '../../../pipes';

export type WarpImageCardTone = 'blue' | 'purple' | 'pink' | 'orange';

export interface WarpImageCardData {
  readonly id: string;
  readonly index: string;
  readonly titleKey: string;
  readonly title: string;
  readonly messageKey: string;
  readonly message: string;
  readonly tone?: WarpImageCardTone | null;
  readonly sliceX?: string | null;
  readonly sliceY?: string | null;
}

@Component({
  selector: 'app-warp-image-card',
  standalone: true,
  imports: [
    CommonModule,
    I18nPipe
  ],
  templateUrl: './warp-image-card.component.html',
  styleUrl: './warp-image-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WarpImageCardComponent {
  @Input() card: WarpImageCardData | null = null;

  protected rootClassList(): string[] {
    return [
      'experience-item-card',
      'ui-warp-image-card',
      `ui-warp-image-card--${this.resolvedTone()}`
    ];
  }

  protected resolvedTone(): WarpImageCardTone {
    const tone = this.card?.tone;
    return tone === 'blue' || tone === 'purple' || tone === 'pink' || tone === 'orange'
      ? tone
      : 'blue';
  }

  protected visualStyle(): Record<string, string> {
    return {
      '--warp-image-slice-x': `${this.card?.sliceX ?? '0%'}`,
      '--warp-image-slice-y': `${this.card?.sliceY ?? '0%'}`
    };
  }
}
