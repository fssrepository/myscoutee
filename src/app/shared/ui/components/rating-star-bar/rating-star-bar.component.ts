import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-rating-star-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rating-star-bar.component.html',
  styleUrl: './rating-star-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RatingStarBarComponent {
  @Input() scale: readonly number[] = [];
  @Input() value = 0;
  @Input() readonly = false;
  @Input() blink = false;
  @Input() label: string | null = null;
  @Input() presentation: 'list' | 'fullscreen' = 'list';

  @Output() readonly scoreSelect = new EventEmitter<number>();

  protected selectScore(score: number, event: Event): void {
    event.stopPropagation();
    if (this.readonly) {
      return;
    }
    this.scoreSelect.emit(score);
  }

  protected isFilled(score: number): boolean {
    return score <= this.value;
  }
}
