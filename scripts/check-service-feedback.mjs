import assert from 'node:assert/strict';
import { compiledDevModules } from './compiled-dev-modules.mjs';
const compiled=compiledDevModules(process.argv[2]);
const Feedback=await compiled.symbol('LocalServiceFeedbackService');
const Cases=await compiled.symbol('LocalCommunityCasesService');
const records=new Map(),notifications=new Map();
const people=new Map(['admin','resident','provider','outsider'].flatMap(id=>[[id,{id,name:id}],['group:myscoutee-community:'+id,{id:'group:myscoutee-community:'+id,name:id}]]));
const repository={ready:async()=>{},flush:async()=>{},cases:()=>[...records.values()],findCase:id=>records.get(id),saveCase(c,v){assert.equal(records.get(c.id)?.version,v);records.set(c.id,structuredClone(c));return c;},
  saveFeedback(id,feedback,feedbackWork){records.set(id,{...records.get(id),feedback:structuredClone(feedback),feedbackWork:structuredClone(feedbackWork)});}};
const users={queryUserById:id=>people.get(id)},notify={append:rows=>rows.forEach(row=>{if(!notifications.has(row.id))notifications.set(row.id,row);})};
const feedback=Object.create(Feedback.prototype);let wakes=0;
Object.assign(feedback,{repository,users,notifications:notify,access:{actor:id=>id},waitForRouteDelay:async()=>{},running:false,wake(){wakes++;}});
const cases=Object.create(Cases.prototype);
Object.assign(cases,{repository,feedback,actor:async id=>id,access:{admin:()=>false},groups:{find:()=>({name:'Homes'})},users,chats:{syncCaseChat(){}},notifications:notify});
records.set('case',{id:'case',baseGroupId:'myscoutee-community',communityId:'homes',ownerAccountId:'admin',title:'Repair',description:'Repair',caseType:'fault',status:'open',
  audienceAll:false,audienceAccountIds:['admin','resident'],participantAccountIds:['admin','resident','provider'],attentionAccountIds:[],
  memberStates:{admin:'accepted',resident:'accepted',provider:'accepted'},support:[{accountId:'provider',serviceId:'service',status:'accepted'}],recommendations:[],offers:[],boardTasks:[],chatAccountIds:[],
  scheduledTaskId:null,dueAtIso:null,createdAtIso:new Date().toISOString(),updatedAtIso:new Date().toISOString(),version:0});
await cases.action('case',{userId:'admin',action:'complete',version:0});
assert.equal(records.get('case').status,'completed');assert.equal(wakes,1);
assert.ok(records.get('case').feedbackWork);assert.equal(records.get('case').feedback?.length??0,0,'Closure only persists work, does not prepare feedback synchronously');
await feedback.drain();
assert.equal(records.get('case').feedback.length,2);
assert.equal(records.get('case').feedbackWork,null);
assert.equal(notifications.get('service-feedback-ready:case:provider:admin').recipientUserId,'group:myscoutee-community:admin','Closing admin receives the automated feedback notification');
assert.equal((await feedback.page('admin',{pageSize:20,filters:{bucket:'pending'}})).total,1);
assert.equal((await feedback.page('outsider',{pageSize:20,filters:{bucket:'pending'}})).total,0);
await assert.rejects(()=>feedback.action('case:provider:admin',{userId:'outsider',action:'submit',criteria:{quality:9,reliability:8,communication:7,value:8},comment:'Good'}),/not found/);
await assert.rejects(()=>feedback.action('case:provider:admin',{userId:'admin',action:'submit',criteria:{quality:9},comment:'Good'}),/Invalid feedback/);
await feedback.action('case:provider:admin',{userId:'admin',action:'remove'});
assert.equal((await feedback.page('admin',{pageSize:20,filters:{bucket:'removed'}})).total,1);
await feedback.action('case:provider:admin',{userId:'admin',action:'restore'});
await feedback.action('case:provider:admin',{userId:'admin',action:'submit',criteria:{quality:9,reliability:8,communication:7,value:8},comment:'Careful work.'});
assert.equal((await feedback.page('admin',{pageSize:20,filters:{bucket:'pending'}})).total,0);
assert.equal((await feedback.page('provider',{pageSize:20,filters:{bucket:'received'}})).total,1);
assert.deepEqual(await feedback.stats('resident','provider'),{count:1,average:8,criteria:{quality:9,reliability:8,communication:7,value:8}});
const beforeNotifications=notifications.size;
feedback.request(records.get('case'));await feedback.drain();
assert.equal(records.get('case').feedback.length,2);assert.equal(notifications.size,beforeNotifications,'Replay does not duplicate ready notifications');
assert.equal(records.get('case').feedback.find(r=>r.viewerAccountId==='admin').comment,'Careful work.','Replay retains submitted feedback');
const restored=structuredClone(records.get('case'));records.clear();records.set(restored.id,restored);
const reloaded=Object.create(Feedback.prototype);Object.assign(reloaded,{repository,users,notifications:notify,access:{actor:id=>id},waitForRouteDelay:async()=>{},running:false});
assert.equal((await reloaded.page('admin',{pageSize:20,filters:{bucket:'feedbacked'}})).items[0].feedback.comment,'Careful work.');
console.log('PASS async closure handoff, closing-admin eligibility/notification, worker replay, submit/remove/restore, reviewer isolation, provider stats and persisted reload');

// Page boundaries of the common list must not drop/duplicate service rows.
const Store=await compiled.symbol('ServiceFeedbackStore');
const Cards=await compiled.symbol('EventFeedbackInfoCardConverter');
const mergedStore=Object.create(Store.prototype);
let community=true,sourceCalls=0;
const serviceRows=Array.from({length:29},(_,i)=>({feedback:{id:'review-'+i,status:'pending'},providerName:'Provider '+i,reviewerName:'Reviewer'}));
Object.assign(mergedStore,{workspace:{isCommunity:()=>community},service:{page:async(user,q)=>{
 sourceCalls++;const start=Number(q.cursor??0)*q.pageSize;
 return {items:serviceRows.slice(start,start+q.pageSize),total:serviceRows.length,nextCursor:start+q.pageSize<serviceRows.length?String(Number(q.cursor??0)+1):null,context:{pending:29,feedbacked:4,removed:2,received:3}};
}}});
for(const eventTotal of [0,1,11,12,13,25]){
 const collected=[];let pages=0;
 for(let page=0;page*12<eventTotal+29;page++){
  const count=Math.max(0,Math.min(12,eventTotal-page*12));const before=sourceCalls;
  const result=await mergedStore.pageAfterEvents({userId:'reviewer',filter:'pending',page,pageSize:12},eventTotal,count);
  collected.push(...result.items.map(i=>i.feedback.id));pages++;
  assert.ok(sourceCalls-before<=2,'Each visible window reads at most two bounded service pages');
  assert.equal(result.context.pending,29,'Common header retains the complete service count on every page');
  assert.equal(result.total,29);
 }
 assert.deepEqual(collected,serviceRows.map(i=>i.feedback.id),'Combined windows retain each service item exactly once, including a partial event page');
}
community=false;const callsBefore=sourceCalls;
assert.equal((await mergedStore.pageAfterEvents({userId:'reviewer',filter:'pending',page:0,pageSize:12},0,0)).total,0);
assert.equal(sourceCalls,callsBefore,'Non-community feedback does not request service data');
community=true;
await mergedStore.pageAfterEvents({userId:'reviewer',filter:'pending',campaignId:'campaign',page:0,pageSize:12},0,0);
assert.equal(sourceCalls,callsBefore,'Campaign scope is preserved');
const pendingCard=Cards.convertService({feedback:{id:'one',caseTitle:'Repair',status:'pending',comment:'',average:null,createdAtIso:'2026-10-06T04:00:00Z'},providerName:'Provider',reviewerName:'Reviewer'},false);
assert.equal(pendingCard.status,'pending');assert.equal(pendingCard.accentHue,42);
assert.deepEqual(pendingCard.menuActions,['startFeedback','removeFeedback']);
assert.equal(Cards.serviceItem(pendingCard).item.providerName,'Provider');
assert.equal(Cards.serviceItem({id:'event'}),null,'Existing event actions remain event actions');
let routed=0;mergedStore.menus={openNavigatorEventFeedbackRequest(){routed++;}};mergedStore.open();
assert.equal(routed,1,'Service notifications open the existing common Feedback list');
console.log('PASS common feedback pagination, existing status actions, service-only tint, scope isolation and shared notification entry');
