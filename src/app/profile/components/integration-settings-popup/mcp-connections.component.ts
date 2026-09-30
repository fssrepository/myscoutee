import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../../shared/core/base/services/i18n.service';
import { McpConnectionsStore } from '../../../shared/ui/context/stores/mcp-connections.store';
import { DialogStore } from '../../../shared/ui/context/stores/dialog.store';
import { CopyLinkComponent } from '../../../shared/ui/components/core/copy-link/copy-link.component';
import { AppMenuComponent, type AppMenuItem } from '../../../shared/ui/components/core/menu';
import { PopupComponent, type PopupModel } from '../../../shared/ui/components/core/popup';
import { I18nPipe } from '../../../shared/ui/pipes/i18n.pipe';

@Component({
  selector: 'app-mcp-connections', standalone: true, providers: [McpConnectionsStore],
  imports: [CommonModule, CopyLinkComponent, AppMenuComponent, PopupComponent, I18nPipe],
  styleUrl: './integration-settings-popup.component.scss',
  template: `
    <section class="integration-settings-section">
      <div class="integration-section-heading">
        <h3 data-guide-field="mcp-purpose">{{ 'mcp.connections' | i18n }}</h3>
        <app-menu data-guide-field="mcp-advanced" kind="inline" layout="row" [items]="advancedActions()" (itemSelect)="advanced.set(true)"></app-menu>
      </div>
      @if (store.error()) { <p role="alert">{{ store.error() | i18n }}</p> }
      @if (store.settings(); as config) {
        <span class="integration-endpoint-label">{{ 'mcp.url' | i18n }}</span>
        <app-copy-link data-guide-field="mcp-url" [value]="config.resource" label="mcp.url" copyLabel="mcp.copy.url"></app-copy-link>
        <h4 class="integration-endpoint-label">{{ 'mcp.oauth.permissions' | i18n }}</h4>
        <div class="integration-token-list" data-guide-field="mcp-permissions">
          @for (client of oauthClients(); track client.token.id) {
            <article class="integration-token-row" data-guide-field="mcp-connection">
              <div class="integration-token-main">
                <strong>{{ client.token.name }}</strong>
                <small>{{ 'integration.token.expires' | i18n }} {{ client.token.expiresAt | date:'mediumDate' }}</small>
                @if (client.token.lastUsedAt) { <small>{{ 'mcp.last.used' | i18n }} {{ client.token.lastUsedAt | date:'short' }}</small> }
              </div>
              <app-menu data-guide-field="mcp-connection-actions" kind="inline" [items]="connectionActions(client.token.id)" (itemSelect)="$event.id === 'details' ? detailsId.set(client.token.id) : revoke(client.token.id)"></app-menu>
            </article>
          } @empty { <p>{{ 'mcp.empty' | i18n }}</p> }
        </div>
      } @else if (store.busy()) { <p>{{ 'integration.loading' | i18n }}</p> }
    </section>
    @if (advanced()) {
      <app-popup [model]="advancedModel()" [zIndex]="2510">
        <section class="integration-settings-section" data-guide-field="mcp-manual-keys">
          <div class="integration-section-heading">
            <div>
              <h3>{{ 'integration.client.keys' | i18n }}</h3>
              <small>{{ manualClients().length }} / {{ store.settings()?.maxClients }} {{ 'integration.token.active' | i18n }}</small>
            </div>
            <app-menu data-guide-field="mcp-generate" class="integration-generate-action" kind="inline" layout="row"
              [items]="createActions()" (itemSelect)="generate()"></app-menu>
          </div>
          @if (store.error()) { <p role="alert">{{ store.error() | i18n }}</p> }
          <div class="integration-token-list">
            @for (client of manualClients(); track client.token.id) {
              <article class="integration-token-row">
                <div class="integration-token-main">
                  <strong>{{ client.token.name }}</strong>
                  <span class="integration-endpoint-label">{{ 'mcp.client.id' | i18n }}</span>
                  <app-copy-link [value]="client.clientId || client.token.id" label="mcp.client.id" copyLabel="mcp.copy.client"></app-copy-link>
                  <small>{{ 'integration.token.expires' | i18n }} {{ client.token.expiresAt | date:'mediumDate' }}</small>
                  @if (client.token.lastUsedAt) { <small>{{ 'mcp.last.used' | i18n }} {{ client.token.lastUsedAt | date:'short' }}</small> }
                  @if (store.secretClientId() === client.token.id && store.secret()) {
                    <span class="integration-endpoint-label">{{ 'mcp.secret' | i18n }}</span>
                    <app-copy-link [value]="store.secret()" label="mcp.secret" copyLabel="mcp.copy.secret"></app-copy-link>
                    <small>{{ 'integration.token.copy.now' | i18n }}</small>
                  }
                </div>
                <app-menu kind="inline" [items]="revokeActions(client.token.id)" (itemSelect)="revoke(client.token.id)"></app-menu>
              </article>
            } @empty { <p class="integration-empty-state">{{ 'integration.token.empty' | i18n }}</p> }
          </div>
        </section>
      </app-popup>
    }
    @if (details(); as client) {
      <app-popup [model]="detailsModel()" [zIndex]="2520">
        <div class="integration-settings-body">
          <div class="integration-section-heading"><h3>{{ client.token.name }}</h3></div>
          <div class="integration-credential-field">
            <span class="integration-endpoint-label">{{ 'mcp.client.id' | i18n }}</span>
            <app-copy-link [value]="client.clientId || client.token.id" label="mcp.client.id" copyLabel="mcp.copy.client"></app-copy-link>
          </div>
          <div class="integration-credential-field">
            <span class="integration-endpoint-label">{{ 'mcp.callback' | i18n }}</span>
            <app-copy-link [value]="client.redirectUri" label="mcp.callback" copyLabel="mcp.copy.callback"></app-copy-link>
          </div>
        @if (store.secretClientId() === client.token.id && store.secret()) {
          <div class="integration-credential-field">
            <span class="integration-endpoint-label">{{ 'mcp.secret' | i18n }}</span>
            <app-copy-link [value]="store.secret()" label="mcp.secret" copyLabel="mcp.copy.secret"></app-copy-link>
          </div>
          <small>{{ 'integration.token.copy.now' | i18n }}</small>
        }
        </div>
      </app-popup>
    }
  `
})
export class McpConnectionsComponent {
  protected readonly store = inject(McpConnectionsStore);
  private readonly dialogs = inject(DialogStore);
  protected readonly advanced = signal(false);
  private readonly i18n = inject(I18nService);
  protected readonly manualClients = computed(() => this.store.settings()?.clients.filter(client => client.manual !== false) ?? []);
  protected readonly oauthClients = computed(() => this.store.settings()?.clients.filter(client => client.manual === false) ?? []);
  protected readonly advancedActions = computed<AppMenuItem[]>(() => [{id: 'advanced', icon: 'settings', label: 'mcp.advanced',
    layout: 'pill', palette: 'neutral', compactOnMobile: true, counter: this.manualClients().length}]);
  protected advancedModel(): PopupModel { return {title: 'mcp.advanced', size: 'small', height: 'auto', mobilePresentation: 'fullscreen',
    backdropTone: 'dim', onClose: () => this.advanced.set(false)}; }
  protected async generate(): Promise<void> {
    const name = this.i18n.translateParams('integration.token.client.name', {index: this.manualClients().length + 1});
    await this.store.create({name});
  }
  protected createActions(): AppMenuItem[] { return [{id: 'create', icon: 'vpn_key', label: 'integration.token.generate', layout: 'pill', palette: 'purple',
    disabled: this.store.busy() || !this.store.settings() || this.store.settings()!.clients.length >= this.store.settings()!.maxClients}]; }
  protected revokeActions(id: string): AppMenuItem[] { return this.connectionActions(id).filter(action => action.id !== 'details'); }
  protected readonly detailsId = signal<string | null>(null);
  protected details() { return this.store.settings()?.clients.find(client => client.token.id === this.detailsId()) ?? null; }
  protected detailsModel(): PopupModel { return {title: 'mcp.technical.details', size: 'small', height: 'auto',
    backdropTone: 'dim', onClose: () => this.detailsId.set(null)}; }
  protected connectionActions(id: string): AppMenuItem[] { return [
    {id: 'details', icon: 'settings', ariaLabel: 'mcp.technical.details', palette: 'neutral', layout: 'icon', disabled: this.store.busy()},
    {id, icon: 'delete', ariaLabel: 'integration.token.revoke', palette: 'danger', layout: 'icon', disabled: this.store.busy()}]; }
  protected revoke(id: string): void {
    this.dialogs.open({title: 'mcp.revoke.question', message: 'mcp.revoke.message', confirmLabel: 'integration.token.revoke',
      confirmTone: 'danger', failureMessage: 'mcp.failed', onConfirm: () => this.store.revoke(id)});
  }
}
