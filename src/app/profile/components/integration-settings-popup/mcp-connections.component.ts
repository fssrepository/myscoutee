import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { McpConnectionsStore } from '../../../shared/ui/context/stores/mcp-connections.store';
import { DialogStore } from '../../../shared/ui/context/stores/dialog.store';
import { CopyLinkComponent } from '../../../shared/ui/components/core/copy-link/copy-link.component';
import { AppMenuComponent, type AppMenuItem } from '../../../shared/ui/components/core/menu';
import { PopupComponent, type PopupModel } from '../../../shared/ui/components/core/popup';
import { FormFlowComponent, type FormFlowModel } from '../../../shared/ui/components/core/form/flow';
import { I18nPipe } from '../../../shared/ui/pipes/i18n.pipe';
import type { McpClientRequest } from '../../../shared/core/contracts/integration.interface';

@Component({
  selector: 'app-mcp-connections', standalone: true, providers: [McpConnectionsStore],
  imports: [CommonModule, FormsModule, CopyLinkComponent, AppMenuComponent, PopupComponent, FormFlowComponent, I18nPipe],
  styleUrl: './integration-settings-popup.component.scss',
  template: `
    <section class="integration-settings-section">
      <div class="integration-section-heading">
        <h3>{{ 'mcp.connections' | i18n }}</h3>
        <app-menu kind="inline" layout="row" [items]="createActions()" (itemSelect)="editor.set(true)"></app-menu>
      </div>
      @if (store.error()) { <p role="alert">{{ store.error() | i18n }}</p> }
      @if (store.settings(); as config) {
        <small>{{ 'mcp.setup' | i18n }}</small>
        @if (!config.remoteEnabled) { <p>{{ 'mcp.local.only' | i18n }}</p> }
        <app-copy-link [value]="config.resource" label="mcp.url"></app-copy-link>
        <div class="integration-token-list">
          @for (client of config.clients; track client.token.id) {
            <article class="integration-token-row">
              <div class="integration-token-main">
                <strong>{{ client.token.name }}</strong>
                <app-copy-link [value]="client.token.id" label="mcp.client.id"></app-copy-link>
                <small>{{ 'mcp.callback' | i18n }}: {{ client.redirectUri }}</small>
                <small>{{ 'integration.token.expires' | i18n }} {{ client.token.expiresAt | date:'mediumDate' }}</small>
                @if (client.token.lastUsedAt) { <small>{{ 'mcp.last.used' | i18n }} {{ client.token.lastUsedAt | date:'short' }}</small> }
                @if (store.secretClientId() === client.token.id && store.secret()) {
                  <app-copy-link [value]="store.secret()" label="mcp.secret"></app-copy-link>
                  <small>{{ 'integration.token.copy.now' | i18n }}</small>
                }
              </div>
              <app-menu kind="inline" [items]="revokeActions(client.token.id)" (itemSelect)="revoke(client.token.id)"></app-menu>
            </article>
          } @empty { <p>{{ 'mcp.empty' | i18n }}</p> }
        </div>
      } @else if (store.busy()) { <p>{{ 'integration.loading' | i18n }}</p> }
    </section>
    @if (editor()) {
      <app-popup [model]="editorModel()" [zIndex]="2520">
        <app-form-flow [model]="formModel" [(ngModel)]="form" [disabled]="store.busy()"></app-form-flow>
        <p>{{ 'mcp.callback.help' | i18n }}</p>
        @if (store.error()) { <p role="alert">{{ store.error() | i18n }}</p> }
      </app-popup>
    }
  `
})
export class McpConnectionsComponent {
  protected readonly store = inject(McpConnectionsStore);
  private readonly dialogs = inject(DialogStore);
  protected readonly editor = signal(false);
  protected form: McpClientRequest = {name: '', redirectUri: ''};
  protected readonly formModel: FormFlowModel = {
    title: 'mcp.create', header: false, layout: 'grouped', deferPreparation: false, save: null,
    summary: {enabled: false}, steps: [{id: 'mcp', title: 'mcp.create', palette: 'purple', controls: [
      {id: 'name', bind: 'name', kind: 'text', label: 'mcp.name', required: true, maxLength: 80},
      {id: 'redirectUri', bind: 'redirectUri', kind: 'text', label: 'mcp.callback', required: true, maxLength: 2048}
    ]}]
  };
  protected createActions(): AppMenuItem[] { return [{id: 'create', icon: 'add', label: 'mcp.create', layout: 'pill', palette: 'purple',
    disabled: this.store.busy() || !this.store.settings() || this.store.settings()!.clients.length >= this.store.settings()!.maxClients}]; }
  protected revokeActions(id: string): AppMenuItem[] { return [{id, icon: 'delete', ariaLabel: 'integration.token.revoke', palette: 'danger', layout: 'icon', disabled: this.store.busy()}]; }
  protected revoke(id: string): void {
    this.dialogs.open({title: 'mcp.revoke', message: 'mcp.revoke.message', confirmLabel: 'integration.token.revoke',
      confirmTone: 'danger', failureMessage: 'mcp.failed', onConfirm: () => this.store.revoke(id)});
  }
  protected editorModel(): PopupModel {
    return {title: 'mcp.create', size: 'small', height: 'auto', backdropTone: 'dim',
      onClose: () => { if (!this.store.busy()) this.editor.set(false); },
      headerControls: [{id: 'save', kind: 'menu', menuKind: 'inline', items: [{id: 'save', icon: 'done', ariaLabel: 'save',
        palette: 'success', disabled: this.store.busy() || !this.form.name.trim() || !this.form.redirectUri.trim()}]}],
      onMenuSelect: async () => { if (await this.store.create({...this.form})) { this.editor.set(false); this.form = {name: '', redirectUri: ''}; } }};
  }
}
