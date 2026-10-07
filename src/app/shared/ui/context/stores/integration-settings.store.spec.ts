import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { IntegrationSettingsStore } from './integration-settings.store';
import { SessionService } from '../../../core/base/services/session.service';
import { IntegrationService } from '../../../core/base/services/integration.service';
import { UserProfileStore } from './user-profile.store';

describe('Integration settings draft and connection mutations', () => {
  afterEach(() => TestBed.resetTestingModule());
  const config = {baseUrl: '/api/integrations/v1', maxActiveTokens: 3, maxBatchSize: 1000, tokens: [], accessRevision: 0,
    affiliate: {url:'',registered:0}, participants: {registered:0,imported:0},
    mcp: {resource: '/mcp/private', maxClients: 3, remoteEnabled: false, clients: [], accessMode:'write'}};
  const client = {token: {id:'one', name:'Claude'}, redirectUri:'https://client/cb'};
  async function setup() {
    const owner = signal('owner');
    const api = {loadSettings:vi.fn().mockResolvedValue(config),saveSettings:vi.fn(), createMcpClient:vi.fn().mockResolvedValue({client,secret:'once'}), revokeMcpClient:vi.fn().mockResolvedValue(undefined)};
    TestBed.configureTestingModule({providers:[IntegrationSettingsStore,{provide:IntegrationService,useValue:api},{provide:UserProfileStore,useValue:{activeUserId:owner}},{provide:SessionService,useValue:{activeUserId:owner}}]});
    const store = TestBed.inject(IntegrationSettingsStore);TestBed.tick();await store.open();
    return {store,owner,api};
  }
  it('inserts and removes without reloading and clears a revoked secret', async () => {
    const {store,api}=await setup();
    expect(await store.create({name:'Claude',redirectUri:client.redirectUri})).toBe(true);
    expect(store.mcp()?.clients).toEqual([client]);expect(store.secret()).toBe('once');
    await store.revoke('one');expect(store.mcp()?.clients).toEqual([]);expect(store.secret()).toBe('');
    expect(api.loadSettings).toHaveBeenCalledTimes(1);
  });
  it('does not expose a previous profile’s delayed secret in the new profile', async () => {
    const {store,api,owner}=await setup();let finish!:(v:any)=>void;
    api.createMcpClient.mockReturnValue(new Promise(resolve=>finish=resolve));
    const creation=store.create({name:'Claude',redirectUri:client.redirectUri});
    owner.set('other');TestBed.tick();await Promise.resolve();
    finish({client,secret:'old-profile'});expect(await creation).toBe(false);
    expect(store.secret()).toBe('');expect(store.mcp()?.clients).toEqual([]);
  });
  it('keeps failed revocations visible so they can be retried', async () => {
    const {store,api}=await setup();await store.create({name:'Claude',redirectUri:client.redirectUri});
    api.revokeMcpClient.mockRejectedValueOnce(new Error('offline'));
    await expect(store.revoke('one')).rejects.toThrow();expect(store.mcp()?.clients).toEqual([client]);expect(store.busy()).toBe(false);
    await store.revoke('one');expect(store.mcp()?.clients).toEqual([]);
  });
  it('stages both MCP limits without transport and saves them in one parent request', async () => {
    const {store,api}=await setup();await store.create({name:'Claude'});
    store.changeAccess(null,'full');store.changeAccess('one','full');
    expect(store.dirty()).toBe(true);expect(api.saveSettings).not.toHaveBeenCalled();
    expect(api.loadSettings).toHaveBeenCalledTimes(1);
    api.saveSettings.mockResolvedValue({...config,accessRevision:1,mcp:{...config.mcp,accessMode:'full',clients:[{...client,token:{...client.token,accessMode:'full'}}]}});
    expect(await store.save()).toBe(true);
    expect(api.saveSettings).toHaveBeenCalledWith({accessRevision:0,mcpAccess:'full',clients:[{id:'one',accessMode:'full'}]}, false);
    expect(store.dirty()).toBe(false);
  });
  it('discards unsaved permissions on close and keeps failed saves as a retryable draft', async () => {
    const {store,api}=await setup();store.changeAccess(null,'blocked');
    api.saveSettings.mockRejectedValueOnce(new Error('offline'));
    expect(await store.save()).toBe(false);expect(store.dirty()).toBe(true);expect(store.access(null)).toBe('blocked');
    store.close();await store.open();expect(store.access(null)).toBe('write');expect(store.dirty()).toBe(false);
  });
  it('does not load any settings merely by constructing the store', async () => {
    const {store,api}=await setup();store.close();api.loadSettings.mockClear();TestBed.tick();
    expect(api.loadSettings).not.toHaveBeenCalled();
  });

});
