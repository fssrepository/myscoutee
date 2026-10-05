import {LocalUsersMapper} from '../mappers/user.mapper';
import {LocalActivityInviteCandidatesRepository} from '../repositories/activity-invite-candidates.repository';
import {SeedCommunityGroupsRepository} from '../../seed/repositories/community-groups-seed.repository';
import {TestBed} from '@angular/core/testing';
import {LocalMemoryDb} from '../../../common/app.db';
import {RouteDelayService} from '../../../base/services/route-delay.service';
import {SeedUsersRepository} from '../../seed/repositories/users-seed.repository';
import {SeedEventsRepository} from '../../seed/repositories/events-seed.repository';
import {SeedAssetsRepository} from '../../seed/repositories/assets-seed.repository';
import {SeedPaymentsRepository} from '../../seed/repositories/payments-seed.repository';
import {LocalPaymentMethodsService} from './payment-methods.service';
describe('Canonical local payment history and member filter',()=>{
 let db:LocalMemoryDb,service:LocalPaymentMethodsService,alex:string,anna:string,elijah:string;
 beforeEach(async()=>{TestBed.configureTestingModule({providers:[{provide:RouteDelayService,useValue:{waitForRouteDelay:async()=>undefined}}]});
  db=TestBed.inject(LocalMemoryDb);await db.resetStorage();const users=TestBed.inject(SeedUsersRepository).seedDefaults();
  TestBed.inject(SeedEventsRepository).seedDefaults();TestBed.inject(SeedAssetsRepository).seedDefaults(users.map(u=>u.id),users);TestBed.inject(SeedPaymentsRepository).seedDefaults();
  const id=(name:string)=>users.find(u=>u.name===name&&!u.workspaceGroupId)!.id;alex=id('Alex Turner');anna=id('Farkas Anna');elijah=id('Elijah Brooks');service=TestBed.inject(LocalPaymentMethodsService);
 });
 afterEach(()=>TestBed.resetTestingModule());
 it('uses stable real actors and one persisted ledger for both sides and card history',async()=>{
  const query={page:0,pageSize:20},all=await service.queryAllHistory(alex,query);expect(all.items).toHaveLength(4);
  expect(all.spendingTotals).toEqual({HUF:17400});expect(all.incomeTotals).toEqual({HUF:8400});
  const filtered=await service.queryAllHistory(alex,{...query,filters:{counterpartyUserId:anna}});expect(filtered.items).toHaveLength(3);expect(filtered.spendingTotals).toEqual(all.spendingTotals);
  expect((await service.queryAllHistory(elijah,query)).items[0]).toMatchObject({direction:'income',counterpartyUserId:alex,amount:12500});
  expect((await service.queryHistory(alex,'pm_demo_alex_visa_1881',query)).items).toHaveLength(2);
  expect(await service.queryAllHistory(alex,query)).toEqual(all);
  await expect(service.requestRefund(alex,'payment-demo-alex-failed')).rejects.toThrow();
  expect(LocalUsersMapper.toDto(db.read().users.byId[alex])).not.toHaveProperty('savedPaymentMethods');
  await service.deletePaymentMethod(alex,'pm_demo_alex_visa_4242');TestBed.inject(SeedPaymentsRepository).seedDefaults();expect(db.read().users.byId[alex].savedPaymentMethods).toHaveLength(2);
 });
 it('offers all current-group payment members without a prior meeting and keeps group profiles separate',async()=>{
  const users=Object.values(db.read().users.byId);TestBed.inject(SeedCommunityGroupsRepository).seedDefaults(users);
  const active=`group:myscoutee-community:${alex}`,other=`group:myscoutee-community:${anna}`;
  const repo=TestBed.inject(LocalActivityInviteCandidatesRepository);
  const query={activeUserId:active,purpose:'payment' as const,owner:{ownerType:'asset' as const,ownerId:active,title:'Payment',subtitle:'',detail:'',dateIso:'',distanceKm:0,sourceType:'events' as const,isAdmin:false},parentOwner:null,existingMemberUserIds:[],pendingInviteUserIds:[],sort:'recent' as const,page:0,pageSize:100};
  const page=await repo.queryCandidateRecords(query);expect(page.items.map(i=>i.user.id)).toContain(other);expect(page.items.map(i=>i.user.id)).not.toContain(anna);expect(page.items.map(i=>i.user.id)).not.toContain(active);
  expect((await repo.queryCandidateRecords({...query,owner:{...query.owner,ownerId:alex}})).items).toEqual([]);
 });
 it('records transfers once, notifies only the payer and preserves the member filter after mutations',async()=>{
  const req={method:'bank-transfer' as const,requestId:'b5e0289c-1b09-47ca-8ba1-20cf5e2dcb02',payerUserId:anna,amount:25,currency:'EUR',note:'Meter deposit'};
  await service.recordCashReceipt(alex,req);await service.recordCashReceipt(alex,req);
  const list=await service.queryAllHistory(alex,{page:0,pageSize:20,filters:{counterpartyUserId:anna}});expect(list.items.filter(p=>p.provider==='bank-transfer')).toHaveLength(1);
  const notifications=Object.values(db.read().notifications.byId).filter(n=>n.kind==='payment-transfer-received');expect(notifications).toHaveLength(1);expect(notifications[0].recipientUserId).toBe(anna);
  await expect(service.recordCashReceipt(alex,{...req,payerUserId:alex})).rejects.toThrow();
  const payment=list.items.find(p=>p.provider==='bank-transfer')!;
  await service.requestRefund(anna,payment.id);await service.requestRefund(anna,payment.id);
  const requests=Object.values(db.read().notifications.byId).filter(n=>n.kind==='payment-refund-requested');expect(requests).toHaveLength(1);expect(requests[0].recipientUserId).toBe(alex);
  const pending=(await service.queryAllHistory(alex,{page:0,pageSize:20})).items.find(p=>p.refundRequestStatus==='pending')!;
  await service.approveRefund(alex,pending.id);await service.approveRefund(alex,pending.id);
  const approvals=Object.values(db.read().notifications.byId).filter(n=>n.kind==='payment-refund-approved');expect(approvals).toHaveLength(1);expect(approvals[0].recipientUserId).toBe(anna);

 });
});
