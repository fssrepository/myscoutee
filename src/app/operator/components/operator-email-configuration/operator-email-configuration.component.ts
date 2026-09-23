import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AppMenuComponent, I18nPipe, type AppMenuItem, type AppMenuItemSelectEvent, type AppMenuPalette } from '../../../shared/ui';
import { OperatorEmailService } from '../../../shared/core/base/services/operator-email.service';
import type { OperatorEmailConfiguration } from '../../../shared/core/contracts/operator-email.interface';
@Component({ selector: 'app-operator-email-configuration', standalone: true, imports: [FormsModule, MatIconModule, AppMenuComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="operator-action-popup__configuration-group" data-palette="cyan">
      <header><span><strong>{{ 'operator.email.title' | i18n }}</strong></span>
        <button type="button" class="operator-action-popup__on-off-toggle"
          [class.is-on]="draft()?.enabled" [disabled]="busy() || !draft()?.availableProviders?.length"
          [attr.aria-label]="'operator.email.enabled' | i18n" [attr.aria-pressed]="!!draft()?.enabled" (click)="toggle()">
          <mat-icon>{{ draft()?.enabled ? 'toggle_on' : 'toggle_off' }}</mat-icon>
          <span>{{ (draft()?.enabled ? 'on' : 'off') | i18n }}</span>
        </button>
      </header>
      @if (draft(); as config) {
        @if (config.availableProviders.length) {
          @if (config.enabled) {
          <label class="operator-action-popup__select-field"><span>{{ 'operator.email.provider' | i18n }}</span>
            <app-menu kind="select" [trigger]="{ label: selectedLabel(), icon: 'mail', palette: 'blue', layout: 'field', disabled: busy() }"
              [items]="providerItems()" (itemSelect)="selectProvider($event)"></app-menu>
          </label>
          <div class="email-configuration__fields">
            <label class="operator-action-popup__field"><span>{{ 'operator.email.fromEmail' | i18n }}</span><input type="email" maxlength="254" [disabled]="busy()" [ngModel]="config.fromEmail" (ngModelChange)="field('fromEmail', $event)"></label>
            <label class="operator-action-popup__field"><span>{{ 'operator.email.fromName' | i18n }}</span><input type="text" maxlength="100" [disabled]="busy()" [ngModel]="config.fromName" (ngModelChange)="field('fromName', $event)"></label>
          </div>
          <label class="operator-action-popup__field"><span>{{ 'operator.email.credential' | i18n }}</span>
            <input type="password" maxlength="4096" autocomplete="new-password" [disabled]="busy()" [(ngModel)]="credential" (ngModelChange)="saved.set(false)"
              [placeholder]="(config.credentialConfigured ? 'operator.email.credentialKept' : 'operator.email.credential') | i18n">
          </label>
          <p class="operator-action-popup__hint">{{ 'operator.email.purpose' | i18n }}</p>
          }
          @if (config.enabled || persisted()?.enabled) {
            <app-menu class="operator-action-popup__section-actions" kind="inline" layout="row"
              [model]="{ actionSizing: 'content' }" [items]="saveItems()" (itemSelect)="save()"></app-menu>
          }
        } @else { <p>{{ 'operator.email.backendRequired' | i18n }}</p> }
      }
      @if (error()) { <p class="operator-action-popup__result is-error" role="alert">{{ 'operator.email.failed' | i18n }}</p> }
      @if (saved()) { <p class="operator-action-popup__result is-success" role="status">{{ 'operator.email.saved' | i18n }}</p> }
    </section>`,
  styleUrl: './operator-email-configuration.component.scss'
})
export class OperatorEmailConfigurationComponent implements OnInit, OnDestroy {
  private readonly service = inject(OperatorEmailService);
  protected readonly draft = signal<OperatorEmailConfiguration | null>(null);
  protected readonly persisted = signal<OperatorEmailConfiguration | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal(false);
  protected readonly saved = signal(false);
  protected credential = '';
  private destroyed = false;
  async ngOnInit() {
    this.busy.set(true);
    try { const draft = await this.service.load(); if (!this.destroyed) { this.draft.set(draft); this.persisted.set(draft); } }
    catch { this.error.set(true); } finally { this.busy.set(false); }
  }
  ngOnDestroy() { this.destroyed = true; this.credential = ''; }
  protected field(name: 'fromEmail' | 'fromName', value: string) { this.draft.update(draft => draft && ({ ...draft, [name]: value })); this.saved.set(false); }
  protected toggle() { this.draft.update(draft => draft && ({ ...draft, enabled: !draft.enabled })); this.saved.set(false); }
  protected selectedLabel() { return this.draft()?.availableProviders.find(provider => provider.id === this.draft()?.providerId)?.label ?? 'operator.email.selectProvider'; }
  protected providerItems(): readonly AppMenuItem[] { return (this.draft()?.availableProviders ?? []).map(provider => ({ ...provider, palette: provider.palette as AppMenuPalette, disabled: this.busy() })); }
  protected selectProvider(event: AppMenuItemSelectEvent) {
    this.draft.update(draft => draft && ({ ...draft, providerId: event.id, credentialConfigured: draft.providerId === event.id && draft.credentialConfigured })); this.credential = ''; this.saved.set(false);
  }
  protected saveItems(): readonly AppMenuItem[] { return [{ id: 'save', label: 'save', icon: 'save', layout: 'action', palette: 'violet',
    disabled: this.saveDisabled(), progress: this.busy() ? { state: 'loading', shape: 'circle' } : null }]; }
  private saveDisabled(): boolean {
    const draft = this.draft(), before = this.persisted(), credential = this.credential.trim();
    if (this.busy() || !draft || !before || !draft.availableProviders.length) return true;
    const fromEmail = draft.fromEmail.trim(), fromName = draft.fromName.trim();
    const changed = draft.enabled !== before.enabled || draft.providerId !== before.providerId
      || fromEmail !== before.fromEmail || fromName !== before.fromName || !!credential;
    const validProvider = draft.availableProviders.some(provider => provider.id === draft.providerId);
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail);
    return !changed || (fromEmail.length > 0 && !validEmail) || fromEmail.length > 254
      || fromName.length > 100 || credential.length > 4096 || /[\r\n]/.test(credential)
      || (draft.enabled && (!validProvider || !validEmail || (!draft.credentialConfigured && !credential)));
  }
  protected async save() {
    const draft = this.draft(); if (!draft || this.saveDisabled()) return;
    this.busy.set(true); this.error.set(false); this.saved.set(false);
    try { const next = await this.service.save({ expectedRevision: draft.revision, enabled: draft.enabled, providerId: draft.providerId,
      fromEmail: draft.fromEmail, fromName: draft.fromName, credential: this.credential, clearCredential: false });
      if (!this.destroyed) { this.draft.set(next); this.persisted.set(next); this.credential = ''; this.saved.set(true); }
    } catch { this.error.set(true); } finally { this.busy.set(false); }
  }
}
