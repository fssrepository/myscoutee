import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { IntegrationService } from '../../../core/base/services/integration.service';
import type { McpSettingsDto, McpClientRequest } from '../../../core/contracts/integration.interface';
import { UserProfileStore } from './user-profile.store';

/** Same bounded, profile-owned collection as API keys; mutations reconcile returned rows without reloading. */
@Injectable()
export class McpConnectionsStore {
  private readonly api = inject(IntegrationService);
  private readonly profile = inject(UserProfileStore);
  private generation = 0;
  readonly settings = signal<McpSettingsDto | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly secret = signal('');
  readonly secretClientId = signal('');
  constructor() {
    effect(() => {
      const owner = this.profile.activeUserId();
      untracked(() => { void this.load(owner); });
    });
  }
  private async load(owner: string): Promise<void> {
    const generation = ++this.generation;
    this.settings.set(null); this.secret.set(''); this.secretClientId.set(''); this.error.set('');
    this.busy.set(true);
    try {
      const settings = await this.api.mcpSettings();
      if (generation === this.generation && owner === this.profile.activeUserId()) this.settings.set(settings);
    } catch { if (generation === this.generation) this.error.set('mcp.failed'); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
  async create(input: McpClientRequest): Promise<boolean> {
    if (this.busy()) return false;
    const generation = this.generation, owner = this.profile.activeUserId();
    this.busy.set(true); this.error.set('');
    try {
      const created = await this.api.createMcpClient(input);
      if (generation !== this.generation || owner !== this.profile.activeUserId()) return false;
      this.settings.update(s => s ? {...s, clients: [created.client, ...s.clients]} : s);
      this.secret.set(created.secret); this.secretClientId.set(created.client.token.id);
      return true;
    } catch { if (generation === this.generation) this.error.set('mcp.failed'); return false; }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
  async revoke(id: string): Promise<void> {
    if (this.busy()) return;
    const generation = this.generation, owner = this.profile.activeUserId();
    this.busy.set(true);
    try {
      await this.api.revokeMcpClient(id);
      if (generation !== this.generation || owner !== this.profile.activeUserId()) return;
      this.settings.update(s => s ? {...s, clients: s.clients.filter(c => c.token.id !== id)} : s);
      if (this.secretClientId() === id) { this.secret.set(''); this.secretClientId.set(''); }
    } finally { if (generation === this.generation) this.busy.set(false); }
  }
}
