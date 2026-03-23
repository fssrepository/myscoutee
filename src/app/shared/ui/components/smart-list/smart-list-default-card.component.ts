import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-smart-list-default-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './smart-list-default-card.component.html',
  styleUrl: './smart-list-default-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SmartListDefaultCardComponent {
  @Input() item: unknown;

  protected title(): string {
    if (typeof this.item === 'string' || typeof this.item === 'number') {
      return String(this.item);
    }
    if (this.item && typeof this.item === 'object') {
      const candidate = (this.item as { title?: unknown; name?: unknown; label?: unknown }).title
        ?? (this.item as { name?: unknown }).name
        ?? (this.item as { label?: unknown }).label;
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
    return 'List item';
  }

  protected subtitle(): string {
    if (this.item && typeof this.item === 'object') {
      const candidate = (this.item as { subtitle?: unknown; description?: unknown; detail?: unknown }).subtitle
        ?? (this.item as { description?: unknown }).description
        ?? (this.item as { detail?: unknown }).detail;
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
    return 'Provide `itemTemplate` to render a custom card.';
  }
}
