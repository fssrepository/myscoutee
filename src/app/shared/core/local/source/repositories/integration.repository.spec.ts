import '@angular/compiler';
import { createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { LocalMemoryDb } from '../../../common/app.db';
import { LocalIntegrationRepository } from './integration.repository';
import { LocalUsersMapper } from '../mappers/user.mapper';
import { USERS_TABLE_NAME, type UserRecord } from '../entity/user.entity';

describe('Local affiliate summary', () => {
  it('persists a stable link and counts each new referral once without exposing attribution in the profile DTO', () => {
    let state: any = { [USERS_TABLE_NAME]: { ids: ['owner', 'member'], byId: {
      owner: {id:'owner',languages:[],images:[]}, member:{id:'member',languages:[],images:[]}
    }}};
    const db={read:()=>state,write:(change:any)=>{state=change(state);}};
    const injector=createEnvironmentInjector([{provide:LocalMemoryDb,useValue:db}],null as any);
    const repo=runInInjectionContext(injector,()=>new LocalIntegrationRepository());
    const first=repo.settings('owner','/api/integrations/v1');
    const code=new URL(first.affiliate.url,'https://example.test').searchParams.get('affiliate')!;
    expect(first.affiliate.registered).toBe(0);
    expect(repo.settings('owner','/api/integrations/v1').affiliate.url).toBe(first.affiliate.url);
    repo.recordRegistration('owner',code);
    repo.recordRegistration('member','invalid');
    expect(repo.settings('owner','/api/integrations/v1').affiliate.registered).toBe(0);
    repo.recordRegistration('member',code);
    repo.recordRegistration('member',code);
    expect(repo.settings('owner','/api/integrations/v1').affiliate.registered).toBe(1);
    const owner=state[USERS_TABLE_NAME].byId.owner as UserRecord;
    expect(LocalUsersMapper.toDto(owner)).not.toHaveProperty('affiliateCode');
    expect(LocalUsersMapper.cloneRecord(owner).affiliateRegistrations).toEqual(owner.affiliateRegistrations);
    injector.destroy();
  });
  it('keeps admin keys separate from affiliate keys and does not create an admin referral', () => {
    let state: any = { [USERS_TABLE_NAME]: { ids: ['admin', 'member'], byId: {
      admin: { id: 'admin', admin: true }, member: { id: 'member', admin: false }
    } } };
    const db = { read: () => state, write: (change: any) => { state = change(state); } };
    const injector = createEnvironmentInjector([{ provide: LocalMemoryDb, useValue: db }], null as any);
    const repo = runInInjectionContext(injector, () => new LocalIntegrationRepository());
    repo.settings('admin', '/api/admin-client/v1', true);
    expect(state[USERS_TABLE_NAME].byId.admin.affiliateCode).toBeUndefined();
    const ordinary = repo.createToken('admin', 'Affiliate', 90);
    const admin = repo.createToken('admin', 'Monitor', 90, true);
    expect(repo.settings('admin', '/api/admin-client/v1', true).tokens.map(token => token.id)).toEqual([admin.token.id]);
    expect(repo.settings('admin', '/api/integrations/v1').tokens.map(token => token.id)).toEqual([ordinary.token.id]);
    repo.revokeToken('admin', ordinary.token.id, true);
    expect(repo.settings('admin', '/api/integrations/v1').tokens).toHaveLength(1);
    repo.revokeToken('admin', admin.token.id, true);
    expect(repo.settings('admin', '/api/admin-client/v1', true).tokens).toHaveLength(0);
    expect(() => repo.createToken('member', 'Monitor', 90, true)).toThrow('admin.api.denied');
    injector.destroy();
  });

  it('writes referral revenue once per payment, keeps currencies separate and subtracts completed refunds', () => {
    let state: any = { [USERS_TABLE_NAME]: { ids: ['owner', 'member'], byId: {
      owner: { id: 'owner' }, member: { id: 'member', affiliateReferrerUserId: 'owner' }
    } } };
    const db = { read: () => state, write: (change: any) => { state = change(state); } };
    const injector = createEnvironmentInjector([{ provide: LocalMemoryDb, useValue: db }], null as any);
    const repo = runInInjectionContext(injector, () => new LocalIntegrationRepository());
    repo.recordPayment('member', 'one', 'EUR', 100);
    repo.recordPayment('member', 'one', 'EUR', 100);
    repo.recordPayment('member', 'two', 'HUF', 5000, 0, false);
    repo.recordPayment('member', 'one', 'EUR', 100, 25);
    let revenue = repo.settings('owner', '/api').affiliate.revenue!;
    expect(revenue.purchases).toBe(2);
    expect(revenue.eventBookings).toBe(1);
    expect(revenue.currencies.EUR).toEqual({ gross: 100, refunded: 25, net: 75 });
    expect(revenue.currencies.HUF.net).toBe(5000);
    expect(LocalUsersMapper.toDto(state[USERS_TABLE_NAME].byId.owner)).not.toHaveProperty('affiliateRevenue');
    expect(LocalUsersMapper.toDto(state[USERS_TABLE_NAME].byId.member)).not.toHaveProperty('affiliatePayments');
    expect(LocalUsersMapper.cloneRecord(state[USERS_TABLE_NAME].byId.owner).affiliateRevenue).toEqual(revenue);
    const token = repo.createToken('owner', 'Temporary', 90);
    repo.revokeToken('owner', token.token.id);
    expect(repo.settings('owner', '/api').affiliate.revenue).toEqual(revenue);
    repo.refundPayment('one'); repo.refundPayment('one');
    revenue = repo.settings('owner', '/api').affiliate.revenue!;
    expect(revenue.currencies.EUR).toEqual({ gross: 100, refunded: 100, net: 0 });
    expect(revenue.purchases).toBe(2);
    injector.destroy();
  });

});
