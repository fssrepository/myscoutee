import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-navigator-settings-item',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './navigator-settings-item.component.html',
  styleUrl: './navigator-settings-item.component.scss'
})
export class NavigatorSettingsItemComponent {
  @Input({ required: true }) icon = '';
  @Input({ required: true }) label = '';
  @Input() danger = false;
  @Input() href: string | null = null;
  @Input() target: string | null = null;
  @Input() rel: string | null = null;

  @Output() readonly activate = new EventEmitter<Event>();

  protected onActivate(event: Event): void {
    this.activate.emit(event);
  }
}
