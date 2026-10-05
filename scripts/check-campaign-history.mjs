import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { compiledDevModules } from './compiled-dev-modules.mjs';
const {symbol} = compiledDevModules(process.argv[2]);
const Service = await symbol('LocalCampaignsService'), Repo = await symbol('LocalCampaignsRepository');
const table = records => ({ids:records.map(r=>r.id),byId:Object.fromEntries(records.map(r=>[r.id,r]))});
const user = id => ({id,workspaceGroupId:'work',profileStatus:'public',name:id,images:[],city:''});
const actor=user('viewer'), peer=user('organizer');
const campaigns = Array.from({length:7},(_,i)=>({id:'ad'+i,title:'Campaign '+i,description:'Complete details '+i,kind:'work',category:'creative',
 workspaceGroupId:'work',ownerUserId:peer.id,status:'published',imageUrls:[],attachments:[],createdAtIso:'2026-01-01T00:00:00Z',updatedAtIso:'2026-10-01T00:00:00Z',version:0}));
const rates = campaigns.map((c,i)=>({id:'rate'+i,campaignId:c.id,fromUserId:i%2?peer.id:actor.id,toUserId:i%2?actor.id:peer.id,mode:'single',rate:8,updatedAtIso:`2026-09-0${i+1}T10:00:00Z`}));
const extra = [
 {id:'unrated'}, {id:'private',status:'draft'}, {id:'outside',workspaceGroupId:'elsewhere'},
 {id:'thirdparty',ownerUserId:'stranger'}, {id:'undated'}, {id:'other-pair'}, {id:'pair-mode'}
].map(c=>({...campaigns[0],...c}));
const extraRates = extra.filter(c=>c.id!=='unrated').map(c=>({...rates[0],id:c.id,campaignId:c.id,
 updatedAtIso:c.id==='undated'?'':rates[0].updatedAtIso,
 toUserId:c.id==='other-pair'?'stranger':peer.id,mode:c.id==='pair-mode'?'pair':'single'}));
let state={campaigns:table([...campaigns,...extra]),userRates:table([...rates,...extraRates]),chats:table([
 {id:'conversation',ownerUserId:actor.id,ownerId:'ad0',channelType:'campaign',memberIds:[actor.id,peer.id],dateIso:'2026-10-03T10:00:00Z'},
 {id:'other-conversation',ownerUserId:actor.id,ownerId:'unrated',channelType:'campaign',memberIds:[actor.id,'stranger'],dateIso:'2026-10-04T10:00:00Z'}
])};
const repository=Object.create(Repo.prototype);repository.db={read:()=>state};
const service=Object.create(Service.prototype);Object.assign(service,{campaigns:repository,actor:async()=>actor,
 users:{queryUserById:id=>id===peer.id?peer:id==='outside'?{...peer,workspaceGroupId:'elsewhere'}:null}});
const first=await service.history(actor.id,peer.id,{page:0,pageSize:5});
assert.equal(first.total,7);assert.equal(first.nextCursor,'5');
assert.deepEqual(first.items.map(r=>r.campaign.id),['ad0','ad6','ad5','ad4','ad3']);
assert.equal(first.items[0].lastInteractionAtIso,'2026-10-03T10:00:00.000Z');
const second=await service.history(actor.id,peer.id,{page:1,pageSize:5,cursor:first.nextCursor});
assert.deepEqual(second.items.map(r=>r.campaign.id),['ad2','ad1']);assert.equal(second.nextCursor,null);
await assert.rejects(service.history(actor.id,'outside',{page:0,pageSize:5}),/not found/);
await assert.rejects(service.history(actor.id,peer.id,{page:0,pageSize:5,cursor:'bad'}),/cursor/);
peer.profileStatus='blocked';await assert.rejects(service.history(actor.id,peer.id,{page:0,pageSize:5}),/not found/);peer.profileStatus='public';
console.log('PASS history: two-way ratings + chats, latest date, deduplication, paging, private/cross-workspace/other-pair exclusion');

const dom=new JSDOM('<!doctype html><html><body><app-form-flow></app-form-flow></body></html>',{url:'http://localhost',pretendToBeVisual:true});
for(const key of ['window','document','Node','NodeFilter','Element','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Event','MouseEvent','MutationObserver','getComputedStyle'])globalThis[key]=dom.window[key];
dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
globalThis.ResizeObserver=class{observe(){}disconnect(){}unobserve(){}};
globalThis.IntersectionObserver=class{observe(){}disconnect(){}unobserve(){}};
globalThis.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),0);globalThis.cancelAnimationFrame=clearTimeout;
dom.window.HTMLElement.prototype.scrollTo=function(){};
// JSDOM has no layout: provide an occupied viewport so shared fill-to-viewport logic does not drain all pages.
Object.defineProperty(dom.window.HTMLElement.prototype,'clientHeight',{get:()=>600});
Object.defineProperty(dom.window.HTMLElement.prototype,'scrollHeight',{get:()=>2400});
const bootstrap=await symbol('bootstrapApplication'),FormFlow=await symbol('FormFlowComponent'),I18n=await symbol('I18nService');
const app=await bootstrap(FormFlow,{providers:[{provide:I18n,useValue:{revision:()=>0,translate:k=>k,currentLanguage:()=> 'hu'}}]});
const create=await symbol('createComponent'),envInjector=await symbol('createEnvironmentInjector'),signal=await symbol('signal');
const Store=await symbol('CampaignsStore'),Guide=await symbol('ExplanationGuideService'),Media=await symbol('MediaService'),Profiles=await symbol('ProfileStore'),Contacts=await symbol('ContactsService');
const Popup=await symbol('CampaignsPopupComponent'),History=Popup.ɵcmp.dependencies.find(c=>c.name.replace(/^_/,'')==='CampaignHistoryPopupComponent');
const calls=[],profileLoads=[];let fail=false;
const historyStore={historyTarget:signal({userId:actor.id,targetUserId:peer.id,label:'Organizer'}),busy:signal(false),error:signal(''),editor:signal(null),
 closeHistory(){this.historyTarget.set(null);},historyPage:async(q,abort)=>{calls.push(q);if(fail)throw new Error('offline');return service.history(actor.id,peer.id,q,abort);}};
const env=envInjector([{provide:Store,useValue:historyStore},{provide:Guide,useValue:{registerContext:()=>()=>{},popupOpen:()=>false}},
 {provide:Profiles,useValue:{profileViewTarget:signal(null)}},{provide:Contacts,useValue:{loadContactProfile:async id=>{profileLoads.push(id);return{user:null,experiences:[]};}}},
 {provide:Media,useValue:{downloadDocument:async()=>{}}}],app.injector);
const host=document.createElement('div');document.body.append(host);
const ref=create(History,{environmentInjector:env,hostElement:host});app.attachView(ref.hostView);
const settle=async()=>{for(let i=0;i<4;i++){app.tick();await new Promise(r=>setTimeout(r,30));}app.tick();};
await settle();await settle();
assert.equal(calls.length,1);assert.equal(calls[0].pageSize,5);
assert.equal(host.querySelectorAll('app-accordion').length,5);
assert.equal(host.querySelectorAll('app-campaign-editor').length,1,'Only first campaign details render initially');
assert.equal(host.querySelectorAll('app-popup').length,1,'Embedded details do not create nested popups');
assert.ok(host.querySelector('app-form-flow input').disabled,'Read-only campaign form reused');
const rows=[...host.querySelectorAll('.ui-accordion__header')];rows[0].click();await settle();
assert.equal(host.querySelectorAll('app-campaign-editor').length,0);
rows[1].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await settle();
assert.equal(host.querySelectorAll('app-campaign-editor').length,1);assert.equal(rows[1].getAttribute('aria-expanded'),'true');
assert.ok(host.textContent.includes('2026'),'Shared date group headers render interaction dates');
const choose=async id=>{
 const trigger=[...host.querySelectorAll('.ui-popup__header button')].find(b=>b.textContent.includes('campaign.'+ref.instance.view()));
 assert.ok(trigger);trigger.click();await settle();
 const option=[...host.querySelectorAll('button')].find(b=>b.getAttribute('role')==='menuitemradio'&&b.textContent.includes('campaign.'+id));
 assert.ok(option);option.click();await settle();
};
await choose('organizer');assert.deepEqual(profileLoads,[peer.id]);assert.equal(host.querySelector('.history-list').getAttribute('aria-hidden'),'true');
assert.equal(ref.instance.model().headerControls[0].trigger.palette,'violet');
await choose('details');assert.equal(calls.length,1,'Tab switching retains the loaded window');assert.equal(rows[1].getAttribute('aria-expanded'),'true');
assert.equal(ref.instance.model().headerControls[0].trigger.palette,'blue');
await ref.instance.list.loadNextPage();await settle();
assert.equal(calls.length,2);assert.equal(calls[1].cursor,'5');assert.equal(host.querySelectorAll('app-accordion').length,7);
assert.equal(host.querySelectorAll('app-campaign-editor').length,1,'Appending does not expand more campaigns');
fail=true;ref.instance.list.reload();await settle();await settle();
assert.ok(host.querySelector('[role="alert"]').textContent.includes('campaign.history.load.failed'));
assert.equal(host.textContent.includes('campaign.history.empty'),false,'Load error is not reported as no interactions');
fail=false;const retry=[...host.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='retry');assert.ok(retry);retry.click();await settle();await settle();
assert.equal(host.querySelector('[role="alert"]'),null);assert.equal(host.querySelectorAll('app-accordion').length,5);
ref.destroy();host.remove();
// Render the real shell template with unrelated menus closed. This covers the owning
// outlet condition, which a standalone popup test cannot exercise.
const SideMenu=await symbol('SideMenuComponent'),SingleCard=await symbol('SingleCardComponent');
const ActivityPopup=await symbol('ActivitiesPopupComponent');
Object.assign(historyStore,{session:signal(null),component:signal(Popup),selectedId:signal(null),selected:signal(null),changed:signal(null),generation:0,
 profile:{activeUserId:()=>actor.id},workspace:{isWork:()=>true},load:async()=>{}});
historyStore.historyTarget.set(null);historyStore.openHistory=Store.prototype.openHistory.bind(historyStore);
const closed=new Proxy(()=>null,{get:()=>closed});
const shellContext=new Proxy({campaigns:historyStore},{get:(target,key)=>key in target?target[key]:closed});
const originalFactory=SideMenu.ɵcmp.factory;SideMenu.ɵcmp.factory=()=>shellContext;
const shellHost=document.createElement('div'),cardHost=document.createElement('div');document.body.append(shellHost,cardHost);
const shell=create(SideMenu,{environmentInjector:env,hostElement:shellHost});app.attachView(shell.hostView);
const card=create(SingleCard,{environmentInjector:env,hostElement:cardHost});
card.setInput('card',{rowId:'rating-organizer',presentation:'list',state:'default',slides:[{imageUrl:'',primaryLine:'Organizer'}],profileView:{userId:peer.id,label:'Organizer'}});
const routeContext={activitiesPrimaryFilter:'rates',workspace:historyStore.workspace,campaigns:historyStore,profileStore:{openProfileView(){throw new Error('Wrong ordinary profile route');}}};
card.instance.detailClick.subscribe(event=>ActivityPopup.prototype.openProfileView.call(routeContext,event));app.attachView(card.hostView);await settle();
assert.equal(shellHost.querySelector('app-campaign-history-popup'),null);
const eye=cardHost.querySelector('.shared-card-profile-view-btn');assert.ok(eye);eye.click();await settle();await settle();
assert.equal(historyStore.session(),null);assert.equal(historyStore.editor(),null);
assert.equal(historyStore.historyTarget().targetUserId,peer.id);
assert.ok(shellHost.querySelector('app-campaign-history-popup app-popup'),'Eye click must mount the history through the real application outlet without list/editor state');
assert.equal(shellHost.querySelectorAll('app-accordion').length,5);
historyStore.closeHistory();await settle();assert.equal(shellHost.querySelector('app-campaign-history-popup'),null);
card.destroy();shell.destroy();SideMenu.ɵcmp.factory=originalFactory;cardHost.remove();shellHost.remove();
env.destroy();app.destroy();dom.window.close();
console.log('PASS eye DOM click -> Work rating handler -> CampaignsStore -> actual SideMenu outlet -> history popup, and close unmounts it');
console.log('PASS actual AOT popup: dated accordion, keyboard expansion, read-only embedded details, header tabs preserve state, next-page append and failed-load retry');

const historyOwner=Object.create(Store.prototype);let finish;
Object.assign(historyOwner,{historyTarget:signal({userId:'viewer',targetUserId:'organizer'}),generation:0,service:{history:()=>new Promise(r=>finish=r)}});
const stale=historyOwner.historyPage({page:0,pageSize:5});historyOwner.closeHistory();finish(first);
await assert.rejects(stale,e=>e.name==='AbortError');
const Activities=await symbol('ActivitiesPopupComponent'),activity=Object.create(Activities.prototype);let route;
Object.assign(activity,{activitiesPrimaryFilter:'rates',workspace:{isWork:()=>true},campaigns:{openHistory:v=>route=['history',v]},profileStore:{openProfileView:v=>route=['profile',v]}});
activity.openProfileView({userId:'organizer'});assert.equal(route[0],'history');
activity.activitiesPrimaryFilter='events';activity.openProfileView({userId:'organizer'});assert.equal(route[0],'profile');
activity.activitiesPrimaryFilter='rates';activity.workspace.isWork=()=>false;activity.openProfileView({userId:'organizer'});assert.equal(route[0],'profile');
console.log('PASS stale history response rejected; Work Ratings open history while events and other workspaces preserve profile navigation');
