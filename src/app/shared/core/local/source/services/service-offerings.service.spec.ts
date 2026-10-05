import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../common/app.db';
import { RouteDelayService } from '../../../base/services/route-delay.service';
import { SeedUsersRepository } from '../../seed/repositories/users-seed.repository';
import { SeedCommunityGroupsRepository } from '../../seed/repositories/community-groups-seed.repository';
import { SeedServiceOfferingsRepository } from '../../seed/repositories/service-offerings-seed.repository';
import { LocalServiceOfferingsService } from './service-offerings.service';
import { LocalServiceOfferingsRepository } from '../repositories/service-offerings.repository';
import { BaseUserRatesMapper } from '../../../base/mappers/rate.mapper';
import { COMMUNITY_BASE_GROUP_ID } from '../../../contracts/group-type';
describe('Community service ownership, discovery and provider priorities',()=>{
 let db:LocalMemoryDb,service:LocalServiceOfferingsService,alex:string,anna:string;
 beforeEach(async()=>{
  TestBed.configureTestingModule({providers:[{provide:RouteDelayService,useValue:{waitForRouteDelay:async()=>undefined}}]});
  db=TestBed.inject(LocalMemoryDb);await db.resetStorage();
  const users=TestBed.inject(SeedUsersRepository).seedDefaults();TestBed.inject(SeedCommunityGroupsRepository).seedDefaults(users);
  TestBed.inject(SeedServiceOfferingsRepository).seedDefaults();
  alex=users.find(u=>u.name==='Alex Turner'&&!u.workspaceGroupId)!.id;anna=users.find(u=>u.name==='Farkas Anna'&&!u.workspaceGroupId)!.id;
  service=TestBed.inject(LocalServiceOfferingsService);
 });
 afterEach(()=>TestBed.resetTestingModule());
 it('separates own drafts from published discovery and never notifies on publication alone',async()=>{
  const original=await service.detail(anna,'service-anna-meters');
  await expect(service.save({...original.service,userId:alex,title:'Hijack'})).rejects.toThrow();
  const draft=await service.action(anna,original.service.id,'unpublish',original.service.version);
  await expect(service.detail(alex,original.service.id)).rejects.toThrow();
  expect((await service.page(anna,{page:0,pageSize:20,filters:{scope:'own',status:'draft'}})).items.map(i=>i.service.id)).toContain(original.service.id);
  await service.action(anna,draft.service.id,'publish',draft.service.version);
  expect((await service.page(alex,{page:0,pageSize:20,filters:{scope:'discover',category:'plumbing'}})).items.map(i=>i.service.id)).toEqual([original.service.id]);
  expect(Object.values(db.read().notifications.byId)).toHaveLength(0);
 });
 it('keeps revisions and staff ownership through save and reseeding',async()=>{
  const item=await service.detail(anna,'service-anna-meters');
  const edited=await service.save({...item.service,userId:anna,title:'Scheduled meter service'});
  await expect(service.save({...item.service,userId:anna,title:'Stale'})).rejects.toThrow();
  await expect(service.save({...edited.service,userId:anna,staffAccountIds:['outsider']})).rejects.toThrow();
  await db.flushToIndexedDb();TestBed.inject(SeedServiceOfferingsRepository).seedDefaults();
  expect((await service.detail(anna,item.service.id)).service.title).toBe('Scheduled meter service');
 });
 it('uses the existing person rating for every service offered by that provider',async()=>{
  const from=`group:${COMMUNITY_BASE_GROUP_ID}:${alex}`,to=`group:${COMMUNITY_BASE_GROUP_ID}:${anna}`;
  const rate=BaseUserRatesMapper.toRecord({kind:'game-card',raterUserId:from,ratedUserId:to,rating:7})!;
  db.write(s=>({...s,userRates:{...s.userRates,ids:[...s.userRates.ids,rate.id],byId:{...s.userRates.byId,[rate.id]:rate}}}));
  expect(TestBed.inject(LocalServiceOfferingsRepository).ratingsByProvider(from).get(to)).toBe(7);
  expect((await service.detail(alex,'service-anna-meters')).viewerRating).toBe(7);
 });
});
