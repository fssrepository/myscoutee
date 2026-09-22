import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppMenuComponent, I18nPipe, type AppMenuItem, type AppMenuItemSelectEvent, type AppMenuPalette } from '../../../shared/ui';
import { OperatorEmailService } from '../../../shared/core/base/services/operator-email.service';
import type { OperatorEmailConfiguration } from '../../../shared/core/contracts/operator-email.interface';
@Component({ selector: 'app-operator-email-configuration', standalone: true, imports: [FormsModule, AppMenuComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="email-configuration">
      <header><h3>{{ 'operator.email.title' | i18n }}</h3>
        <app-menu kind="inline" [items]="saveItems()" (itemSelect)="save()"></app-menu>
      </header>
      @if (draft(); as config) {
        @if (config.availableProviders.length) {
          <app-menu kind="inline" [items]="enabledItems()" (itemSelect)="toggle()"></app-menu>
          <label>{{ 'operator.email.provider' | i18n }}
            <app-menu kind="select" [trigger]="{ label: selectedLabel(), icon: 'mail', palette: 'blue', layout: 'field', disabled: busy() }"
              [items]="providerItems()" (itemSelect)="selectProvider($event)"></app-menu>
          </label>
          <div class="email-configuration__fields">
            <label>{{ 'operator.email.fromEmail' | i18n }}<input type="email" maxlength="254" [disabled]="busy()" [ngModel]="config.fromEmail" (ngModelChange)="field('fromEmail', $event)"></label>
            <label>{{ 'operator.email.fromName' | i18n }}<input type="text" maxlength="100" [disabled]="busy()" [ngModel]="config.fromName" (ngModelChange)="field('fromName', $event)"></label>
          </div>
          <label>{{ 'operator.email.credential' | i18n }}
            <input type="password" maxlength="4096" autocomplete="new-password" [disabled]="busy()" [(ngModel)]="credential"
              [placeholder]="(config.credentialConfigured ? 'operator.email.credentialKept' : 'operator.email.credential') | i18n">
          </label>
          <small>{{ 'operator.email.purpose' | i18n }}</small>
        } @else { <p>{{ 'operator.email.backendRequired' | i18n }}</p> }
      }
      @if (error()) { <p role="alert">{{ 'operator.email.failed' | i18n }}</p> }
      @if (saved()) { <p role="status">{{ 'operator.email.saved' | i18n }}</p> }
    </section>`,
  styles: [`:host { display: block; } .email-configuration { display: grid; gap: .8rem; padding: 1rem; border: 1px solid #bbd4e8; border-radius: .9rem; background: #f4f9ff; }
    header { display: flex; justify-content: space-between; align-items: center; gap: .5rem; } h3 { margin: 0; font-size: 1rem; }
    label { display: grid; gap: .35rem; font-size: .85rem; min-width: 0; } input { width: 100%; box-sizing: border-box; padding: .6rem; border: 1px solid #c5d4e8; border-radius: .6rem; font: inherit; }
    .email-configuration__fields { display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: .75rem; } small { line-height: 1.5; }`]
})
export class OperatorEmailConfigurationComponent implements OnInit, OnDestroy {
  private readonly service = inject(OperatorEmailService);
  protected readonly draft = signal<OperatorEmailConfiguration | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal(false);
  protected readonly saved = signal(false);
  protected credential = '';
  private destroyed = false;
  async ngOnInit() {
    this.busy.set(true);
    try { const draft = await this.service.load(); if (!this.destroyed) this.draft.set(draft); }
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
  protected enabledItems(): readonly AppMenuItem[] { return [{ id: 'enabled', label: 'operator.email.enabled', icon: 'mail', palette: 'blue',
    kind: 'toggle', layout: 'pill', showToggleIndicator: true, closeOnSelect: false, checked: this.draft()?.enabled, disabled: this.busy() }]; }
  protected saveItems(): readonly AppMenuItem[] { return [{ id: 'save', icon: 'check', ariaLabel: 'save', palette: 'green',
    disabled: this.busy() || !this.draft()?.availableProviders.length, progress: this.busy() ? { state: 'loading', shape: 'circle' } : null }]; }
  protected async save() {
    const draft = this.draft(); if (!draft || this.busy() || !draft.availableProviders.length) return;
    this.busy.set(true); this.error.set(false); this.saved.set(false);
    try { const next = await this.service.save({ expectedRevision: draft.revision, enabled: draft.enabled, providerId: draft.providerId,
      fromEmail: draft.fromEmail, fromName: draft.fromName, credential: this.credential, clearCredential: false });
      if (!this.destroyed) { this.draft.set(next); this.credential = ''; this.saved.set(true); }
    } catch { this.error.set(true); } finally { this.busy.set(false); }
  }
}
