import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { I18nPipe } from '../../../pipes';

@Component({
  selector: 'app-on-off-toggle', standalone: true, imports: [MatIconModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './on-off-toggle.component.scss',
  template: `<button type="button" class="on-off-toggle" [class.is-on]="enabled"
    [disabled]="disabled" [attr.aria-pressed]="enabled" [attr.aria-label]="label | i18n"
    (click)="enabledChange.emit(!enabled)">
    <mat-icon>{{ enabled ? 'toggle_on' : 'toggle_off' }}</mat-icon>
    <span>{{ (enabled ? 'on' : 'off') | i18n }}</span>
  </button>`
})
export class OnOffToggleComponent {
  @Input() enabled = false;
  @Input() disabled = false;
  @Input() label = '';
  @Output() readonly enabledChange = new EventEmitter<boolean>();
}
