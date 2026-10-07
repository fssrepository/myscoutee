import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compiledDevModules } from './compiled-dev-modules.mjs';
// Import the running watcher's output; do not compile or open a browser.
// node --max-old-space-size=192 scripts/check-main-groups-runtime.mjs <dev-output>
const compiled=compiledDevModules(process.argv[2]), compiledSymbol=compiled.symbol;
const [signal,runInInjectionContext,Injector,DestroyRef]=await Promise.all(
 ['signal','runInInjectionContext','Injector','DestroyRef'].map(compiledSymbol));
const core={Injector,DestroyRef},pending=new Set(),destroy=[];
const scheduler={add:n=>pending.add(n),schedule:n=>pending.add(n),remove:n=>pending.delete(n)};
function flush(){let count=0;while(pending.size){assert.ok(++count<=50,'Effects must settle');
 const n=pending.values().next().value;pending.delete(n);n.run();}}
const injector={get(token,fallback){
 const name=(token.name??'').replace(/^_/,'');
 if(token===Injector)return injector;
 if(token===DestroyRef)return {onDestroy(fn){destroy.push(fn);return()=>{}}};
 if(name==='ViewContext')return null;
 if(name==='ChangeDetectionScheduler')return {notify(){}};
 if(name==='EffectScheduler')return scheduler;
 if(fallback!==undefined)return fallback;
 throw Error('Missing provider '+name);
}};
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
// Header, menu and notification scope reuse the landing's canonical main-group
// identity. Private groups keep their own name/initials/palette and counters.
const baseAppearance = [
  ['main', null, 'group.type.dating', 'favorite', 'rose'],
  ['myscoutee-work', workspaceRows[0], 'group.type.work', 'work', 'blue'],
  ['myscoutee-community', workspaceRows[1], 'group.type.community', 'diversity_3', 'green']
];
for (const admin of [true, false]) {
  workspaceProviders.UserProfileStore.activeUserProfile.set({ ...adminProfile, admin });
  for (const [id, workspace, label, icon, palette] of baseAppearance) {
    context.active.set(workspace);
    assert.deepEqual(workspaces.trigger(context.active()), { label, icon, palette });
    const item = workspaces.menuItems(id).find(item => item.id === id);
    assert.equal(item.label, label); assert.equal(item.icon, icon); assert.equal(item.palette, palette);
    assert.equal(item.imageFallback, undefined); assert.equal(item.checked, true);
    assert.equal(item.layout, undefined, 'Shared appearance must not change the menu row layout');
    assert.equal(workspaces.menuItems(id, true).find(item => item.id === id).counter, null);
  }
}
const privateWorkspace = { ...workspaceRows[0], groupId: 'private-design', name: 'Design Team', groupType: 'work', activity: 3 };
workspaceRows.push(privateWorkspace); await workspaces.refresh();
context.active.set(privateWorkspace);
const privateTrigger = workspaces.trigger(context.active());
assert.equal(privateTrigger.label, 'Design Team'); assert.equal(privateTrigger.imageFallback, 'DT');
assert.equal(privateTrigger.icon, ''); assert.equal(privateTrigger.palette, workspaces.palette(privateWorkspace.groupId));
assert.equal(workspaces.menuItems(privateWorkspace.groupId).find(item => item.id === privateWorkspace.groupId).counter, 3);
workspaceProviders.UserProfileStore.activeUserProfile.set(adminProfile); context.active.set(null);
assert.ok(!workspaces.menuItems('main').some(item => item.id === privateWorkspace.groupId), 'Admin visibility stays base-group-only');
workspaceRows.pop(); await workspaces.refresh();
console.log('PASS member/admin main-group names/icons/colors match landing; private group identity, counters and visibility retained');
for(const fn of destroy)fn();
console.log('PASS workspace effects cleaned up');

const [Groups,SideMenu,Converter,SmartList]=await Promise.all([
 'LocalCommunityGroupsService','SideMenuComponent','CommunityGroupConverter','SmartListComponent'
].map(compiledSymbol));
const Popup=SideMenu.ɵcmp.dependencies.find(c=>c.name.replace(/^_/,'')==='CommunityGroupsPopupComponent');
const group=(id,index)=>({id,name:`Private ${index}`,ownerUserId:'owner',ownerName:'Owner',ownerAvatarUrl:null,
 description:'',imageUrl:null,category:'work',visibility:'public',hideMembers:false,policy:{workspace:true},
 createdAtIso:'2026-01-01T00:00:00.000Z',updatedAtIso:`2026-10-${String(index+1).padStart(2,'0')}T00:00:00.000Z`,
 version:0,role:'Member',membershipStatus:'accepted',requestKind:null,organizerOnly:false,
 acceptedMembers:2,pendingMembers:0,activity:0,distanceKm:index,groupType:'work'});
// Main groups would sort LAST by both ordinary keys; inserting them at the end
// of storage makes a page-local promotion fail even on the first request.
let rows=[...Array.from({length:23},(_,i)=>group(`private-${String(i).padStart(2,'0')}`,i)),
 {...group('myscoutee-work',24),updatedAtIso:'2025-01-01T00:00:00.000Z'},
 {...group('myscoutee-community',25),updatedAtIso:'2025-02-01T00:00:00.000Z',category:'friends',groupType:'community'}];
const service=Object.create(Groups.prototype);
Object.assign(service,{waitForRouteDelay:async()=>{},groups:{ready:async()=>{},records:()=>rows},
 members:{peekRecordsByOwner:()=>[]},member:id=>rows.find(r=>r.id===id)?.membershipStatus?{role:'Member',status:'accepted'}:undefined,
 dto:(_actor,row)=>({...row}),workspaces:async()=>[]});
const ownDestroy=[];
const popupProviders={CommunityGroupsStore:{initialBucket:signal('participation'),changed:signal(null),attentionDelta:signal(null),openUserId:()=> 'actor'},
 ProfileStore:{},I18nService:{translate:k=>k},ContentModerationStore:{groupSnapshots:signal({}),attention:(_id,pending,revision)=>({pending,revision})},
 ExplanationGuideService:{registerContext:()=>()=>{}}};
const popupInjector={get(token,fallback){
 if(token===Injector)return popupInjector;
 if(token===DestroyRef)return {onDestroy(fn){ownDestroy.push(fn);return()=>{}}};
 return popupProviders[(token.name??'').replace(/^_/,'')]??injector.get(token,fallback);
}};
const popup=runInInjectionContext(popupInjector,()=>new Popup());
flush();
const mainIds=new Set(['myscoutee-work','myscoutee-community']);
for(const sort of ['distance','updated']){
 const expectedMain=sort==='distance'?['myscoutee-work','myscoutee-community']:['myscoutee-community','myscoutee-work'];
 const expectedPrivate=Array.from({length:23},(_,i)=>`private-${String(i).padStart(2,'0')}`);
 if(sort==='updated')expectedPrivate.reverse();
 const expected=[...expectedMain,...expectedPrivate];
 for(const pageSize of [1,2,10,20]){
  let cursor=null,seen=[],pages=0;
  do{
   const page=await service.page('actor',{page:pages++,pageSize,cursor,filters:{bucket:'participation'},sort});
   assert.equal(page.total,25);seen.push(...page.items.map(r=>r.id));cursor=page.nextCursor;
   assert.ok(pages<=25,'Pagination terminates');
  }while(cursor);
  assert.deepEqual(seen,expected,`${sort}, pageSize ${pageSize}: main groups appear once across the entire list`);
  assert.equal(new Set(seen).size,25);
 }
 const query={page:0,pageSize:10,filters:{bucket:'participation'},sort};
 const first=await service.page('actor',query);
 const knownItems=first.items.map(r=>({id:r.id,revision:JSON.stringify(r)}));
 const request={bucket:'participation',sort,limit:10,knownItems,tailId:first.items.at(-1).id};
 assert.deepEqual((await service.sync('actor',request)).upserts,[],'Unchanged delta is empty');
 const changed=rows.find(r=>r.id==='private-00'),previous=changed.updatedAtIso;
 changed.activity=1;changed.updatedAtIso='2027-01-01T00:00:00.000Z';
 const delta=await service.sync('actor',request);
 const loaded=new Map(first.items.map(r=>[r.id,r]));for(const row of delta.upserts)loaded.set(row.id,row);
 const list=Object.create(SmartList.prototype);
 Object.assign(list,{config:popup.config,currentQuery:()=>query});
 const cards=list.orderSortableItems([...loaded.values()].map(r=>popup.card(r,sort)));
 assert.deepEqual(cards.slice(0,2).map(r=>r.id),expectedMain,'Delta local sorting keeps main groups first');
 assert.equal(new Set(cards.map(r=>r.id)).size,cards.length);
 changed.activity=0;changed.updatedAtIso=previous;
}
for(const row of rows)row.membershipStatus=null;
const explore=await service.page('actor',{page:0,pageSize:2,filters:{bucket:'explore'}});
assert.ok(explore.items.every(r=>mainIds.has(r.id)),'Explore default distance sort also promotes main groups');
const filtered=await service.page('actor',{page:0,pageSize:2,filters:{bucket:'explore',category:'work'}});
assert.equal(filtered.total,24);assert.equal(filtered.items[0].id,'myscoutee-work');
assert.ok(filtered.items.every(r=>r.id!=='myscoutee-community'),'Category filter still controls eligibility');
for(const lang of ['en','hu']){
 const bundle=JSON.parse(readFileSync(new URL(`../src/assets/i18n/${lang}.json`,import.meta.url)));
 const translate=key=>{assert.ok(bundle.messages[key],`Missing ${lang} message ${key}`);return bundle.messages[key];};
 for(const [id,type,icon,palette,hue] of [['myscoutee-work','work','work','blue',215],['myscoutee-community','community','diversity_3','green',140]]){
  const card=Converter.card(rows.find(r=>r.id===id),translate);
  assert.equal(card.title,translate(`group.type.${type}`));assert.deepEqual(card.leadingIcon,{icon,palette});
  assert.equal(card.accentHue,hue);assert.equal(card.metaRows[0],translate('groups.base'));assert.equal(card.groupLabel,translate('groups.base'));
 }
 const ordinary=Converter.card(rows[0],translate);
 assert.equal(ordinary.title,rows[0].name);assert.equal(ordinary.metaRows[0],translate('groups.category.work'));
}
for(const fn of ownDestroy)fn();
console.log('PASS 25 mixed groups: global priority before paging (1/2/10/20), no repeats/gaps, both sorts, live delta ordering, filters, EN/HU main-group cards and unchanged private labels');
