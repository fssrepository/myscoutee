import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { I18nPipe } from '../../pipes';

@Component({
  selector: 'app-install-prompt',
  standalone: true,
  imports: [I18nPipe, MatIconModule],
  templateUrl: './app-install-prompt.component.html',
  styleUrl: './app-install-prompt.component.scss'
})
export class AppInstallPromptComponent {
  @Input() visible = false;
  @Input() busy = false;

  @Output() readonly installRequested = new EventEmitter<void>();
  @Output() readonly dismissRequested = new EventEmitter<void>();

  protected requestInstall(): void {
    if (this.busy) {
      return;
    }
    this.installRequested.emit();
  }

  protected dismiss(): void {
    if (this.busy) {
      return;
    }
    this.dismissRequested.emit();
  }
}
