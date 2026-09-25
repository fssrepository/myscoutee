import { Component, computed, input, signal } from '@angular/core';
import { AppMenuComponent, type AppMenuItem } from '../menu';
import { I18nPipe } from '../../../pipes/i18n.pipe';

@Component({
  selector: 'app-copy-link', standalone: true, imports: [AppMenuComponent, I18nPipe],
  template: `
    <input readonly [value]="value()" [attr.aria-label]="label() | i18n" />
    <app-menu kind="inline" layout="row" [model]="{actionSizing: 'content'}"
      [items]="actions()" (itemSelect)="copy()"></app-menu>
    @if (failed()) { <span role="alert">{{ 'invite.external.copy.failed' | i18n }}</span> }
  `,
  styles: [`
    :host { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center;
      gap: .42rem; margin-top: .28rem; }
    input { min-width: 0; width: 100%; box-sizing: border-box; padding: .42rem .5rem;
      border: 1px solid #c3d2e5; border-radius: 8px; background: #f5f8fc; color: #315d91;
      font-size: .7rem; overflow-wrap: anywhere; user-select: all; }
    [role=alert] { grid-column: 1 / -1; }
  `]
})
export class CopyLinkComponent {
  readonly value = input.required<string>();
  readonly label = input('affiliate.personal.link');
  readonly copyLabel = input('affiliate.copy');
  readonly disabled = input(false);
  private readonly copied = signal('');
  protected readonly failed = signal(false);
  protected readonly actions = computed<AppMenuItem[]>(() => [{
    id: 'copy', kind: 'action', hideLabel: true, layout: 'icon', ariaLabel: this.copyLabel(),
    icon: this.value() && this.copied() === this.value() ? 'done' : 'content_copy',
    palette: this.value() && this.copied() === this.value() ? 'green' : 'blue',
    disabled: this.disabled() || !this.value()
  }]);
  protected async copy(): Promise<void> {
    const value = this.value();
    if (!value || this.disabled()) return;
    this.failed.set(false);
    try { await navigator.clipboard.writeText(value); this.copied.set(value); }
    catch { this.failed.set(true); }
  }
}
