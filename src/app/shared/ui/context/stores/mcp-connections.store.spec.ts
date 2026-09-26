import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpConnectionsStore } from './mcp-connections.store';
import { IntegrationService } from '../../../core/base/services/integration.service';
import { UserProfileStore } from './user-profile.store';

describe('MCP connection mutations', () => {
  afterEach(() => TestBed.resetTestingModule());
  const config = {resource: '/mcp/private', maxClients: 3, remoteEnabled: false, clients: []};
  const client = {token: {id:'one', name:'Claude'}, redirectUri:'https://client/cb'};
  async function setup() {
    const owner = signal('owner');
    const api = {mcpSettings:vi.fn().mockResolvedValue(config), createMcpClient:vi.fn().mockResolvedValue({client,secret:'once'}), revokeMcpClient:vi.fn().mockResolvedValue(undefined)};
    TestBed.configureTestingModule({providers:[McpConnectionsStore,{provide:IntegrationService,useValue:api},{provide:UserProfileStore,useValue:{activeUserId:owner}}]});
    const store = TestBed.inject(McpConnectionsStore);TestBed.tick();await Promise.resolve();
    return {store,owner,api};
  }
  it('inserts and removes without reloading and clears a revoked secret', async () => {
    const {store,api}=await setup();
    expect(await store.create({name:'Claude',redirectUri:client.redirectUri})).toBe(true);
    expect(store.settings()?.clients).toEqual([client]);expect(store.secret()).toBe('once');
    await store.revoke('one');expect(store.settings()?.clients).toEqual([]);expect(store.secret()).toBe('');
    expect(api.mcpSettings).toHaveBeenCalledTimes(1);
  });
  it('does not expose a previous profile’s delayed secret in the new profile', async () => {
    const {store,api,owner}=await setup();let finish!:(v:any)=>void;
    api.createMcpClient.mockReturnValue(new Promise(resolve=>finish=resolve));
    const creation=store.create({name:'Claude',redirectUri:client.redirectUri});
    owner.set('other');TestBed.tick();await Promise.resolve();
    finish({client,secret:'old-profile'});expect(await creation).toBe(false);
    expect(store.secret()).toBe('');expect(store.settings()?.clients).toEqual([]);
  });
  it('keeps failed revocations visible so they can be retried', async () => {
    const {store,api}=await setup();await store.create({name:'Claude',redirectUri:client.redirectUri});
    api.revokeMcpClient.mockRejectedValueOnce(new Error('offline'));
    await expect(store.revoke('one')).rejects.toThrow();expect(store.settings()?.clients).toEqual([client]);expect(store.busy()).toBe(false);
    await store.revoke('one');expect(store.settings()?.clients).toEqual([]);
  });
});
