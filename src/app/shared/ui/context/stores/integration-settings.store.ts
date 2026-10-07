import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { IntegrationService } from '../../../core/base/services/integration.service';
import { SessionService } from '../../../core/base/services/session.service';
import type { IntegrationAccessMode, IntegrationSettingsDto, IntegrationSettingsUpdateDto, IntegrationTokenCreatedDto, McpClientRequest } from '../../../core/contracts/integration.interface';
import { UserProfileStore } from './user-profile.store';

/** API/MCP settings share one load, draft and save. Key mutations reconcile returned rows. */
@Injectable()
export class IntegrationSettingsStore {
  private readonly api = inject(IntegrationService);
  private readonly profile = inject(UserProfileStore);
  private readonly session = inject(SessionService);
  private generation = 0;
  readonly contextVersion = signal(0);
  private loadSequence = 0;
  private opened = false;
  private admin = false;
  private owner = '';
  readonly settings = signal<IntegrationSettingsDto | null>(null);
  readonly mcp = computed(() => this.settings()?.mcp ?? null);
  readonly draft = signal<IntegrationSettingsUpdateDto | null>(null);
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly secret = signal('');
  readonly secretClientId = signal('');
  readonly dirty = computed(() => {
    const settings = this.settings(), draft = this.draft();
    return !!settings && !!draft && JSON.stringify(this.fromSettings(settings)) !== JSON.stringify(draft);
  });

  constructor() {
    effect(() => {
      const profile = this.profile.activeUserId(), account = this.session.activeUserId();
      untracked(() => {
        if (this.opened && (this.admin ? account : profile) !== this.owner) void this.open(this.admin);
      });
    });
  }

  async open(admin = false): Promise<void> {
    this.close(); this.opened = true; this.admin = admin;
    this.owner = this.currentOwner();
    await this.reload();
  }

  close(): void {
    this.generation++; this.opened = false;
    this.contextVersion.update(value => value + 1);
    this.settings.set(null); this.draft.set(null); this.error.set('');
    this.secret.set(''); this.secretClientId.set(''); this.busy.set(false); this.loading.set(false);
  }

  async reload(): Promise<void> {
    const generation = this.generation, owner = this.owner, sequence = ++this.loadSequence;
    this.loading.set(true); this.error.set('');
    try {
      const settings = await this.api.loadSettings(this.admin);
      if (sequence === this.loadSequence && this.current(generation, owner)) this.reconcile(settings);
    } catch { if (sequence === this.loadSequence && this.current(generation, owner)) this.error.set('integration.load.failed'); }
    finally { if (sequence === this.loadSequence && this.current(generation, owner)) this.loading.set(false); }
  }

  access(id: string | null): IntegrationAccessMode {
    const draft = this.draft();
    return id === null ? draft?.mcpAccess ?? 'write' : draft?.clients.find(client => client.id === id)?.accessMode ?? 'write';
  }

  changeAccess(id: string | null, accessMode: IntegrationAccessMode): void {
    if (this.admin || this.busy() || this.loading()) return;
    this.draft.update(draft => draft ? id === null ? {...draft, mcpAccess: accessMode}
      : {...draft, clients: draft.clients.map(client => client.id === id ? {...client, accessMode} : client)} : draft);
  }

  async save(): Promise<boolean> {
    const draft = this.draft();
    if (this.admin || !draft || this.busy() || this.loading() || !this.dirty()) return false;
    const generation = this.generation, owner = this.owner;
    this.busy.set(true); this.error.set('');
    try {
      const settings = await this.api.saveSettings(structuredClone(draft));
      if (!this.current(generation, owner)) return false;
      this.settings.set(settings); this.draft.set(this.fromSettings(settings));
      return true;
    } catch (error) {
      if (this.current(generation, owner)) this.error.set(
        (error as {status?: number})?.status === 409 || (error as Error)?.message === 'integration.access.conflict'
          ? 'integration.access.conflict' : 'integration.access.save.failed');
      return false;
    } finally { if (this.current(generation, owner)) this.busy.set(false); }
  }

  async createApi(name: string, days: number): Promise<IntegrationTokenCreatedDto | null> {
    return this.mutate(async () => {
      const created = await this.api.createToken(name, days, this.admin);
      return {created, apply: () => this.update(settings => ({...settings, tokens: [created.token, ...settings.tokens]}))};
    });
  }

  async revokeApi(id: string): Promise<void> {
    await this.mutate(async () => {
      await this.api.revokeToken(id, this.admin);
      return {created: true, apply: () => this.update(settings => ({...settings, tokens: settings.tokens.filter(token => token.id !== id)}))};
    });
  }

  async create(input: McpClientRequest): Promise<boolean> {
    return !!await this.mutate(async () => {
      const created = await this.api.createMcpClient(input);
      return {created: true, apply: () => {
        this.update(settings => ({...settings, mcp: settings.mcp ? {...settings.mcp, clients: [created.client, ...settings.mcp.clients]} : settings.mcp}));
        this.secret.set(created.secret); this.secretClientId.set(created.client.token.id);
      }};
    });
  }

  async revoke(id: string): Promise<void> {
    await this.mutate(async () => {
      await this.api.revokeMcpClient(id);
      return {created: true, apply: () => {
        this.update(settings => ({...settings, mcp: settings.mcp ? {...settings.mcp, clients: settings.mcp.clients.filter(client => client.token.id !== id)} : settings.mcp}));
        if (this.secretClientId() === id) { this.secret.set(''); this.secretClientId.set(''); }
      }};
    });
  }

  private async mutate<T>(operation: () => Promise<{created: T; apply: () => void}>): Promise<T | null> {
    if (this.busy() || this.loading() || !this.opened) return null;
    const generation = this.generation, owner = this.owner;
    this.busy.set(true); this.error.set('');
    try {
      const result = await operation();
      if (!this.current(generation, owner)) return null;
      result.apply(); return result.created;
    } catch (error) {
      if (this.current(generation, owner)) this.error.set('integration.mutation.failed');
      throw error;
    } finally { if (this.current(generation, owner)) this.busy.set(false); }
  }

  private currentOwner(): string { return this.admin ? this.session.activeUserId() : this.profile.activeUserId(); }
  private current(generation: number, owner: string): boolean {
    return this.opened && generation === this.generation && owner === this.currentOwner();
  }
  private update(change: (settings: IntegrationSettingsDto) => IntegrationSettingsDto): void {
    const settings = this.settings(); if (settings) this.reconcile(change(settings));
  }
  private reconcile(settings: IntegrationSettingsDto): void {
    const previous = this.draft(), changed = this.dirty();
    const next = this.fromSettings(settings);
    this.settings.set(settings);
    this.draft.set(changed && previous ? {...next, accessRevision: previous.accessRevision, mcpAccess: previous.mcpAccess,
      clients: next.clients.map(client => previous.clients.find(value => value.id === client.id) ?? client)} : next);
  }
  private fromSettings(settings: IntegrationSettingsDto): IntegrationSettingsUpdateDto {
    return {accessRevision: settings.accessRevision ?? 0, mcpAccess: settings.mcp?.accessMode ?? 'write',
      clients: [...settings.tokens, ...(settings.mcp?.clients.map(client => client.token) ?? [])]
        .map(token => ({id: token.id, accessMode: token.accessMode ?? 'write'})).sort((a, b) => a.id.localeCompare(b.id))};
  }
}
