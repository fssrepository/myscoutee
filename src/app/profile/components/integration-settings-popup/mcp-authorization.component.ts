import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IntegrationService } from '../../../shared/core/base/services/integration.service';
import type { McpAuthorizationContext, McpAuthorizationRequest } from '../../../shared/core/contracts/integration.interface';
import { PopupComponent, type PopupModel } from '../../../shared/ui/components/core/popup';
import { AppMenuComponent, type AppMenuItem } from '../../../shared/ui/components/core/menu';
import { I18nPipe } from '../../../shared/ui/pipes/i18n.pipe';

@Component({
  standalone: true, imports: [PopupComponent, AppMenuComponent, I18nPipe],
  template: `<app-popup [model]="model()">
    @if (context(); as value) {
      <p><strong>{{ value.clientName }}</strong></p>
      <p>{{ 'mcp.profile' | i18n }}: {{ value.profileName }} · {{ value.groupName || ('mcp.base.profile' | i18n) }}</p>
      <p>{{ 'mcp.consent.message' | i18n }}</p>
      <p>{{ 'mcp.callback' | i18n }}: {{ value.redirectUri }}</p>
      <app-menu kind="inline" layout="row" [items]="actions()" (itemSelect)="decide($event.id === 'approve')"></app-menu>
    } @else if (!error()) { <p>{{ 'integration.loading' | i18n }}</p> }
    @if (error()) { <p role="alert">{{ error() | i18n }}</p> }
  </app-popup>`
})
export class McpAuthorizationComponent {
  private readonly api = inject(IntegrationService);
  private readonly router = inject(Router);
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  protected readonly context = signal<McpAuthorizationContext | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  private readonly request: McpAuthorizationRequest = {
    clientId: this.query.get('client_id') ?? '', redirectUri: this.query.get('redirect_uri') ?? '',
    resource: this.query.get('resource') ?? '', scope: this.query.get('scope') ?? '',
    responseType: this.query.get('response_type') ?? '', codeChallenge: this.query.get('code_challenge') ?? '',
    codeChallengeMethod: this.query.get('code_challenge_method') ?? '', state: this.query.get('state')
  };
  async ngOnInit(): Promise<void> {
    if (this.query.keys.some(key => this.query.getAll(key).length !== 1)) { this.error.set('mcp.authorization.failed'); return; }
    try { this.context.set(await this.api.mcpAuthorization(this.request)); }
    catch { this.error.set('mcp.authorization.failed'); }
  }
  protected model(): PopupModel { return {title: 'mcp.authorize', size: 'small', height: 'auto', backdropTone: 'dim',
    onClose: () => { if (!this.busy()) { if (this.context()) void this.decide(false); else void this.router.navigateByUrl('/game'); } }}; }
  protected actions(): AppMenuItem[] { return [
    {id: 'cancel', label: 'cancel', icon: 'close', palette: 'neutral', layout: 'pill', disabled: this.busy()},
    {id: 'approve', label: 'mcp.approve', icon: 'done', palette: 'green', layout: 'pill', disabled: this.busy()}
  ]; }
  protected async decide(approve: boolean): Promise<void> {
    if (this.busy() || !this.context()) return;
    this.busy.set(true); this.error.set('');
    try { const result = await this.api.mcpConsent(this.request, approve); globalThis.location.assign(result.url); }
    catch { this.error.set('mcp.failed'); this.busy.set(false); }
  }
}
