import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export interface BasketChip {
  id: string;
  label: string;
  icon?: string | null;
  avatarLabel?: string | null;
  avatarClass?: string | string[] | Record<string, boolean> | null;
  trailingIcon?: string | null;
  disabled?: boolean;
}

@Component({
  selector: 'app-basket',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './basket.component.html',
  styleUrl: './basket.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BasketComponent {
  @Input() chips: readonly BasketChip[] = [];
  @Input() disabled = false;
  @Input() className = '';

  @Output() readonly chipClick = new EventEmitter<{ chip: BasketChip; event: Event }>();

  protected trackByChipId(_index: number, chip: BasketChip): string {
    return chip.id;
  }

  protected onChipClick(chip: BasketChip, event: Event): void {
    event.stopPropagation();
    if (this.disabled || chip.disabled) {
      return;
    }
    this.chipClick.emit({ chip, event });
  }
}
