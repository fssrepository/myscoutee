import assert from 'node:assert/strict';
import { compiledDevModules } from './compiled-dev-modules.mjs';
const compiled=compiledDevModules(process.argv[2]);
const Service=await compiled.symbol('LocalCommunityCasesService');
const records=new Map(),notifications=[];
const names=['admin','resident','provider','other'];
const people=new Map(names.flatMap(id=>[[id,{id,name:id,images:[],gender:'man',city:'London'}],[`group:myscoutee-community:${id}`,{id:`group:myscoutee-community:${id}`,name:id}]]));
const service=Object.create(Service.prototype);
Object.assign(service,{feedback:{request(){},wake(){}},actor:async id=>id,
 repository:{ready:async()=>{},findCase:id=>records.get(id),cases:()=>[...records.values()],saveCase:(row,version)=>{if(records.has(row.id))assert.equal(records.get(row.id).version,version);records.set(row.id,structuredClone(row));return row;},flush:async()=>{}},
 access:{admin:(_group,id)=>id==='admin',requireMember:(_group,id)=>{assert.ok(['admin','resident'].includes(id));},requireBaseMember:id=>assert.ok(names.includes(id)),audience:(_group,all,ids)=>all?['admin','resident']:ids,roster:()=>[{userId:'admin',role:'Admin'},{userId:'resident',role:'Member'}]},
 users:{queryUserById:id=>people.get(id)},groups:{find:()=>({name:'Homes'})},offerings:{find:()=>({baseGroupId:'myscoutee-community',status:'published',ownerAccountId:'provider',staffAccountIds:['provider']})},
 chats:{syncCaseChat(){}},notifications:{append:rows=>notifications.push(...rows)}});
const fields={userId:'resident',communityId:'homes',title:'Shared repair',description:'Inspect and repair the fault.',caseType:'fault',audienceAll:false,audienceAccountIds:['resident']};
await assert.rejects(()=>service.save({...fields,communityId:null}),/community group/);
await assert.rejects(()=>service.save({...fields,description:'x'.repeat(121)}),/Invalid case/);
const unassigned=await service.save({...fields,audienceAccountIds:[]});
assert.deepEqual(unassigned.audienceAccountIds,[],'A new case has no invented affected members');
assert.equal(unassigned.canManage,true);assert.equal(unassigned.membershipStatus,'accepted','Creator membership is supplied by the domain');
assert.deepEqual((await service.detail('resident',unassigned.id)).audienceAccountIds,[],'Empty affected selection survives reload');
await service.save({...fields,id:unassigned.id,version:unassigned.version,audienceAccountIds:['resident']});
let selectedCase=await service.detail('resident',unassigned.id);assert.deepEqual(selectedCase.audienceAccountIds,['resident']);
await service.save({...fields,id:unassigned.id,version:selectedCase.version,audienceAccountIds:[]});
assert.deepEqual((await service.detail('resident',unassigned.id)).audienceAccountIds,[],'Explicit clearing survives save/reload');
records.delete(unassigned.id);notifications.length=0;
console.log('PASS empty manual-case audience, independent creator administration and selection/clear save-reload');
let c=await service.save(fields);const id=c.id;
assert.ok(c.members.every(member=>!Object.hasOwn(member,'city')),'Case members do not expose seeded city labels');
assert.equal(c.canManage,true,'The manual creator is the case admin');assert.equal(c.canTakeOver,false);
assert.equal((await service.detail('admin',id)).canManage,false,'Group admin is not implicitly the case admin');
assert.equal(c.membershipStatus,'accepted');assert.equal(c.members.find(m=>m.accountId==='admin').status,'invited');
assert.ok(notifications.length);assert.ok(notifications.every(n=>n.recipientUserId!==`group:myscoutee-community:resident`));
const command=async(actor,action,extra={})=>service.action(id,{userId:actor,action,version:records.get(id).version,...extra});
const task=(id,deps=[])=>({id,title:id,description:'Details',status:'todo',assigneeAccountIds:['resident'],dependsOnIds:deps,startAtIso:null,endAtIso:null});
await command('resident','save-board-task',{task:task('inspection')});
await command('resident','save-board-task',{task:task('repair',['inspection'])});
assert.equal((await service.detail('resident',id)).boardTasks.length,2,'Task save/read retains dependencies and assignments');
const revision=records.get(id).version;
await assert.rejects(()=>command('resident','save-board-task',{task:task('inspection',['repair'])}),/cycle/);
assert.equal(records.get(id).version,revision,'Invalid dependency graph is not persisted');
await assert.rejects(()=>command('admin','delete-board-task',{taskId:'inspection'}),/Forbidden/);
await command('resident','delete-board-task',{taskId:'inspection'});
let deleted=(await service.detail('resident',id)).boardTasks.find(t=>t.id==='inspection');
assert.equal(deleted.status,'deleted');assert.equal(records.get(id).boardTasks.length,2);
assert.deepEqual(records.get(id).boardTasks.find(t=>t.id==='repair').dependsOnIds,['inspection'],'Soft deletion preserves prerequisite references');
await assert.rejects(()=>command('admin','save-board-task',{task:{...deleted,status:'todo'}}),/Forbidden/);
await command('resident','save-board-task',{task:{...deleted,status:'todo'}});
for(const status of ['in-progress','done']){
 await command('resident','save-board-task',{task:{...task('inspection'),status}});
 await command('resident','delete-board-task',{taskId:'inspection'});
 assert.equal((await service.detail('resident',id)).boardTasks.find(t=>t.id==='inspection').status,'deleted');
 await command('resident','save-board-task',{task:task('inspection')});
}
await command('resident','complete');await command('resident','delete-board-task',{taskId:'inspection'});
assert.equal((await service.detail('resident',id)).boardTasks.find(t=>t.id==='inspection').status,'deleted','Deletion also works after case completion');
await command('resident','reopen');await command('resident','save-board-task',{task:task('inspection')});
console.log('PASS persisted soft deletion from every task status, retained dependencies/count, manager rights and completed-case deletion');
await command('resident','invite-provider',{providerAccountId:'provider',serviceId:'service'});
assert.equal((await service.detail('provider',id)).membershipStatus,'invited');
await assert.rejects(()=>command('provider','save-board-task',{task:task('provider-task')}),/Forbidden/);
await command('provider','join');
assert.equal((await service.detail('provider',id)).canManage,false);
await assert.rejects(()=>command('provider','save-board-task',{task:task('provider-task')}),/Forbidden/);
await assert.rejects(()=>command('provider','delete-board-task',{taskId:'inspection'}),/Forbidden/);
assert.equal((await service.detail('provider',id)).canChat,false,'Quotation participation does not automatically join the chat');
await command('provider','offer',{amount:80,currency:'EUR',note:'Inspect the installation.',workPolicy:'Start by agreement.',refundPolicy:'No advance payment.'});
let customer=await service.detail('resident',id),provider=await service.detail('provider',id);
assert.equal(customer.offers[0].workPolicy,'Start by agreement.');assert.equal(customer.offers[0].refundPolicy,'No advance payment.');
await assert.rejects(()=>command('resident','offer',{amount:1,currency:'EUR',note:''}),/Forbidden/);
assert.ok(notifications.some(n=>n.kind==='case-updated'&&n.recipientUserId.endsWith(':admin')),'Task edits use existing case notifications');
assert.ok(notifications.some(n=>n.kind==='case-invite-provider'&&n.recipientUserId.endsWith(':provider')),'Quotation requests notify the provider');
assert.ok(notifications.some(n=>n.kind==='case-offer'&&n.recipientUserId.endsWith(':resident')),'Submitted quotations notify reviewers');
assert.equal(customer.offers.length,1);assert.equal(provider.offers.length,1);assert.equal(provider.canReviewOffers,true);
await command('resident','invite-chat',{memberAccountIds:['provider']});
assert.equal((await service.detail('provider',id)).canChat,true);
await command('provider','recommend',{providerAccountId:'other'});
assert.equal((await service.detail('resident',id)).recommendations.length,1,'A chat provider has the same recommendation action');
await command('provider','leave');
assert.equal((await service.detail('provider',id)).canChat,false);
await assert.rejects(()=>command('provider','offer',{amount:1,currency:'EUR',note:''}),/Forbidden/);
await command('resident','remove-member',{memberAccountIds:['provider']});
await assert.rejects(()=>service.detail('provider',id),/not found/);
await command('resident','accept-offer',{offerId:customer.offers[0].id});
assert.equal((await service.detail('resident',id)).offers[0].status,'accepted');
assert.equal((await service.detail('resident',id)).offers[0].refundPolicy,'No advance payment.');
await assert.rejects(()=>service.action(id,{userId:'resident',action:'leave',version:0}),/changed/);
const offerId=customer.offers[0].id;
await command('resident','reject-offer',{offerId});
await command('resident','accept-offer',{offerId});
await command('resident','pending-offer',{offerId});
assert.equal((await service.detail('resident',id)).offers[0].status,'pending');
const policies=[{id:'work-1',title:'Scope',description:'Start by agreement.',required:true}];
await command('resident','edit-offer',{offerId,amount:85,currency:'EUR',note:'Updated agreed scope',workPolicies:policies,refundPolicies:[]});
assert.deepEqual((await service.detail('resident',id)).offers[0].workPolicies,policies);
await assert.rejects(()=>command('admin','edit-offer',{offerId,amount:1,currency:'EUR',note:'No'}),/Forbidden/);
await assert.rejects(()=>command('resident','save-board-task',{task:{...task('quoted'),offerIds:[offerId]}}),/Invalid task quotation/,'Pending quotations cannot be assigned');
await command('resident','accept-offer',{offerId});
await command('resident','save-board-task',{task:{...task('quoted'),offerIds:[offerId]}});
assert.deepEqual((await service.detail('resident',id)).boardTasks.find(t=>t.id==='quoted').offerIds,[offerId]);
await assert.rejects(()=>command('resident','save-board-task',{task:{...task('invalid-quote'),offerIds:['foreign-quote']}}),/Invalid task quotation/);
await command('resident','save-board-task',{task:{...task('quoted'),offerIds:[]}});
assert.deepEqual((await service.detail('resident',id)).boardTasks.find(t=>t.id==='quoted').offerIds,[]);
console.log('PASS reversible quotation decisions, structured terms, admin-only edits and persisted task quotation assignment');
console.log('PASS case group requirement, 120-character limit, task mutation/read, graph cycles, dependency deletion, invitations, optional chat, quotation privacy, leave/remove and stale versions');
const Facade=await compiled.symbol('CaseAppointmentsService'),run=await compiled.symbol('runInInjectionContext');
let Calendar;run({get(token){if((token.name??'').replace(/^_/,'')==='LocalCaseAppointmentsService')Calendar=token;return {};}},()=>new Facade());assert.ok(Calendar);
const calendar=Object.create(Calendar.prototype);
Object.assign(calendar,{repository:{ready:async()=>{},find:()=>({appointments:[]})},access:{actor:id=>id},caseRecords:{cases:()=>[...records.values()]},offerings:service.offerings,users:service.users});
await command('resident','save-board-task',{task:{...task('repair',['inspection']),startAtIso:'2026-10-08T09:00:00.000Z',endAtIso:'2026-10-08T10:00:00.000Z'}});
const entries=await calendar.calendar('resident','2026-10-08','2026-10-08');assert.equal(entries.length,1);assert.equal(entries[0].task.id,'repair');assert.equal(entries[0].appointment,null);
assert.equal((await calendar.calendar('other','2026-10-08','2026-10-08')).length,0);
await command('resident','delete-board-task',{taskId:'repair'});
assert.equal((await calendar.calendar('resident','2026-10-08','2026-10-08')).length,0,'Deleted task does not remain scheduled in the calendar');
console.log('PASS assigned task calendar dates, deleted-task exclusion and participant isolation');

const Chats=await compiled.symbol('LocalChatsRepository');
const base='myscoutee-community',profileId=id=>`group:${base}:${id}`;
const profiles=['resident','provider','other'].map(id=>({id:profileId(id),accountUserId:id,workspaceGroupId:base,name:id}));
let state={users:{ids:profiles.map(p=>p.id),byId:Object.fromEntries(profiles.map(p=>[p.id,p]))},serviceCases:{ids:['sample'],byId:{}},chats:{ids:[],byId:{}},chatMessages:{ids:[],byId:{},idsByChatKey:{}}};
const seeded={...records.get(id),id:'sample',ownerAccountId:'resident',audienceAccountIds:['resident'],participantAccountIds:['resident','provider','other'],memberStates:{resident:'accepted',provider:'accepted',other:'accepted'},chatAccountIds:[],support:[{accountId:'provider',status:'accepted'},{accountId:'other',status:'accepted'}],offers:[{id:'q1',providerAccountId:'provider',amount:360,currency:'EUR'},{id:'q2',providerAccountId:'other',amount:400,currency:'EUR'}]};
state.serviceCases.byId.sample=seeded;
const chats=Object.create(Chats.prototype);Object.assign(chats,{memoryDb:{read:()=>state,write:fn=>{state=fn(state);}},users:{accountId:id=>profiles.find(p=>p.id===id)?.accountUserId??id,queryUserById:id=>state.users.byId[id]}});
chats.syncCaseChat(seeded);
const q1=chats.queryChatItemById(profileId('provider'),'c-case-offer-sample-q1');assert.ok(q1);assert.equal(q1.caseOfferId,'q1');assert.deepEqual(q1.memberIds,[profileId('resident'),profileId('provider')]);
assert.equal(chats.queryChatItemById(profileId('provider'),'c-case-sample'),null,'Offer chat does not implicitly invite provider to the main case chat');
assert.equal(chats.queryChatItemById(profileId('other'),q1.id),null,'Other provider cannot access competing quotation discussion');
assert.ok(chats.matchesChatContextFilter(q1,'cases'));assert.ok(chats.matchesChatContextFilter(q1,'all'));
assert.equal(chats.queryChatItemById(profileId('resident'),'c-case-offer-sample-q2').caseOfferId,'q2');
const Row=await compiled.symbol('ActivityChatSingleRowConverter');
assert.notEqual(Row.smartListKeyForIdentity('case','sample','c-case-sample'),Row.smartListKeyForIdentity('case','sample',q1.id));
state.serviceCases.byId.sample={...seeded,memberStates:{...seeded.memberStates,provider:'left'}};
assert.equal(chats.queryChatItemById(profileId('provider'),q1.id),null,'Live case membership revokes quotation chat access');
console.log('PASS distinct quotation group chats in existing Cases/All filters, participant isolation and leave access');

// Scheduled cases invite everyone and have no admin until a separate takeover.
service.repository.tasks=()=>[{id:'schedule',baseGroupId:base,communityId:'homes',ownerAccountId:'admin',title:'Scheduled repair',description:'Scheduled',caseType:'maintenance',audienceAll:true,audienceAccountIds:[],enabled:true,frequency:'once',nextDueAtIso:'2026-10-07T09:00:00.000Z',version:0}];
service.repository.saveTask=()=>{};service.groups.find=()=>({id:'homes',name:'Homes'});
assert.equal(await service.createScheduledCases(base,new Date('2026-10-06T00:00:00Z')),1);
const automatic=[...records.values()].find(row=>row.scheduledTaskId==='schedule');assert.ok(automatic);
const autoAction=(actor,action,version=records.get(automatic.id).version)=>service.action(automatic.id,{userId:actor,action,version});
for(const actor of ['admin','resident']){
 const detail=await service.detail(actor,automatic.id);assert.equal(detail.membershipStatus,'invited');assert.equal(detail.canManage,false);assert.equal(detail.canTakeOver,true);
}
await autoAction('admin','join');assert.equal((await service.detail('admin',automatic.id)).canManage,false,'Join never grants administration');
const claimVersion=records.get(automatic.id).version;
await autoAction('resident','take-over',claimVersion);
assert.equal((await service.detail('resident',automatic.id)).canManage,true);assert.equal(records.get(automatic.id).memberStates.resident,'accepted');
await assert.rejects(()=>autoAction('admin','take-over',claimVersion),/changed/);
await assert.rejects(()=>autoAction('admin','take-over'),/Forbidden/);
assert.equal((await service.detail('admin',automatic.id)).canTakeOver,false);
await service.save({...fields,id:automatic.id,version:records.get(automatic.id).version,title:'Managed scheduled repair',audienceAll:true,audienceAccountIds:['admin','resident']});
assert.equal((await service.detail('resident',automatic.id)).title,'Managed scheduled repair','Takeover admin can save case details');
await autoAction('resident','leave');
assert.equal(records.get(automatic.id).ownerAccountId,null);assert.equal(records.get(automatic.id).status,'open');
assert.equal((await service.detail('admin',automatic.id)).canTakeOver,true);
assert.ok(notifications.some(n=>n.sourceId===automatic.id&&n.kind==='case-owner-left'&&n.recipientUserId===profileId('admin')),'Remaining participant receives ownership release notification');
await autoAction('admin','take-over');assert.equal((await service.detail('admin',automatic.id)).canManage,true);
assert.ok(notifications.some(n=>n.sourceId===automatic.id&&n.kind==='case-take-over'),'Takeover uses existing notification delivery');
await autoAction('admin','leave');assert.equal(records.get(automatic.id).status,'trash','Last participant leaving trashes the case');
assert.equal((await service.detail('admin',automatic.id)).canTakeOver,false);
console.log('PASS manual creator administration, automatic invitations, explicit atomic takeover, owner release notifications and last-participant trash');

// Menu and bucket counters follow visible item totals even after viewing.
const CaseRepo=await compiled.symbol('LocalCommunityCasesRepository');
const Converter=await compiled.symbol('CommunityCaseConverter');
service.repository.visibleCases=CaseRepo.prototype.visibleCases.bind(service.repository);
service.access.managedGroups=actor=>new Set(actor==='admin'?['homes']:[]);
const counterBase={...records.get(automatic.id),id:'counter-case',ownerAccountId:'resident',status:'open',caseType:'maintenance',memberStates:{resident:'accepted',admin:'accepted'},participantAccountIds:['resident','admin'],attentionAccountIds:[],version:0};
records.clear();records.set(counterBase.id,counterBase);
const query={page:0,pageSize:20,filters:{status:'active'}};
let page=await service.page('resident',query);
assert.equal(page.context.total,1);assert.equal(page.context['open:maintenance'],1,'Read items are included in their bucket');
await service.read('resident',counterBase.id);
assert.deepEqual((await service.page('resident',query)).context,page.context,'Opening a case cannot clear its item counters');
assert.equal(CaseRepo.prototype.countVisible.call(service.repository,'resident',new Set()),1);
const menuFor=async actor=>Converter.actions(await service.detail(actor,counterBase.id),actor).map(i=>i.id);
let ids=await menuFor('resident');for(const id of ['edit','start','complete','cancel','trash'])assert.ok(ids.includes(id),'Case admin sees '+id);
for(const id of ['edit','start','complete','cancel','trash'])assert.ok(!(await menuFor('admin')).includes(id),'A group admin who is not the case admin has no '+id);
for(const [action,status] of [['cancel','cancelled'],['reopen','open'],['complete','completed'],['reopen','open'],['trash','trash'],['reopen','open']]){
 const current=records.get(counterBase.id);
 await service.action(current.id,{userId:'resident',action,version:current.version});
 page=await service.page('resident',{...query,filters:{status:status==='open'?'active':status}});
 assert.equal(page.total,1);assert.equal(page.context[status+':maintenance'],1);
 assert.equal(page.context.total,status==='trash'?0:1,'Sidebar counts visible non-trash cases');
 if(['cancelled','completed','trash'].includes(status))assert.ok((await menuFor('resident')).includes('reopen'));
}
console.log('PASS case-admin lifecycle menus, member restrictions, item-count badges after read/cancel/complete/trash/reopen and sidebar totals');

// Exercise menu -> existing store -> actual shared dialog, without a browser or live data.
const [CaseStore, CasePopup, OfferingStore, OfferingPopup, AnnouncementStore, AnnouncementPopup, DialogStore, confirmationSignal] = await Promise.all(
 ['CommunityCasesStore','CommunityCasesPopupComponent','ServiceOfferingsStore','ServiceOfferingsPopupComponent',
  'CommunityAnnouncementsStore','CommunityAnnouncementsComponent','DialogStore','signal'].map(compiled.symbol));
const dependency = name => CasePopup.ɵcmp.dependencies.find(type => type.name.replace(/^_/, '') === name);
const confirmationCase = {...await service.detail('resident',counterBase.id),canManage:true,canTakeOver:true,canChat:true,
 offers:[{id:'offer',providerAccountId:'provider',amount:85,currency:'EUR',status:'pending'}],
 members:[{accountId:'provider',name:'Provider'}],support:[{accountId:'provider',status:'accepted'}],chatAccountIds:[]};
function caseConfirmationFixture() {
 const calls=[],dialog=new DialogStore(),store=Object.create(CaseStore.prototype),actor=confirmationSignal('resident');
 Object.assign(store,{generation:0,session:confirmationSignal({userId:'resident',list:true,tasks:false}),busy:confirmationSignal(false),error:confirmationSignal(''),
  editor:confirmationSignal(null),board:confirmationSignal(confirmationCase),quotations:confirmationSignal(confirmationCase),dialogs:dialog,
  profile:{activeUserId:actor},workspace:{accountId:id=>id,isCommunity:()=>true},publish(){},publishTask(){},
  service:{action:async(...args)=>{calls.push(args);return confirmationCase;},taskAction:async(...args)=>{calls.push(args);return {};}}});
 return {calls,dialog,store,actor};
}
const menuEvent = (item,context=item.context) => ({id:item.id,item,context,sourceEvent:new Event('click')});
async function provesConfirmation(fixture, invoke, item) {
 const {calls,dialog}=fixture;
 await invoke(); await Promise.resolve();
 assert.equal(calls.length,0,`${item.id}: no mutation before confirmation`);
 assert.ok(dialog.dialog(),`${item.id}: shared confirmation opens`);
 assert.equal(dialog.dialog().confirmPalette,item.palette,`${item.id}: exact originating menu palette`);
 assert.ok(dialog.dialog().message,`${item.id}: target identified`);
 dialog.cancel(); await Promise.resolve(); assert.equal(calls.length,0,`${item.id}: cancel preserves state`);
 await invoke(); await dialog.confirm();
 assert.equal(calls.length,1,`${item.id}: confirmation sends exactly one mutation`);
 assert.equal(dialog.dialog(),null,`${item.id}: success closes the dialog`);
}
for(const action of ['take-over','join','decline','leave','start','complete','cancel','trash','reopen']) {
 const f=caseConfirmationFixture(),value={...confirmationCase,status:action==='reopen'?'completed':'open',membershipStatus:action==='leave'?'accepted':'invited'};
 const item=Converter.actions(value,'resident').find(item=>item.id===action);assert.ok(item,action);
 const popup=Object.assign(Object.create(CasePopup.prototype),{store:f.store});
 await provesConfirmation(f,()=>popup.action(menuEvent(item,value)),item);
}
for(const action of ['accept-offer','reject-offer','pending-offer','invite-chat']) {
 const f=caseConfirmationFixture(),value={...confirmationCase,status:'open',offers:[{...confirmationCase.offers[0],status:action==='pending-offer'?'accepted':'pending'}]};
 f.store.quotations.set(value);
 const popup=Object.assign(Object.create(dependency('CommunityCaseQuotationsComponent').prototype),{store:f.store});
 const item=popup.menu(value.offers[0]).find(item=>item.id===action);assert.ok(item,action);
 await provesConfirmation(f,()=>popup.action(menuEvent(item)),item);
}
for(const [action,status] of [['task-progress','todo'],['task-progress','in-progress'],['task-progress','done'],['task-delete','todo']]) {
 const f=caseConfirmationFixture(),value={...task('board-task'),status};f.store.board.set({...confirmationCase,boardTasks:[value]});
 const popup=Object.assign(Object.create(dependency('CommunityCaseBoardComponent').prototype),{store:f.store});
 // Deliberately distinct palette catches accidental hard-coded confirmation colors.
 const item={id:action,label:'Task action',palette:'violet',context:value};
 await provesConfirmation(f,()=>popup.taskAction(menuEvent(item)),item);
}
for(const [action,status] of [['pause','active'],['resume','paused'],['trash','active'],['restore','trash']]) {
 const f=caseConfirmationFixture(),popup=Object.assign(Object.create(CasePopup.prototype),{store:f.store});
 const value={id:'schedule',title:'Meter inspection',status,canManage:true,version:3};
 const item=popup.taskMenu(value).find(item=>item.id===action);assert.ok(item,action);
 await provesConfirmation(f,()=>popup.taskAction(menuEvent(item)),item);
}
console.log('PASS case, quotation, board and all schedule lifecycle menus require confirmation; cancel makes no mutation and palette matches');

function offeringConfirmationFixture() {
 const calls=[],dialog=new DialogStore(),store=Object.create(OfferingStore.prototype);
 Object.assign(store,{generation:0,profileId:confirmationSignal('provider'),session:confirmationSignal({pick:null}),busy:confirmationSignal(false),error:confirmationSignal(''),
  changed:confirmationSignal(null),calendarCancelled:confirmationSignal(null),workspace:{isCommunity:()=>true},dialogs:dialog,
  service:{action:async(...args)=>{calls.push(args);return {}; }},appointments:{cancel:async(...args)=>{calls.push(args);}}});
 return {calls,dialog,store};
}
for(const action of ['publish','unpublish','trash','restore']) {
 const f=offeringConfirmationFixture(),popup=Object.assign(Object.create(OfferingPopup.prototype),{store:f.store});
 const value={service:{id:'service',title:'Repairs',version:2}},item={id:action,label:action,palette:'teal',context:value};
 await provesConfirmation(f,()=>popup.action(menuEvent(item)),item);
}
const appointmentFixture=offeringConfirmationFixture();
const appointmentEntry={caseTitle:'Repair case',serviceTitle:'Electrical work',customerName:'Customer',appointment:{caseId:'case',id:'appointment',providerAccountId:'provider',startAtIso:'2026-10-08T10:00:00Z'}};
const appointmentMenu={id:'cancel',label:'Cancel appointment',palette:'danger'};
await provesConfirmation(appointmentFixture,()=>appointmentFixture.store.cancelAppointment(appointmentEntry,appointmentMenu),appointmentMenu);
assert.deepEqual(appointmentFixture.calls[0],['provider','case','provider','appointment']);
for(const action of ['publish','unpublish','trash','restore','close']) {
 const calls=[],dialog=new DialogStore(),store=Object.create(AnnouncementStore.prototype);
 Object.assign(store,{generation:0,userId:confirmationSignal('admin'),groupId:confirmationSignal('homes'),canManage:()=>true,busy:confirmationSignal(false),error:confirmationSignal(''),
  changed:confirmationSignal(null),editor:confirmationSignal(null),dialogs:dialog,service:{action:async(...args)=>{calls.push(args);return value;}}});
 const value={id:'notice',title:'Notice',status:action==='publish'?'draft':action==='restore'?'trash':'published',voting:true,closed:false,canManage:true,version:2};
 const popup=Object.assign(Object.create(AnnouncementPopup.prototype),{store});
 const item=popup.menu(value).find(item=>item.id===action);assert.ok(item,action);
 await provesConfirmation({calls,dialog,store},()=>popup.action(menuEvent(item)),item);
}
console.log('PASS service lifecycle, appointment cancellation and every announcement state action require confirmation with the originating palette');

const failedConfirmation=caseConfirmationFixture(),failureMenu={id:'complete',label:'Complete',palette:'green'};
failedConfirmation.store.service.action=async()=>{throw {status:409};};
await failedConfirmation.store.command(confirmationCase,{action:'complete'},failureMenu);
await failedConfirmation.dialog.confirm();
assert.equal(failedConfirmation.dialog.dialog().errorMessage,'case.changed','Failed mutation remains visibly retryable');
failedConfirmation.store.service.action=async()=>{failedConfirmation.calls.push('saved');return confirmationCase;};
await failedConfirmation.dialog.confirm();assert.equal(failedConfirmation.calls.length,1);assert.equal(failedConfirmation.dialog.dialog(),null);
for(const stale of ['session','actor','generation']) {
 const f=caseConfirmationFixture();await f.store.command(confirmationCase,{action:'complete'},failureMenu);
 if(stale==='session')f.store.session.set(null);else if(stale==='actor')f.actor.set('other');else f.store.generation++;
 await f.dialog.confirm();assert.equal(f.calls.length,0);assert.equal(f.dialog.dialog().errorMessage,'case.changed');
}
const staleOffering=offeringConfirmationFixture();
await staleOffering.store.action({service:{id:'s',title:'Repair',version:2}},'trash',{id:'trash',label:'Delete',palette:'danger'});
staleOffering.store.profileId.set('other');await staleOffering.dialog.confirm();
assert.equal(staleOffering.calls.length,0);assert.equal(staleOffering.dialog.dialog().errorMessage,'service.changed');
console.log('PASS failed confirmation stays open, retry is bounded, and stale session/profile/surface cannot submit a delayed mutation');
