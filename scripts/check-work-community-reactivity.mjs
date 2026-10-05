import { compiledDevModules } from './compiled-dev-modules.mjs';
import assert from 'node:assert/strict';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
// Reuse the running watcher's AOT output: no second Angular build or browser session.
// Usage: node --max-old-space-size=192 scripts/check-work-community-reactivity.mjs <dev-output-directory>
assert.ok(process.argv[2], 'Pass the existing dev output directory');
const dir=resolve(process.argv[2]);
const compiled=compiledDevModules(dir);
const latest=prefix=>readdirSync(dir).filter(f=>f.startsWith(prefix)&&f.endsWith('.js')).sort((a,b)=>statSync(resolve(dir,b)).mtimeMs-statSync(resolve(dir,a)).mtimeMs)[0];
const load=f=>import(pathToFileURL(resolve(dir,f)).href);
const campaignFile=latest('campaigns-popup.component-');
const dependencies=[...readFileSync(resolve(dir,campaignFile),'utf8').matchAll(/from "\.\/(.*?)"/g)].map(m=>m[1]);
const coreFile=dependencies.find(f=>readFileSync(resolve(dir,f),'utf8').includes('function runInInjectionContext('));
const core=await load(coreFile);
const {signal,runInInjectionContext}=core;
const {CampaignsPopupComponent}=await load(campaignFile);
const {CommunityCasesPopupComponent}=await load(latest('community-cases-popup.component-'));
const {ServiceOfferingsPopupComponent}=await load(latest('service-offerings-popup.component-'));
const {CommunityAnnouncementsComponent}=await load(latest('community-announcements.component-'));
const guideFile=dependencies.find(f=>readFileSync(resolve(dir,f),'utf8').includes('var ExplanationGuideService ='));
const {ExplanationGuideService}=await load(guideFile);
// A bounded scheduler makes a regression fail instead of hanging the test process.
// Angular still owns effect tracking, invalidation and cleanup. Domain stores are isolated stubs.
const pending=new Set(),destroy=[];
let runs=0;
const scheduler={add:n=>pending.add(n),schedule:n=>pending.add(n),remove:n=>pending.delete(n)};
function flush(){let count=0;while(pending.size){if(++count>50)throw Error('Reactive cycle: >50 effect executions');const n=pending.values().next().value;pending.delete(n);n.run();}runs+=count;return count;}
const store={board:signal(null),quotations:signal(null),quotationFocus:signal(null),session:signal({userId:'work-member',tasks:false}),changed:signal(null),taskChanged:signal(null),busy:signal(false),error:signal(''),editor:signal(null),groups:signal([]),managedGroups:signal([]),groupId:signal('homes'),userId:signal('member'),canManage:signal(true),unitRows:signal([]),profileId:signal('work-member'),accountId:signal('account'),calendarCancelled:signal(null),staffMembers:signal([])};
Object.assign(store,{historyTarget:signal(null),selectedId:signal(null),selected:signal(null),taskCounters:signal({total:0,active:0,paused:0,trash:0}),counters:signal({total:0}),activeGroup:signal(null),audienceMembers:signal([]),audienceLoading:signal(false)});
const otherStores = new Map(['CommunityCasesStore','ServiceOfferingsStore','CommunityAnnouncementsStore'].map(name => [name, {...store, changed: signal(null)}]));
const i18n={currentLanguage:signal('en'),translate:k=>k};
let guide;
const injector={get(token,fallback){
 const name=(token.name??'').replace(/^_/, '');
 if(token===core.Injector)return injector;
 if(token===core.DestroyRef)return {onDestroy(fn){destroy.push(fn);return()=>{}}};
 if(name==='ViewContext')return null;
 if(name==='ChangeDetectionScheduler')return {notify(){}};
 if(name==='EffectScheduler')return scheduler;
 if(name==='I18nService')return i18n;
 if(name==='ExplanationGuideService')return guide;
 if(name==='CampaignsStore')return store;
 if(otherStores.has(name))return otherStores.get(name);
 if(['ProfileStore','MediaService'].includes(name))return {};
 if(fallback!==undefined)return fallback;
 throw Error('Missing test provider '+name+' '+String(token));
}};
guide=runInInjectionContext(injector,()=>new ExplanationGuideService({loadState:async()=>null}));
let registrations=0; const register=guide.registerContext.bind(guide); guide.registerContext=(...args)=>{registrations++; return register(...args);};
const home=guide.registerContext('community.services.home');
flush();
const instances=[];
for(const C of [CampaignsPopupComponent,CommunityCasesPopupComponent,ServiceOfferingsPopupComponent,CommunityAnnouncementsComponent]){
 const c=runInInjectionContext(injector,()=>new C());instances.push(c);flush();
 const get=c.model??c.popupModel;
 const a=get();for(let i=0;i<100;i++)assert.strictEqual(get(),a,C.name+' must preserve popup model identity');
 if(c.query){const q=c.query();for(let i=0;i<100;i++)assert.strictEqual(c.query(),q,C.name+' must preserve list query identity');}
 console.log('PASS',C.name,'stable model/query and settled guide effects');
}
// Exercise the real compiled editors without rendering or performing user actions.
const editorChecks = [
 [CampaignsPopupComponent, 'CampaignEditorComponent', { campaign: null, readOnly: false }, ['popupModel','flowModel']],
 [CommunityCasesPopupComponent, 'CommunityCaseEditorComponent', { editor: { kind: 'case', value: null, readOnly: false } }, ['popupModel','flowModel']],
 [CommunityAnnouncementsComponent, 'CommunityAnnouncementEditorComponent', { editor: { value: null, readOnly: false } }, ['popup','flow','voteMenu']],
 [ServiceOfferingsPopupComponent, 'ServiceOfferingEditorComponent', { editor: { value: null, readOnly: false } }, ['popup','flow']]
];
for(const [Parent,name,inputs,models] of editorChecks){
 const E=Parent.ɵcmp.dependencies.find(c=>c.name.replace(/^_/, '')===name);
 assert.ok(E,name+' compiled dependency');
 const e=runInInjectionContext(injector,()=>new E());
 for(const [name,value] of Object.entries(inputs))e[name]=signal(value);
 e.ngOnChanges();flush();
 for(const name of models){const initial=e[name]();for(let i=0;i<100;i++)assert.strictEqual(e[name](),initial,E.name+' '+name);}
 const popup=e.popup??e.popupModel,initial=popup();
 e.form.update(value=>({...value,title:'Changed title',label:'Changed unit',voting:true,slotsEnabled:true}));
 assert.notStrictEqual(popup(),initial,name+' responds to a real form edit');
 assert.strictEqual(popup(),popup(),name+' stabilizes after editing');
 if(e.flow)assert.strictEqual(e.flow(),e.flow());if(e.flowModel)assert.strictEqual(e.flowModel(),e.flowModel());
 e.ngOnDestroy();flush();console.log('PASS',name,'stable form/popup models before and after editing');
}
const before=registrations;const closeEditorGuide=guide.registerContext('work.campaign.editor');
flush();assert.equal(registrations,before+1,'opening a child guide must not rerun parent registrations');
closeEditorGuide();flush();assert.equal(registrations,before+1,'closing a child guide must not rerun parent registrations');
// A SmartList patch both reads and updates visible state. The campaign effect must not subscribe to that state.
const listState=signal(0);let patches=0;
instances[0].list={patchVisibleItem(){listState();listState.update(n=>n+1);patches++;return true}};
store.changed.set({id:'campaign-a',title:'Demo',description:'',kind:'work',category:'technology',imageUrls:[],status:'published',ownerUserId:'work-member',service:{id:'service-a',status:'published'},communityId:'other'});
flush();assert.equal(patches,1);listState.update(n=>n+1);assert.equal(flush(),0);assert.equal(patches,1);
for(const c of instances){const fn=c.model??c.popupModel;assert.strictEqual(fn(),fn());}
console.log('PASS nested guide open/close and mutation effect do not resubscribe to internal state; effects executed:',runs);

const announcementsPopup=instances[3],announcementStore=otherStores.get('CommunityAnnouncementsStore');
announcementStore.canManage.set(false);flush();
assert.deepEqual(announcementsPopup.headerItems(),[],'Residents have no redundant Published selector on Home');
assert.equal(announcementsPopup.popupModel().showToolbar,false,'Residents have no empty toolbar in Voting');
assert.deepEqual(announcementsPopup.popupModel().toolbarControls,[]);
assert.equal(announcementsPopup.query().filters.voting,true,'Voting filters before pagination');
announcementStore.canManage.set(true);flush();
assert.deepEqual(announcementsPopup.headerItems()[0].items.map(x=>x.id),['published','draft','trash']);
const dated=announcementsPopup.row({id:'notice',title:'Notice',body:'Body',voting:false,status:'published',publishedAtIso:'2026-10-05T09:15:00Z',createdAtIso:'2026-10-05T08:00:00Z'});
assert.equal(dated.detail,new Date('2026-10-05T09:15:00Z').toLocaleString('en',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}));
i18n.currentLanguage.set('hu');
assert.equal(announcementsPopup.row(dated.eagerDetail).detail,new Date('2026-10-05T09:15:00Z').toLocaleString('hu',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}));
i18n.currentLanguage.set('en');
const futureVote={...dated.eagerDetail,voting:true,deadlineIso:'2099-01-01T18:00:00Z',closed:false,canVote:false,myBallot:null};
assert.ok(announcementsPopup.menu(futureVote).some(m=>m.id==='vote'));
assert.ok(!announcementsPopup.menu(futureVote).some(m=>m.id==='results'));
const expiredVote={...futureVote,deadlineIso:'2020-01-01T18:00:00Z',closed:true};
assert.ok(announcementsPopup.menu(expiredVote).some(m=>m.id==='results'));
assert.ok(!announcementsPopup.menu(expiredVote).some(m=>m.id==='vote'));
let viewedVote;announcementStore.viewVoting=a=>viewedVote=a;
for(const [id,context] of [['vote',futureVote],['results',expiredVote]]){announcementsPopup.action({id,context});assert.equal(viewedVote,context);}
console.log('PASS resident/admin announcement navigation, voting-only query and localized timestamps with minute precision');

const compiledSymbol=compiled.symbol;
const AppMenuComponent=await compiledSymbol('AppMenuComponent');
// Daily sticky headings, category colors, state-specific actions and aggregate badges.
const casesPopup=instances[1],caseStore=otherStores.get('CommunityCasesStore');
const exampleCase={id:'case-a',title:'Inspection',description:'',communityName:'Home',communityId:'homes',ownerAccountId:'owner',
  caseType:'chimney-sweep',status:'open',updatedAtIso:'2026-10-05T09:00:00Z',createdAtIso:'2026-10-04T09:00:00Z',
  support:[],audienceAccountIds:['work-member'],members:[],affectedCount:4,canManage:true,unread:true,canChat:true,canReviewOffers:true,membershipStatus:'accepted',boardTasks:[],chatAccountIds:[]};
const ids=c=>casesPopup.menu(c).map(item=>item.id);
assert.ok(ids(exampleCase).includes('start'));assert.ok(!ids(exampleCase).includes('reopen'));
assert.ok(!ids({...exampleCase,status:'in-progress'}).includes('start'));
for(const status of ['completed','cancelled','trash']){
 const actions=ids({...exampleCase,status});assert.ok(actions.includes('reopen'));
 for(const id of ['start','complete','cancel','invite-provider'])assert.ok(!actions.includes(id),status+' excludes '+id);
}
assert.deepEqual(ids({...exampleCase,status:'trash'}),['view','chat','members','offers','reopen']);
const card=casesPopup.card({...exampleCase,status:'completed'});
assert.equal(card.mediaStart.label,'case.type.chimney-sweep');assert.equal(card.mediaStart.tone,'stage');assert.equal(card.mediaTitle,'Inspection');assert.equal(card.title,'Home');assert.deepEqual(card.metaRows,[]);
assert.equal(card.mediaEnd.tone,'stage-finalized');assert.equal(card.mediaEnd.label,'case.status.completed');assert.equal(card.mediaEnd.interactive,false);
assert.equal(casesPopup.card(exampleCase).accentHue,card.accentHue,'type color survives status changes');
assert.notEqual(casesPopup.card({...exampleCase,caseType:'fault'}).accentHue,card.accentHue);
assert.ok(casesPopup.config.groupBy(card));assert.equal(casesPopup.config.showFirstGroupMarker,false);
assert.ok(casesPopup.config.sortable.sortKey(card)[0]<casesPopup.config.sortable.sortKey({...card,dateIso:'2026-10-04T09:00:00Z'})[0]);
caseStore.counters.set({total:31,'open:chimney-sweep':17,'in-progress:fault':8,'completed:fault':6});
let toolbar=casesPopup.model().toolbarControls;
assert.equal(toolbar[0].trigger.counter.value(),25,'active badge includes both active statuses beyond one page');
assert.equal(toolbar[0].items.find(i=>i.id==='completed').counter.value(),6);
assert.equal(toolbar[1].items.find(i=>i.id==='fault').counter.value(),8);
caseStore.counters.set({total:31,'open:chimney-sweep':16,'in-progress:fault':8,'completed:fault':6,'completed:chimney-sweep':1});
assert.equal(toolbar[0].trigger.counter.value(),24,'Existing menu binding reads the updated signal without reopening');
assert.equal(toolbar[0].items.find(i=>i.id==='completed').counter.value(),7);
assert.equal(toolbar[1].trigger.label,'all');
for(const control of toolbar)for(const item of control.items){assert.ok(item.icon);assert.ok(item.palette);assert.equal(item.surface,'tinted');}
casesPopup.query.set({filters:{status:'active',caseType:'fault'}});
assert.equal(casesPopup.model().toolbarControls[0].trigger.counter.value(),8,'bucket badge respects the type filter');
casesPopup.query.set({filters:{status:'active'}});
assert.ok(!casesPopup.model().headerControls[0].items.some(i=>i.id==='services'),'My services is no longer inside Cases');
const servicesPopup=instances[2];
assert.deepEqual(servicesPopup.model().toolbarControls.map(c=>c.id),['status','create']);
assert.equal(servicesPopup.model().toolbarControls[1].align,'end');
assert.deepEqual(servicesPopup.model().headerControls[0].items.map(i=>i.id),['list','week','month']);
servicesPopup.view.set('month');assert.deepEqual(servicesPopup.model().toolbarControls.map(c=>c.id),['create']);servicesPopup.view.set('list');
console.log('PASS case lifecycle menus, category colors, category and contextual status badges, aggregate bucket/type counts and service navigation controls');

// Exercise the real selection stores: toggling never submits; only the header tick applies.
const providers={ExplanationGuideService:guide,UserProfileStore:{activeUserId:()=> 'work-member'},GroupWorkspaceContextService:{isWork:()=>true,isCommunity:()=>true,accountId:id=>id}};
const domainInjector={get(token,fallback){const name=(token.name??'').replace(/^_/,'');if(token===core.Injector)return domainInjector;
 if(providers[name])return providers[name];if(name.endsWith('Service')||name.endsWith('Store'))return {};
 return injector.get(token,fallback);}};
const CampaignsStore=await compiledSymbol('CampaignsStore'),ServiceOfferingsStore=await compiledSymbol('ServiceOfferingsStore');
const campaigns=runInInjectionContext(domainInjector,()=>new CampaignsStore());flush();
const selections=[],c1={id:'c1',status:'published'},c2={id:'c2',status:'published'};
campaigns.session.set({userId:'work-member',select:value=>selections.push(value),selectedId:null});
campaigns.toggleSelection(c1);campaigns.toggleSelection(c2);
assert.equal(campaigns.selectedId(),'c2');assert.equal(selections.length,0);
campaigns.toggleSelection(c2);assert.equal(campaigns.selected(),null);assert.equal(selections.length,0);
campaigns.toggleSelection(c1);campaigns.confirmSelection();assert.deepEqual(selections,[c1]);assert.equal(campaigns.session(),null);
campaigns.session.set({userId:'work-member',select:value=>selections.push(value),selectedId:'c1'});campaigns.selectedId.set('c1');
campaigns.selectedId.set(null);campaigns.confirmSelection();assert.deepEqual(selections,[c1,null],'confirming empty basket clears the caller filter');
campaigns.session.set({userId:'work-member',select:value=>selections.push(value)});campaigns.toggleSelection(c2);campaigns.close();assert.equal(selections.length,2,'cancel never applies');
const services=runInInjectionContext(domainInjector,()=>new ServiceOfferingsStore());flush();
const picked=[],s1={service:{id:'s1'}},s2={service:{id:'s2'}};
services.session.set({pick:s=>picked.push(s)});services.toggleSelection(s1);services.toggleSelection(s2);assert.equal(picked.length,0);
assert.equal(services.selected(),s2);services.confirmSelection();assert.deepEqual(picked,[s2]);assert.equal(services.session(),null);
// The card checkmark and basket are driven by a stable signal and patch only affected rows.
const popup=instances[0],cards=[{id:'c1',title:'A',kind:'work',category:'technology',status:'published',imageUrls:[]},{id:'c2',title:'B',kind:'business',category:'creative',status:'published',imageUrls:[]}];
store.changed.set(null);store.session.set({userId:'work-member',select:()=>{}});let visible=cards.map(c=>popup.card(c));let selectionPatches=0;
popup.list={patchVisibleItem(predicate,patch){const i=visible.findIndex(predicate);if(i<0)return false;visible[i]=patch(visible[i]);selectionPatches++;return true;}};
store.selectedId.set('c1');flush();assert.equal(visible[0].mediaActions[0].selected,true);
store.selectedId.set('c2');flush();assert.equal(visible[0].mediaActions[0].selected,false);assert.equal(visible[1].mediaActions[0].selected,true);
assert.equal(visible[0].badge,null,'Published-only picker has no redundant status');assert.equal(visible[1].mediaActions[0].position,'top-right');assert.deepEqual(popup.cardMenu(cards[0]),[],'Picker has no three-dot menu');
assert.equal(selectionPatches,3);assert.equal(visible[1].mediaActions[0].id,'select');assert.equal(visible[1].mediaActions[0].selectedIcon,'check');
store.selectedId.set(null);store.session.set({userId:'work-member'});flush();
assert.ok(popup.model().headerControls.some(c=>c.id==='status'),'Campaign status is part of the header');
assert.equal(popup.model().toolbarControls,undefined);
assert.equal(visible[0].imageMenuPosition,'bottom-right');
assert.equal(visible[0].layout,'overlay');
assert.equal(visible[0].descriptionLines,2);
assert.equal(visible[0].statusChip.label,'campaign.kind.work');
console.log('PASS campaign/service single-selection basket, plus/check toggles, confirm/clear/cancel and bounded row patches without reload');
let staffLoads=0,staffPicker;
services.members={queryMembersByOwner:async()=>{staffLoads++;return [{userId:'anna',name:'Anna',status:'accepted'},{userId:'evan',name:'Evan',status:'accepted'}];}};
services.picker={ensureAssetMemberPickerPopupLoaded:async()=>{},openActivityInvitePopup:context=>staffPicker=context};
services.edit(null);await services.loadStaffMembers();assert.equal(services.staffMembers().length,2);
let appliedStaff;await services.chooseStaff(['anna'],ids=>appliedStaff=ids);
assert.equal(staffLoads,1,'The block and picker share one member load during the editor session');
assert.deepEqual(staffPicker.initialSelection.map(m=>m.userId),['anna']);staffPicker.onApply([]);assert.deepEqual(appliedStaff,[]);
services.closeEditor();assert.equal(services.staffMembers().length,0);
let resolveStaff;services.members={queryMembersByOwner:()=>new Promise(resolve=>resolveStaff=resolve)};
services.edit(null);services.closeEditor();resolveStaff([{userId:'old',status:'accepted'}]);await Promise.resolve();await Promise.resolve();
assert.equal(services.staffMembers().length,0,'Late staff results cannot repopulate a closed editor');
console.log('PASS service staff hydration, one shared block/picker load, persisted preselection, unassignment and close-race isolation');


// Local page totals must cover all visible rows, not just the currently loaded bucket/page.
const LocalCommunityCasesService=await compiledSymbol('LocalCommunityCasesService');
const LocalCommunityCasesRepository=await compiledSymbol('LocalCommunityCasesRepository');
const local=Object.create(LocalCommunityCasesService.prototype);
// Use the canonical contract, without scanning retained watch artifacts or copying a group ID.
const communityId=readFileSync(new URL('../src/app/shared/core/contracts/group-type.ts',import.meta.url),'utf8').match(/COMMUNITY_BASE_GROUP_ID = '([^']+)'/)?.[1];
assert.ok(communityId,'canonical community base id');
let records=Array.from({length:28},(_,i)=>({...exampleCase,id:'r'+i,baseGroupId:communityId,participantAccountIds:['work-member'],attentionAccountIds:['work-member'],recommendations:[],offers:[],status:i<21?'open':'completed',caseType:i%2?'fault':'maintenance'}));
records.push({...records[0],id:'invisible',participantAccountIds:['someone'],communityId:'other'});
records.push({...records[0],id:'wrong-base',baseGroupId:'other'});
Object.assign(local,{actor:async()=> 'work-member',repository:{cases:()=>records,findCase:id=>records.find(r=>r.id===id),saveCase:c=>{records=records.map(r=>r.id===c.id?c:r);return c;},flush:async()=>{}},
 access:{managedGroups:()=>new Set(),admin:()=>false},groups:{find:()=>({name:'Home'})},users:{queryUserById:()=>null}});
local.repository.visibleCases=LocalCommunityCasesRepository.prototype.visibleCases.bind(local.repository);
let page=await local.page('work-member',{pageSize:5,filters:{status:'active'}});
assert.equal(page.items.length,5);assert.equal(page.total,21);assert.equal(page.context.total,28);assert.equal(page.context['open:fault'],10);
page=await local.page('work-member',{pageSize:5,filters:{status:'completed',caseType:'fault'}});assert.equal(page.context.total,28);
await local.read('work-member','r1');page=await local.page('work-member',{pageSize:5,filters:{status:'active'}});
assert.equal(page.context.total,28);assert.equal(page.context['open:fault'],10);
console.log('PASS local case item counters across pagination/filtering/viewing and account/base-group isolation');
// Apply server responses through the real store so reads and status moves cannot
// silently turn the menu counters back into unread counts.
const CommunityCasesStore=await compiledSymbol('CommunityCasesStore');
const countStore=Object.create(CommunityCasesStore.prototype),menuCount=signal(1);
const countedCase={...exampleCase,id:'counted',status:'open',caseType:'fault',unread:true};
Object.assign(countStore,{known:new Map([[countedCase.id,countedCase]]),count:menuCount,
 counters:signal({total:1,'open:fault':1}),profile:{activeUserId:()=> 'work-member'},
 activity:{patchUserCounterOverrides:(_user,value)=>menuCount.set(value.cases)},
 board:signal(null),chatContext:signal(null),quotations:signal(null),changed:signal(null)});
countStore.publish({...countedCase,unread:false});
assert.equal(menuCount(),1);assert.equal(countStore.counters()['open:fault'],1);
countStore.publish({...countedCase,status:'cancelled',unread:false});
assert.equal(menuCount(),1);assert.equal(countStore.counters()['open:fault'],0);assert.equal(countStore.counters()['cancelled:fault'],1);
countStore.publish({...countedCase,status:'trash',unread:false});
assert.equal(menuCount(),0);assert.equal(countStore.counters().total,0);assert.equal(countStore.counters()['trash:fault'],1);
countStore.publish({...countedCase,status:'open',unread:false});
countStore.publish({...countedCase,id:'new-case',unread:false},true);
countStore.publish({...countedCase,id:'new-case',unread:false});
assert.equal(menuCount(),2);assert.equal(countStore.counters().total,2);assert.equal(countStore.counters()['open:fault'],2);
console.log('PASS case response patches preserve viewed counts and move/create/restore bucket and sidebar totals once');
const HttpUsersService=await compiledSymbol('HttpUsersService');
const httpUsers=Object.create(HttpUsersService.prototype);
assert.equal(httpUsers.buildInitialMenuCounterOverrides({activities:{cases:1}},{cases:2}).cases,2,'HTTP profile reload retains the server case count');
assert.equal(httpUsers.buildInitialMenuCounterOverrides({activities:{cases:1}},{cases:0}).cases,0,'An explicit server zero is authoritative');
assert.equal(httpUsers.buildInitialMenuCounterOverrides({activities:{cases:1}},null).cases,1);
const LocalUsersService=await compiledSymbol('LocalUsersService'),LocalAccess=await compiledSymbol('LocalCommunityAccessService');
for(const db of ['demo_db','e2e_db']){
 const readSeed=name=>JSON.parse(readFileSync(new URL('../../server/docker/conf/mongodb/'+db+'/'+name+'.json',import.meta.url),'utf8'));
 const id=value=>typeof value==='object'?value.$oid:value;
 const seedUsers=readSeed('users').map(u=>({...u,id:id(u._id)})),seedGroups=readSeed('communityGroups').map(g=>({...g,id:id(g._id)})),seedMembers=readSeed('activityMembers');
 const seedRepo=Object.create(LocalCommunityCasesRepository.prototype);seedRepo.cases=()=>readSeed('serviceCases').map(c=>({...c,id:id(c._id)}));
 const access=Object.create(LocalAccess.prototype);access.groups={records:()=>seedGroups};access.members={peekRecordsByOwner:o=>seedMembers.filter(m=>m.ownerType===o.ownerType&&m.ownerId===o.ownerId)};
 const users=Object.create(LocalUsersService.prototype);Object.assign(users,{usersRepository:{queryUserById:uid=>seedUsers.find(u=>u.id===uid)},communityGroups:{find:gid=>seedGroups.find(g=>g.id===gid)},communityAccess:access,communityCases:seedRepo});
 const alex=seedUsers.find(u=>u.name==='Alex Turner'&&u.workspaceGroupId===communityId);
 assert.ok(alex);assert.equal(users.buildInitialMenuCounterOverrides(alex).cases,2,db+' seeded profile has case badges before opening Cases');
 seedRepo.cases=()=>[];assert.equal(users.buildInitialMenuCounterOverrides(alex).cases,0,'Counts follow authoritative records, not seeded number literals');
}
console.log('PASS HTTP reload preserves case counts and canonical demo/e2e seed projections show badges before opening Cases');
let audienceLoads=0,memberPicker;
Object.assign(countStore,{generation:0,editor:signal(null),busy:signal(false),error:signal(''),session:signal({userId:'work-member'}),
 activeGroup:signal({groupId:'selected-group',role:'Admin'}),audienceMembers:signal([]),audienceLoading:signal(false),audienceRequest:null,
 members:{queryMembersByOwner:async query=>{audienceLoads++;assert.equal(query.ownerId,'selected-group');return [{userId:'one',name:'One',status:'accepted'},{userId:'two',name:'Two',status:'accepted'},{userId:'pending',status:'pending'}];}},
 picker:{ensureAssetMemberPickerPopupLoaded:async()=>{},openActivityInvitePopup:context=>memberPicker=context}});
await countStore.edit();await countStore.loadAudienceMembers('selected-group');assert.equal(countStore.audienceMembers().length,2);
let chosen;await countStore.chooseMembers('selected-group',['two'],ids=>chosen=ids);
assert.equal(audienceLoads,1,'The visible member block and picker reuse one roster request');
assert.deepEqual(memberPicker.initialSelection.map(m=>m.userId),['two']);memberPicker.onApply([]);assert.deepEqual(chosen,[]);
countStore.closeEditor();assert.equal(countStore.audienceMembers().length,0);
let late;countStore.members={queryMembersByOwner:()=>new Promise(resolve=>late=resolve)};
await countStore.edit();countStore.closeEditor();late([{userId:'stale',status:'accepted'}]);await Promise.resolve();await Promise.resolve();
assert.equal(countStore.audienceMembers().length,0,'A closed editor cannot receive a late roster');
countStore.showEditor({kind:'case',readOnly:true,value:{...exampleCase,audienceAccountIds:['two'],members:[{accountId:'two',name:'Two',status:'accepted'}]}});
assert.deepEqual(countStore.audienceMembers().map(m=>m.userId),['two'],'Read-only uses authorized case names without a private-group roster request');
console.log('PASS case audience hydration, shared picker preselection, clear and close-race isolation');
// Reuse the real members popup's snapshot path in both adapters. No owner HTTP lookup or polling.
const EventMembersPopupComponent=await compiledSymbol('EventMembersPopupComponent');
for(const localMode of [false,true]){
 const membersPopup=Object.create(EventMembersPopupComponent.prototype),snapshot=[{userId:'resident',status:'accepted',role:'Member'}];
 Object.assign(membersPopup,{membersCacheByOwnerId:new Map(),pendingInitialMembersDelayOwnerIds:new Set(),
   membersListPollScheduler:{stop(){}},explanationGuide:{registerContext:()=>()=>{}},cdr:{markForCheck(){}},
   resetSummaryState(){},applySummaryFromMembers(){},activityMembersService:{usesLocalDataSource:()=>localMode},
   usersService:{warmCachedUsers(){throw Error('snapshot must not warm profiles');}},runtimeStore:{isDataSourceAvailable:()=>true},
   resolveOwnerPresentation(){throw Error('snapshot must not fetch an event owner');}});
 membersPopup.openMembersPopup('case-snapshot',{snapshotOnly:true,canManage:true,subtitle:'Inspection',initialMembers:snapshot});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(membersPopup.ownerRef,null);assert.equal(membersPopup.canManageMembers,false);assert.equal(membersPopup.canShowInviteButton,false);
 membersPopup.membersListReady=true;assert.equal(membersPopup.shouldPollMembersList(),false);
 assert.deepEqual((await membersPopup.loadMembersPage({pageSize:20,filters:{ownerId:'case-snapshot'}})).items,snapshot);
 assert.deepEqual((await membersPopup.loadMembersPage({pageSize:20,filters:{ownerId:'case-snapshot',pendingOnly:true}})).items,[]);
}
console.log('PASS shared read-only case member list uses authorized snapshot in local and HTTP modes without event lookups/polling');
const paymentModule=await load(latest('payment-methods-popup.component-'));
const CashReceiptPopupComponent=paymentModule.PaymentMethodsPopupComponent.ɵcmp.dependencies.find(c=>c.name.replace(/^_/,'')==='CashReceiptPopupComponent');
assert.ok(CashReceiptPopupComponent);
const receipt=runInInjectionContext(domainInjector,()=>new CashReceiptPopupComponent());
assert.strictEqual(receipt.formModel(),receipt.formModel());assert.strictEqual(receipt.popupModel(),receipt.popupModel());
assert.equal(receipt.popupModel().headerControls[0].items[0].disabled,true);
receipt.form.update(form=>({...form,method:'bank-transfer',amount:12,payerUserId:'payer'}));
const method=receipt.formModel().steps[0].controls[0].config;
assert.equal(method.trigger.palette,'blue');assert.equal(method.items.find(i=>i.id==='cash').palette,'green');
assert.ok(method.items.every(i=>i.icon&&i.surface==='tinted'));assert.equal(receipt.popupModel().headerControls[0].items[0].disabled,false);
assert.strictEqual(receipt.formModel(),receipt.formModel());
console.log('PASS manual receipt has stable signal models and contextual cash/transfer controls');
const LocalDeploymentConfigurationService=await compiledSymbol('LocalDeploymentConfigurationService');
const deployment=Object.create(LocalDeploymentConfigurationService.prototype);
const LocalOperatorRegistryRepository=await compiledSymbol('LocalOperatorRegistryRepository');
const publicRepository=Object.create(LocalOperatorRegistryRepository.prototype);
Object.assign(publicRepository,{hydrated:true,cachedRecord:null});
Object.assign(deployment,{repository:publicRepository,routeDelay:{waitForRouteDelay:async()=>{}}});
const initialPublicConfig=await deployment.loadBranding();
assert.deepEqual(initialPublicConfig.socialLinks.map(l=>l.provider),['instagram','youtube','facebook']);
assert.equal(await publicRepository.read(),null,'Public catalog does not manufacture an operator record');
const SeedOperatorRegistryBuilder=await compiledSymbol('SeedOperatorRegistryBuilder');
const seededConfiguration=SeedOperatorRegistryBuilder.buildInitialRecord();
publicRepository.cachedRecord=seededConfiguration;
const publicConfig=await deployment.loadBranding();
assert.deepEqual(publicConfig,initialPublicConfig,'Operator seed and public catalog share one configuration source');
seededConfiguration.configuration.socialLinks=[];
assert.deepEqual((await deployment.loadBranding()).socialLinks,[],'The reader preserves an explicitly empty saved list');
console.log('PASS public local landing reads its small catalog without demo bootstrap and preserves saved configuration');
const WorkHomeComponent=await compiledSymbol('WorkHomeComponent'),CommunityServicesHomeComponent=await compiledSymbol('CommunityServicesHomeComponent');
const SmartListComponent=await compiledSymbol('SmartListComponent');
for(const Home of [WorkHomeComponent,CommunityServicesHomeComponent]){
 const home=runInInjectionContext(domainInjector,()=>new Home());
 assert.equal(home.config.pageSize,10);assert.equal(home.config.mobilePageSizeCap,null);assert.equal(home.config.showBackgroundLoadingProgress,true);
 assert.ok(home.config.emptyLabel);assert.ok(home.config.emptyDescription);
 const list=Object.create(SmartListComponent.prototype);Object.assign(list,{config:home.config,cursorItem:()=>null,currentQuery:()=>({}),retainsFullscreenView:()=>false});
 assert.equal(list.shouldRenderPaginationRatingBar(),false,'empty '+Home.name+' uses shared empty state without a rating dock');
 if(Home===WorkHomeComponent){
  home.i18n=i18n;
  home.store={filters:signal({kind:'both',category:null}),page:async()=>({items:[{id:'ad',title:'Ad',description:'Details',kind:'work',category:'creative',imageUrls:[],ownerUserId:'organizer'}]})};
  home.profile={activeUserProfile:()=>null};
  assert.deepEqual(home.headerItems().map(item=>item.id),['kind','category','rates']);
  assert.equal(home.config.menuItems,undefined);
  const page=await new Promise((resolve,reject)=>home.loadPage({}).subscribe({next:resolve,error:reject}));
  assert.equal(page.items[0].contextBadge.label,'campaign.category.creative','Home retains its category badge');
  assert.equal(page.items[0].badge,undefined,'Home has no status badge');
  assert.equal(page.items[0].descriptionLines,2);
  let opened;home.campaigns={edit:(...args)=>opened=args};home.openDetails(page.items[0].eagerDetail);
  assert.deepEqual(opened,[page.items[0].eagerDetail,true],'Eye opens campaign details read-only');
 }
 if(Home===CommunityServicesHomeComponent){
  assert.deepEqual(home.items().map(item=>item.id),['category','rates']);
  assert.equal(home.config.menuItems,undefined,'Service photo card has no three-dot menu');
  let openedProfile;home.profiles={openProfileView:options=>openedProfile=options};
  home.openProfile('provider');assert.deepEqual(openedProfile,{userId:'provider'});

 }
 home.ngOnDestroy?.();
}
flush();
console.log('PASS Work/Community Home use shared pagination/loading configuration and suppress rating controls for empty data');
console.log('PASS Community Home exposes only category/Ratings and uses the existing profile eye action without a three-dot menu');
const HomeComponent=await compiledSymbol('HomeComponent');
const homeHeaderReady=Object.getOwnPropertyDescriptor(HomeComponent.prototype,'homeHeaderControlsReady').get;
const readyState={isAccountReactivationPending:false,memberActionsAvailable:true,isAvatarProfileSettled:true,isBlockedUser:false,isGameVisibilityPaused:false,homeSmartListQueryReady:true};
assert.equal(homeHeaderReady.call(readyState),true);
for(const key of ['memberActionsAvailable','isAvatarProfileSettled','homeSmartListQueryReady'])assert.equal(homeHeaderReady.call({...readyState,[key]:false}),false,key+' must settle before Home actions appear');
for(const key of ['isAccountReactivationPending','isBlockedUser','isGameVisibilityPaused'])assert.equal(homeHeaderReady.call({...readyState,[key]:true}),false,key+' suppresses Home actions');
console.log('PASS Home actions wait for the active profile and existing query readiness');
const menu=Object.create(AppMenuComponent.prototype);
menu.kind='inline';
const modeItem={id:'mode',kind:'select-trigger',layout:'pill',compactOnMobile:true,label:'group.type.work',icon:'work'};
menu.isMobileViewport=true;
assert.equal(menu.isLabeledActionRowItem(modeItem),false,'compact mobile selector must hide label and caret');
assert.equal(menu.isLabeledActionRowItem({...modeItem,compactOnMobile:false}),true,'ordinary selectors keep their label');
menu.isMobileViewport=false;
assert.equal(menu.isLabeledActionRowItem(modeItem),true,'desktop selector keeps its label');
console.log('PASS compact selector respects mobile setting and preserves desktop/ordinary labels');

const GroupWorkspaceStore=await compiledSymbol('GroupWorkspaceStore');
const UiPollCoordinator=await compiledSymbol('UiPollCoordinator');
const popupVisible=signal(true);
const context={accountUserId:signal(''),active:signal(null),switching:signal(false),revision:signal(0)};
const adminProfile={id:'admin-demo-noel',admin:true,activities:{}};
const workspaceRows=['myscoutee-work','myscoutee-community'].map(groupId=>({groupId,profileId:`group:${groupId}:${adminProfile.id}`,
  name:groupId,role:'Admin',membershipStatus:'accepted',activity:0,policy:{workspace:true}}));
let workspaceReads=0, coordinator;
const workspaceProviders={
 GroupWorkspaceContextService:context,
 CommunityGroupsService:{async workspaces(){workspaceReads++;return workspaceRows;}},
 UsersService:{},AdminWorkspaceStore:{},AdminWorkspaceDataService:{},AdminMenuStore:{},
 UserProfileStore:{activeUserId:signal(adminProfile.id),activeUserProfile:signal(adminProfile),getUserProfile:()=>adminProfile,getUserImpressionChangeFlags:()=>({})},
 ActivityStore:{getUserCounterOverrides:()=>({})},
 SessionService:{session:signal({kind:'demo',userId:adminProfile.id}),activeUserId:signal(adminProfile.id)},
 ContentModerationStore:{clear(){},attention:(_id,pending,revision)=>({pending,revision}),forScope:()=>null},
 CommunityGroupChangesStore:{revision:signal(0),change:signal(null),attentionDelta:signal(null)},
 PopupPresenceStore:{visible:popupVisible}
};
const workspaceInjector={get(token,fallback){
 const name=(token.name??'').replace(/^_/,'');
 if(token===core.Injector)return workspaceInjector;
 if(name==='UiPollCoordinator')return coordinator;
 if(workspaceProviders[name])return workspaceProviders[name];
 return injector.get(token,fallback);
}};
coordinator=runInInjectionContext(workspaceInjector,()=>new UiPollCoordinator());
const workspaces=runInInjectionContext(workspaceInjector,()=>new GroupWorkspaceStore());
flush();
// Let an immediate scheduler tick execute as well: the old background-only
// implementation silently skipped this request while the login popup was open.
await new Promise(resolve=>setTimeout(resolve,0));flush();
assert.equal(workspaceReads,1,'initial workspace read must run despite an open login popup');
assert.deepEqual(workspaces.menuItems('main').map(item=>item.id),['main',...workspaceRows.map(row=>row.groupId)]);
assert.equal(workspaces.menuItems('main')[0].label,'group.type.dating');
let backgroundReads=0;await coordinator.run('background',()=>{backgroundReads++;});
assert.equal(backgroundReads,0,'ordinary background polls remain paused while a popup is open');
console.log('PASS admin base-group selector loads immediately during login; background polling stays paused');

// The actual shared picker must rehydrate assigned members, including off-page selection.
const Picker=await compiled.symbol('AssetMemberPickerPopupComponent');
const member=id=>({id,userId:id,name:id,initials:id,avatarUrl:'',status:'accepted',role:'Member',gender:'man',city:'',metAtIso:'',actionAtIso:'',metWhere:''});
const a=member('assigned-a'),b=member('assigned-b'),c=member('candidate-c');
const pickerContext=signal(null),applied=[];
const pickerProviders={ChangeDetectorRef:{markForCheck(){}},UserProfileStore:{activeUserId:()=> 'actor'},AppRuntimeStore:{},
 ActivityInvitePopupStore:{activityInvitePopup:pickerContext,closeActivityInvitePopup(){pickerContext.set(null);}},
 ActivityInviteCandidatesService:{queryCandidatesByOwner:async()=>({items:[c],total:1})},
 ActivityMembersService:{peekMembersByOwner:()=>[],peekSummaryByOwner:()=>null,queryMembersByOwner:async()=>[]},
 DialogStore:{},AssetPopupStore:{},AssetStore:{},ProfileStore:{}};
const pickerInjector={get(token,fallback){const name=(token.name??'').replace(/^_/,'');if(token===core.Injector)return pickerInjector;return pickerProviders[name]??injector.get(token,fallback);}};
const picker=runInInjectionContext(pickerInjector,()=>new Picker());flush();
for(const local of [true,false]){
 pickerContext.set({ownerId:'case',ownerType:'community',purpose:local?undefined:'payment',initialSelection:[a,b],...(local?{initialCandidates:[a,b,c]}:{}),onApply:selection=>applied.push(selection)});flush();
 await picker.loadInviteCandidatesPage({page:0,pageSize:1,filters:{ownerId:'case',sort:'recent'}});
 assert.deepEqual(picker.selectedInviteChips().map(m=>m.userId),[a.userId,b.userId]);assert.equal(picker.canConfirmSelection(),false);
 picker.toggleInviteCandidate(a.userId);picker.toggleInviteCandidate(b.userId);
 assert.equal(picker.canConfirmSelection(),true,'Clearing all persisted assignments enables the header tick');
 await picker.confirmSelection();assert.deepEqual(applied.at(-1),[],'Header tick persists unassignment');flush();
}
console.log('PASS shared picker reload preselection, off-page basket and empty unassignment for local and server candidates');
pickerContext.set({ownerId:'case',ownerType:'community',allowSelectAll:true,initialCandidates:[a,b,c],initialSelection:[],onApply:selection=>applied.push(selection)});flush();
await picker.loadInviteCandidatesPage({page:0,pageSize:1,filters:{ownerId:'case',sort:'recent'}});
const allAction=()=>picker.invitePopupModel().headerControls[0].items.find(i=>i.id==='invite-all');
assert.equal(allAction().label,'all');assert.equal(allAction().layout,'pill');assert.equal(allAction().kind,'toggle');assert.equal(allAction().showToggleIndicator,true);assert.equal(allAction().checked,false);
picker.onInviteMenuSelect({context:{menu:'select-all'}});assert.equal(allAction().checked,true);assert.deepEqual(picker.selectedInviteChips().map(m=>m.userId),[a.userId,b.userId,c.userId],'Header All includes off-page candidates');
picker.toggleInviteCandidate(b.userId);assert.equal(allAction().checked,false,'Individual deselection is reflected by the All switch');
picker.onInviteMenuSelect({context:{menu:'select-all'}});await picker.confirmSelection();flush();assert.equal(applied.at(-1).length,3);
pickerContext.set({ownerId:'case',ownerType:'community',allowSelectAll:true,initialCandidates:[a,b,c],initialSelection:[a,b,c],onApply:selection=>applied.push(selection)});flush();
picker.onInviteMenuSelect({context:{menu:'select-all'}});assert.equal(picker.selectedInviteCount(),0);await picker.confirmSelection();flush();assert.deepEqual(applied.at(-1),[]);
pickerContext.set({ownerId:'case',ownerType:'community',initialCandidates:[a,b,c],initialSelection:[]});flush();assert.equal(allAction(),undefined,'Other callers retain the existing picker header');
console.log('PASS labeled All switch in the existing member picker header, off-page selection, individual changes, confirmation and clear');
const Quotations=CommunityCasesPopupComponent.ɵcmp.dependencies.find(C=>C.name?.replace(/^_/,'')==='CommunityCaseQuotationsComponent');
const quote={id:'q1',providerAccountId:'provider',amount:360,currency:'EUR',note:'Meters',workPolicy:'Start after agreement',refundPolicy:'No advance',status:'pending'};
const quoteCalls=[];Object.assign(caseStore,{quotations:signal({...exampleCase,canManage:false,offers:[quote]}),openChat:(...args)=>quoteCalls.push(args)});
const quotations=runInInjectionContext(injector,()=>new Quotations());flush();
assert.deepEqual(quotations.menu(quote).map(m=>m.id),['view','chat']);
quotations.action({id:'chat',context:quote});assert.equal(quoteCalls[0][1],'q1','Quotation action targets its own group');
quotations.action({id:'view',context:quote});flush();
assert.deepEqual(quotations.editorModel().headerControls,[]);assert.ok(quotations.flow().steps.every(step=>step.controls.every(c=>c.disabled)));
assert.equal(quotations.offer().workPolicies[0].description,quote.workPolicy);assert.equal(quotations.offer().refundPolicies[0].description,quote.refundPolicy);
assert.equal(quotations.rows()[0].badges[0].position,'top-right');assert.ok(quotations.rows()[0].menuActions.includes('chat'));
assert.equal(quotations.flow().steps.find(s=>s.id==='work-policies').controls[0].kind,'policies');
assert.ok(!quotations.flow().steps.find(s=>s.id==='work-policies').controls[0].config.model.showReadOnlyPopup,'Full inline quotation terms use the shared read-only policy presentation');
assert.ok(!quotations.flow().steps.flatMap(s=>s.controls).some(c=>c.kind==='date'));
caseStore.quotations.update(c=>({...c,canManage:true}));assert.ok(quotations.menu(quote).some(m=>m.id==='accept-offer'));
caseStore.quotations.update(c=>({...c,canManage:false,canReviewOffers:false,offers:[],support:[{accountId:'work-member',status:'accepted'}]}));
assert.equal(quotations.model().toolbarControls.find(c=>c.id==='offer').icon,'add');assert.equal(quotations.rows().length,0);
console.log('PASS standard quotation form blocks, read-only member view, manager decisions, provider add and quotation group chat routing');
let patchedCase;casesPopup.list={patchVisibleItem(_predicate,patch){patchedCase=patch({id:exampleCase.id});return true;}};
caseStore.changed.set({...exampleCase,boardTasks:[{id:'one'},{id:'two'}]});flush();assert.equal(patchedCase.menuBadgeCount,2,'Live signal update patches existing case card');
assert.equal(casesPopup.card({...exampleCase,boardTasks:[{id:'one'},{id:'two'}]}).menuBadgeCount,2);
assert.equal(casesPopup.menu({...exampleCase,boardTasks:[{id:'one'},{id:'two'}]}).find(m=>m.id==='view').counter.value,2);
assert.equal(casesPopup.card({...exampleCase,boardTasks:[],unread:true}).menuBadgeCount,0,'Unread state never replaces task count');
console.log('PASS task-only case counters through the existing signal-driven SmartList patch');

const Board=CommunityCasesPopupComponent.ɵcmp.dependencies.find(C=>C.name?.replace(/^_/,'')==='CommunityCaseBoardComponent');
const boardTask={id:'task',title:'Task',description:'Details',status:'todo',assigneeAccountIds:[],dependsOnIds:[],startAtIso:null,endAtIso:null};
Object.assign(caseStore,{board:signal({...exampleCase,offers:[],boardTasks:[boardTask]}),command:async(_c,command)=>quoteCalls.push(command)});
const board=runInInjectionContext(injector,()=>new Board());board.task.set(boardTask);flush();
const taskFields=board.taskFlow().steps.flatMap(step=>step.controls);
assert.deepEqual(board.taskFlow().steps.map(step=>step.id),['members','task','date','offers','dependencies'],'Task details/dates and quotations precede dependencies');
assert.equal(taskFields.some(c=>c.id==='status'),false);assert.equal(taskFields.find(c=>c.id==='date-range').config.model.mode,'range');
assert.equal(board.editorModel().toolbarControls,undefined);
for(const id of ['members','dependencies','offers']){
 const block=board.taskFlow().steps.find(step=>step.id===id);assert.ok(block,id+' has its own visible block');
 assert.equal(block.headerControl.config.items[0].icon,'add');
}
caseStore.board.update(c=>({...c,members:[{accountId:'evan',name:'Evan Reed',city:'Berlin'}],boardTasks:[boardTask,{...boardTask,id:'preceding',title:'Collect meter details'}]}));
board.task.set({...boardTask,assigneeAccountIds:['evan'],dependsOnIds:['preceding']});
assert.equal(board.taskFlow().steps.find(s=>s.id==='members').controls[0].config.items[0].label,'Evan Reed');
assert.equal(board.taskFlow().steps.find(s=>s.id==='members').controls[0].config.items[0].trailingIcon,'chevron_right');
assert.equal(board.taskFlow().steps.find(s=>s.id==='dependencies').controls[0].config.rows[0].label,'Collect meter details');
const assignedOffers=[{...quote,id:'part-a',status:'accepted',amount:360},{...quote,id:'part-b',status:'accepted',amount:80}];
caseStore.board.update(c=>({...c,offers:[...assignedOffers,{...quote,id:'pending',status:'pending'}],boardTasks:[{...boardTask,offerIds:['part-a','part-b']}]}));
board.task.set({...boardTask,offerIds:['part-a','part-b']});
assert.equal(board.rows()[0].price,'440 EUR','Task price aggregates assigned subactivities');
assert.deepEqual(board.offerRows().map(o=>o.id),['part-a','part-b'],'Only accepted offers can be assigned');
let offerBlock=board.taskFlow().steps.find(s=>s.id==='offers').controls[0];
assert.equal(offerBlock.kind,'text-cards');assert.equal(offerBlock.config.columns,3);
assert.equal(offerBlock.config.items[0].detail,quote.note);assert.equal(offerBlock.config.items[0].price,'360 EUR');
assert.deepEqual(offerBlock.config.items[0].menuItems.map(m=>m.id),['view','remove']);
board.taskFormAction({control:offerBlock,sourceEvent:{id:'remove'},context:'part-a'});
assert.deepEqual(board.task().offerIds,['part-b'],'Remove changes the draft assignment only');
assert.equal(caseStore.board().offers.length,3,'Detaching an offer does not delete it');
caseStore.board.update(c=>({...c,canManage:false}));
offerBlock=board.taskFlow().steps.find(s=>s.id==='offers').controls[0];
assert.deepEqual(offerBlock.config.items[0].menuItems.map(m=>m.id),['view']);
board.taskFormAction({control:offerBlock,sourceEvent:{id:'remove'},context:'part-b'});assert.deepEqual(board.task().offerIds,['part-b']);
caseStore.board.update(c=>({...c,canManage:true}));
console.log('PASS accepted quotation subactivity cards, three-column config, admin-only detach and aggregate task price');
board.taskFormChanged({...board.taskForm(),dateRange:{startAt:'2026-10-08T08:00:00.000Z',endAt:'2026-10-08T09:00:00.000Z',precision:'minute'}});
assert.equal(board.task().startAtIso,'2026-10-08T08:00:00.000Z');
board.taskFormChanged({...board.taskForm(),dateRange:{startAt:'2026-10-08T10:00',endAt:'2026-10-08T11:00',precision:'minute'}});
assert.equal(board.task().startAtIso,new Date('2026-10-08T10:00').toISOString(),'Local shared DateInput value is converted to an absolute API timestamp');assert.equal(board.task().status,'todo');
for(const [status,next] of [['todo','in-progress'],['in-progress','done'],['done','todo']]){
 const task={...boardTask,status};caseStore.board.update(c=>({...c,boardTasks:[task]}));
 const action=board.rows()[0].menu.find(m=>m.id==='task-progress');assert.ok(action);board.taskAction(action);
 assert.equal(quoteCalls.at(-1).task.status,next);
}
caseStore.board.update(c=>({...c,boardTasks:[{...boardTask,status:'deleted'}]}));
assert.equal(board.rows()[0].tone,'danger');assert.equal(board.rows()[0].icon,'delete');
assert.equal(board.rows()[0].menu.some(m=>m.id==='task-delete'),false);
let doneRows;board.columns[2].load({pageSize:10}).subscribe(page=>doneRows=page.items);assert.equal(doneRows[0].task.status,'deleted');
caseStore.board.update(c=>({...c,status:'completed',boardTasks:[{...boardTask,status:'done'}]}));
assert.ok(board.rows()[0].menu.some(m=>m.id==='task-delete'),'Completed case still exposes task deletion to manager');
caseStore.board.update(c=>({...c,status:'open',canManage:false,membershipStatus:'accepted'}));
assert.deepEqual(board.model().headerControls,[],'Members have no add-task action');
assert.deepEqual(board.rows()[0].menu.map(m=>m.id),['task-view','task-members']);
assert.equal(board.rows()[0].menu[0].label,'view');
assert.deepEqual(board.editorModel().headerControls,[]);
for(const step of board.taskFlow().steps){assert.ok(!step.headerControl);for(const control of step.controls.filter(c=>c.bind))assert.equal(control.disabled,true);}
const commandsBefore=quoteCalls.length;
board.taskAction({id:'task-progress',context:boardTask});board.taskAction({id:'task-delete',context:boardTask});board.editorModel().onAction();
assert.equal(quoteCalls.length,commandsBefore,'Hidden mutation actions cannot be invoked through stale handlers');
store.error.set('case.save.failed');
assert.equal(board.editorModel().errorMessage,'case.save.failed');
assert.equal(board.model().errorMessage,null,'Error belongs to the active editor');
console.log('PASS member read-only board, hidden task mutations and active-popup error routing');
console.log('PASS shared task date range, visible assignment/dependency blocks, lifecycle and deleted tasks in Done with the danger palette');
for(const fn of destroy.reverse())fn();home();flush();
