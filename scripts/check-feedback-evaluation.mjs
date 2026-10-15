import assert from 'node:assert/strict';
import { compiledDevModules } from './compiled-dev-modules.mjs';
const compiled=compiledDevModules(process.argv[2]);
const Feedback=await compiled.symbol('LocalFeedbackService');
const Cases=await compiled.symbol('LocalCommunityCasesService');
const records=new Map(),evaluationRows=new Map(),notifications=new Map();
const people=new Map(['admin','resident','provider','outsider'].flatMap(id=>[[id,{id,name:id}],['group:myscoutee-community:'+id,{id:'group:myscoutee-community:'+id,name:id}]]));
const repository={ready:async()=>{},flush:async()=>{},cases:()=>[...records.values()],findCase:id=>records.get(id),saveCase(c,v){assert.equal(records.get(c.id)?.version,v);records.set(c.id,structuredClone(c));return c;},
  pendingFeedbackWork:()=>[...records.values()].filter(c=>c.feedbackWork).map(c=>({caseId:c.id,work:c.feedbackWork})),
  completeFeedbackWork(id){records.get(id).feedbackWork=null;}};
const evaluations={rows:()=>[...evaluationRows.values()].flat(),save:(id,rows)=>evaluationRows.set(id,structuredClone(rows))};
const users={queryUserById:id=>people.get(id)},notify={append:rows=>rows.forEach(row=>{if(!notifications.has(row.id))notifications.set(row.id,row);})};
const feedback=Object.create(Feedback.prototype);let wakes=0;
Object.assign(feedback,{repository,evaluations,offerings:{find:()=>null},users,notifications:notify,access:{actor:id=>id},waitForRouteDelay:async()=>{},running:false,wake(){wakes++;}});
const cases=Object.create(Cases.prototype);
Object.assign(cases,{repository,feedback,actor:async id=>id,access:{admin:()=>false},groups:{find:()=>({name:'Homes'})},users,chats:{syncCaseChat(){}},notifications:notify});
records.set('case',{id:'case',baseGroupId:'myscoutee-community',communityId:'homes',ownerAccountId:'admin',title:'Repair',description:'Repair',caseType:'fault',status:'open',
  audienceAll:false,audienceAccountIds:['admin','resident'],participantAccountIds:['admin','resident','provider'],attentionAccountIds:[],
  memberStates:{admin:'accepted',resident:'accepted',provider:'accepted'},support:[{accountId:'provider',serviceId:'service',status:'accepted'}],recommendations:[],offers:[],boardTasks:[],chatAccountIds:[],
  scheduledTaskId:null,dueAtIso:null,createdAtIso:new Date().toISOString(),updatedAtIso:new Date().toISOString(),version:0});
await cases.action('case',{userId:'admin',action:'complete',version:0});
assert.equal(records.get('case').status,'completed');assert.equal(wakes,1);
assert.ok(records.get('case').feedbackWork);assert.equal(evaluations.rows().length,0,'Closure only persists work, does not prepare feedback synchronously');
await feedback.drain();
assert.equal(evaluations.rows().length,2);
assert.equal(records.get('case').feedbackWork,null);
assert.equal(notifications.get('feedback-evaluation-ready:case:provider:admin').recipientUserId,'group:myscoutee-community:admin','Closing admin receives the automated feedback notification');
assert.equal((await feedback.evaluationWindow('admin','pending',0,20)).items.length,1);
assert.equal((await feedback.evaluationWindow('outsider','pending',0,20)).items.length,0);
await assert.rejects(()=>feedback.action('case:provider:admin',{userId:'outsider',action:'submit',criteria:{quality:8,reliability:8,communication:8,value:10},comment:'Good'}),/not found/);
await assert.rejects(()=>feedback.action('case:provider:admin',{userId:'admin',action:'submit',criteria:{quality:9},comment:'Good'}),/Invalid feedback/);
await feedback.action('case:provider:admin',{userId:'admin',action:'remove'});
assert.equal((await feedback.evaluationWindow('admin','removed',0,20)).items.length,1);
await feedback.action('case:provider:admin',{userId:'admin',action:'restore'});
await feedback.action('case:provider:admin',{userId:'admin',action:'submit',criteria:{quality:8,reliability:8,communication:8,value:10},comment:'Careful work.'});
assert.equal((await feedback.evaluationWindow('admin','pending',0,20)).items.length,0);
assert.equal((await feedback.evaluationWindow('provider','received',0,20)).items.length,1);
assert.deepEqual(await feedback.stats('resident','provider'),{count:1,average:8.5,criteria:{quality:8,reliability:8,communication:8,value:10}});
const beforeNotifications=notifications.size;
cases.requestFeedback(records.get('case'));await feedback.drain();
assert.equal(evaluations.rows().length,2);assert.equal(notifications.size,beforeNotifications,'Replay does not duplicate ready notifications');
assert.equal(evaluations.rows().find(r=>r.viewerAccountId==='admin').comment,'Careful work.','Replay retains submitted feedback');
const restored=structuredClone(records.get('case'));records.clear();records.set(restored.id,restored);
const reloaded=Object.create(Feedback.prototype);Object.assign(reloaded,{repository,evaluations,offerings:{find:()=>null},users,notifications:notify,access:{actor:id=>id},waitForRouteDelay:async()=>{},running:false});
assert.equal((await reloaded.evaluationWindow('admin','feedbacked',0,20)).items[0].feedback.comment,'Careful work.');
console.log('PASS async closure handoff, closing-admin eligibility/notification, worker replay, submit/remove/restore, reviewer isolation, provider stats and persisted reload');


const Store=await compiled.symbol('FeedbackStore');
const store=Object.create(Store.prototype);let opened=0;
store.menus={openNavigatorFeedbackRequest(){opened++;}};store.open();
assert.equal(opened,1);
assert.equal(typeof store.pageAfterEvents,'undefined','List composition must remain in the central Feedback service');
console.log('PASS central Feedback store entry and removal of the legacy second page request');
