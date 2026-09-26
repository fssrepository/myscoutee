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
  it('persists reusable external links with the inviter and does not expose their tokens in profile DTOs', () => {
    let state: any = {[USERS_TABLE_NAME]: {ids: ['owner'], byId: {owner: {id: 'owner', languages: [], images: []}}}};
    const db = {read: () => state, write: (change: any) => {state = change(state);}};
    const injector = createEnvironmentInjector([{provide: LocalMemoryDb, useValue: db}], null as any);
    const repo = runInInjectionContext(injector, () => new LocalIntegrationRepository());
    const first = repo.externalInvite('owner', 'community', 'group');
    expect(repo.externalInvite('owner', 'community', 'group')).toEqual(first);
    const parsed = new URL(first.url, 'https://example.test');
    const token = parsed.searchParams.get('partnerInvite')!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(parsed.searchParams.get('affiliate')).toBe(state[USERS_TABLE_NAME].byId.owner.affiliateCode);
    const restored = runInInjectionContext(injector, () => new LocalIntegrationRepository());
    expect(restored.findExternalInvite(token)).toMatchObject({ownerUserId: 'owner', ownerType: 'community', entityId: 'group'});
    expect(LocalUsersMapper.toDto(state[USERS_TABLE_NAME].byId.owner)).not.toHaveProperty('externalInvites');
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

  it('persists cash receipts for both members once without affiliate revenue', () => {
    let state: any = { [USERS_TABLE_NAME]: { ids: ['owner', 'member', 'recipient'], byId: {
      owner: { id: 'owner' }, member: { id: 'member', name: 'Payer', affiliateReferrerUserId: 'owner' },
      recipient: { id: 'recipient', name: 'Recipient' }
    } } };
    const db = { read: () => state, write: (change: any) => { state = change(state); } };
    const injector = createEnvironmentInjector([{ provide: LocalMemoryDb, useValue: db }], null as any);
    const repo = runInInjectionContext(injector, () => new LocalIntegrationRepository());
    const request = { requestId: 'b5e0289c-1b09-47ca-8ba1-20cf5e2dcb02', payerUserId: 'member', amount: 20, currency: 'EUR', note: 'Lunch' };
    repo.recordCashReceipt('recipient', request);
    repo.recordCashReceipt('recipient', request);
    expect(repo.paymentHistory('recipient')).toHaveLength(1);
    expect(repo.paymentHistory('recipient')[0]).toMatchObject({ provider: 'cash', direction: 'income', amount: 20, note: 'Lunch', counterpartyName: 'Payer' });
    expect(repo.paymentHistory('member')[0]).toMatchObject({ direction: 'expense', canRequestRefund: false, counterpartyName: 'Recipient' });
    expect(repo.settings('owner', '/api').affiliate.revenue?.purchases ?? 0).toBe(0);
    expect(() => repo.recordCashReceipt('recipient', { ...request, amount: 21 })).toThrow();
    expect(() => repo.recordCashReceipt('recipient', { ...request, payerUserId: 'owner' })).toThrow();
    const restored = runInInjectionContext(injector, () => new LocalIntegrationRepository());
    expect(restored.paymentHistory('recipient')[0]?.note).toBe('Lunch');
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
    expect(revenue.currencies['EUR']).toEqual({ gross: 100, refunded: 25, net: 75 });
    expect(revenue.currencies['HUF'].net).toBe(5000);
    expect(LocalUsersMapper.toDto(state[USERS_TABLE_NAME].byId.owner)).not.toHaveProperty('affiliateRevenue');
    expect(LocalUsersMapper.toDto(state[USERS_TABLE_NAME].byId.member)).not.toHaveProperty('affiliatePayments');
    expect(LocalUsersMapper.cloneRecord(state[USERS_TABLE_NAME].byId.owner).affiliateRevenue).toEqual(revenue);
    const token = repo.createToken('owner', 'Temporary', 90);
    repo.revokeToken('owner', token.token.id);
    expect(repo.settings('owner', '/api').affiliate.revenue).toEqual(revenue);
    repo.refundPayment('one'); repo.refundPayment('one');
    revenue = repo.settings('owner', '/api').affiliate.revenue!;
    expect(revenue.currencies['EUR']).toEqual({ gross: 100, refunded: 100, net: 0 });
    expect(revenue.purchases).toBe(2);
    injector.destroy();
  });

  it('uses the captured 25% policy and requires approval before each separate partial and full refund', () => {
    let state: any = { [USERS_TABLE_NAME]: { ids: ['owner', 'member'], byId: {
      owner: { id: 'owner', activities: {} },
      member: { id: 'member', affiliateReferrerUserId: 'owner', activities: {} }
    } } };
    const db = { read: () => state, write: (change: any) => { state = change(state); } };
    const injector = createEnvironmentInjector([{ provide: LocalMemoryDb, useValue: db }], null as any);
    let repo = runInInjectionContext(injector, () => new LocalIntegrationRepository());
    const policy = { enabled: true, rules: [{ id: 'ordinary', offsetUnit: 'hours' as const,
      offsetValue: 0, refundKind: 'percent' as const, refundValue: 25 }] };
    repo.recordPayment('member', 'paid', 'EUR', 100, 0, true, 'event', 'owner', '2099-01-01T12:00:00Z', policy);
    policy.rules[0].refundValue = 100;
    expect(repo.paymentHistory('member')[0].refundPreview?.refundableAmount).toBe(25);
    expect(repo.requestPolicyRefund('owner', 'paid')).toBe(false);
    expect(repo.requestPolicyRefund('member', 'paid')).toBe(true);
    expect(repo.settings('owner', '/api').affiliate.revenue!.currencies['EUR'].refunded).toBe(0);
    const request = repo.paymentHistory('owner').find(row => row.canApproveRefund)!;
    expect(request.amount).toBe(25);
    state = JSON.parse(JSON.stringify(state));
    repo = runInInjectionContext(injector, () => new LocalIntegrationRepository());
    repo.approveChangedTermsRefund('owner', request.id);
    repo.approveChangedTermsRefund('owner', request.id);
    expect(repo.settings('owner', '/api').affiliate.revenue!.currencies['EUR']).toEqual({ gross: 100, refunded: 25, net: 75 });
    expect(repo.paymentHistory('member')[0].canRequestRefund).toBe(false);
    const first = structuredClone(state[USERS_TABLE_NAME].byId.member.affiliatePayments.paid.refundOperations[0]);
    repo.recordPayment('member', 'paid', 'EUR', 100);
    expect(state[USERS_TABLE_NAME].byId.member.affiliatePayments.paid.refunded).toBe(25);
    repo.markEventTermsChanged('event');
    repo.cancelEventPayments('event', 'member');
    const remaining = repo.paymentHistory('owner').find(row => row.canApproveRefund)!;
    expect(remaining.amount).toBe(75);
    repo.approveChangedTermsRefund('owner', remaining.id);
    const payment = state[USERS_TABLE_NAME].byId.member.affiliatePayments.paid;
    expect(payment.refundOperations.map((row: any) => row.amount)).toEqual([25, 75]);
    expect(payment.refundOperations[0]).toEqual(first);
    expect(state[USERS_TABLE_NAME].byId.owner.activities.paymentRefundsPending).toBe(0);
    injector.destroy();
  });

  it('waits for approval of a changed-terms refund and preserves an earlier partial refund', () => {
    let state: any = { [USERS_TABLE_NAME]: { ids: ['owner', 'member', 'other'], byId: {
      owner: { id: 'owner', activities: { paymentRefundsPending: 0 } },
      member: { id: 'member', affiliateReferrerUserId: 'owner', activities: {} },
      other: { id: 'other', activities: {} }
    } } };
    const db = { read: () => state, write: (change: any) => { state = change(state); } };
    const injector = createEnvironmentInjector([{ provide: LocalMemoryDb, useValue: db }], null as any);
    let repo = runInInjectionContext(injector, () => new LocalIntegrationRepository());
    repo.recordPayment('member', 'paid', 'EUR', 100, 25, true, 'event', 'owner');
    repo.recordPayment('other', 'control', 'EUR', 10, 0, true, 'event', 'owner');
    const firstRefund = structuredClone(state[USERS_TABLE_NAME].byId.member.affiliatePayments.paid.refundOperations[0]);
    repo.markEventTermsChanged('event');
    repo.cancelEventPayments('event', 'member');
    repo.cancelEventPayments('event', 'member');
    expect(state[USERS_TABLE_NAME].byId.owner.activities.paymentRefundsPending).toBe(1);
    expect(repo.settings('owner', '/api').affiliate.revenue!.currencies['EUR']).toEqual({ gross: 100, refunded: 25, net: 75 });
    const request = repo.paymentHistory('owner').find(item => item.refundRequestStatus === 'pending')!;
    expect(request.amount).toBe(75);
    expect(request.canApproveRefund).toBe(true);
    expect(repo.paymentHistory('member').find(item => item.id === request.id)!.canApproveRefund).toBe(false);
    state = JSON.parse(JSON.stringify(state));
    repo = runInInjectionContext(injector, () => new LocalIntegrationRepository());
    expect(() => repo.approveChangedTermsRefund('other', request.id)).toThrow();
    repo.approveChangedTermsRefund('owner', request.id);
    repo.approveChangedTermsRefund('owner', request.id);
    expect(state[USERS_TABLE_NAME].byId.owner.activities.paymentRefundsPending).toBe(0);
    expect(repo.settings('owner', '/api').affiliate.revenue!.currencies['EUR']).toEqual({ gross: 100, refunded: 100, net: 0 });
    const payment = state[USERS_TABLE_NAME].byId.member.affiliatePayments.paid;
    expect(payment.refundOperations.map((row: any) => row.amount)).toEqual([25, 75]);
    expect(payment.refundOperations[0]).toEqual(firstRefund);
    expect(state[USERS_TABLE_NAME].byId.other.affiliatePayments.control.refunded).toBe(0);
    injector.destroy();
  });

  it.each([false, true])('settles cancellation once with a pending request (single member: %s)', (singleMember) => {
    let state: any = { [USERS_TABLE_NAME]: { ids: ['owner', 'member', 'other'], byId: {
      owner: { id: 'owner', activities: {} },
      member: { id: 'member', affiliateReferrerUserId: 'owner', activities: {} },
      other: { id: 'other', affiliateReferrerUserId: 'owner', activities: {} }
    } } };
    const db = { read: () => state, write: (change: any) => { state = change(state); } };
    const injector = createEnvironmentInjector([{ provide: LocalMemoryDb, useValue: db }], null as any);
    const repo = runInInjectionContext(injector, () => new LocalIntegrationRepository());
    repo.recordPayment('member', 'booking', 'EUR', 100, 25, true, 'event', 'owner');
    repo.recordPayment('member', 'asset', 'EUR', 20, 0, false, 'event', 'owner');
    repo.recordPayment('other', 'other-booking', 'EUR', 10, 0, true, 'event', 'owner');
    repo.recordPayment('other', 'unrelated', 'EUR', 5, 0, true, 'unrelated-event', 'owner');
    repo.markEventTermsChanged('event');
    repo.cancelEventPayments('event', 'member');
    expect(state[USERS_TABLE_NAME].byId.owner.activities.paymentRefundsPending).toBe(2);
    const firstRefund = structuredClone(state[USERS_TABLE_NAME].byId.member.affiliatePayments.booking.refundOperations[0]);
    const cancel = () => repo.cancelEventPayments('event', singleMember ? 'member' : undefined, singleMember);
    cancel();
    const completed = structuredClone(state);
    cancel();
    expect(state).toEqual(completed);
    expect(state[USERS_TABLE_NAME].byId.owner.activities.paymentRefundsPending).toBe(0);
    const payments = state[USERS_TABLE_NAME].byId.member.affiliatePayments;
    expect(payments.booking.refundOperations.map((row: any) => row.amount)).toEqual([25, 75]);
    expect(payments.booking.refundOperations[0]).toEqual(firstRefund);
    expect(payments.asset.refunded).toBe(20);
    expect(state[USERS_TABLE_NAME].byId.other.affiliatePayments['other-booking'].refunded).toBe(singleMember ? 0 : 10);
    expect(state[USERS_TABLE_NAME].byId.other.affiliatePayments.unrelated.refunded).toBe(0);
    const summary = repo.settings('owner', '/api').affiliate.revenue!;
    expect(summary.purchases).toBe(4);
    expect(summary.eventBookings).toBe(3);
    expect(summary.currencies['EUR'].net).toBe(singleMember ? 15 : 5);
    injector.destroy();
  });

  it('does not give a later purchase an earlier changed-terms entitlement', () => {
    let state: any = { [USERS_TABLE_NAME]: { ids: ['owner', 'member'], byId: {
      owner: { id: 'owner', activities: {} }, member: { id: 'member', activities: {} }
    } } };
    const injector = createEnvironmentInjector([{ provide: LocalMemoryDb,
      useValue: { read: () => state, write: (change: any) => { state = change(state); } } }], null as any);
    const repo = runInInjectionContext(injector, () => new LocalIntegrationRepository());
    repo.markEventTermsChanged('event');
    repo.recordPayment('member', 'new-booking', 'EUR', 10, 0, true, 'event', 'owner');
    expect(() => repo.cancelEventPayments('event', 'member')).toThrow('No changed-terms cancellation');
    expect(state[USERS_TABLE_NAME].byId.member.affiliatePayments['new-booking'].refunded).toBe(0);
    expect(repo.paymentHistory('owner').some(row => row.refundRequestStatus === 'pending')).toBe(false);
    injector.destroy();
  });
});

describe('Local MCP connections', () => {
  it('persists profile-owned slots, separates API scopes, hides secrets on reload and releases revoked slots', () => {
    let state: any = {[USERS_TABLE_NAME]: {ids: ['owner', 'other'], byId: {owner: {id: 'owner'}, other: {id: 'other'}}}};
    const db = {read: () => state, write: (change: any) => {state = change(state);}};
    const injector = createEnvironmentInjector([{provide: LocalMemoryDb, useValue: db}], null as any);
    const repo = runInInjectionContext(injector, () => new LocalIntegrationRepository());
    const input = {name: 'Claude', redirectUri: 'https://claude.example/callback'};
    const first = repo.createMcpClient('owner', input);
    expect(first.secret).toMatch(/^msc_/);
    repo.createToken('owner', 'API', 90);
    const restored = runInInjectionContext(injector, () => new LocalIntegrationRepository());
    expect(restored.mcpSettings('owner', '/mcp/private')).toMatchObject({remoteEnabled: false, clients: [first.client]});
    expect(JSON.stringify(restored.mcpSettings('owner', '/mcp/private'))).not.toContain(first.secret);
    expect(restored.mcpSettings('other', '/mcp/private').clients).toHaveLength(0);
    expect(restored.settings('owner', '/api').tokens).toHaveLength(1);
    restored.revokeMcpClient('other', first.client.token.id);
    restored.revokeToken('owner', first.client.token.id);
    expect(restored.mcpSettings('owner', '/mcp/private').clients).toHaveLength(1);
    restored.createMcpClient('owner', input); restored.createMcpClient('owner', input);
    expect(() => restored.createMcpClient('owner', input)).toThrow();
    restored.revokeMcpClient('owner', first.client.token.id);
    expect(restored.mcpSettings('owner', '/mcp/private').clients).toHaveLength(2);
    expect(() => restored.createMcpClient('owner', input)).not.toThrow();
    for (const redirectUri of ['http://remote.example/cb', 'https://a/cb#frag', 'https://user@a/cb', 'https://a/*']) {
      expect(() => restored.createMcpClient('other', {name:'Bad', redirectUri})).toThrow();
    }
    injector.destroy();
  });
});
