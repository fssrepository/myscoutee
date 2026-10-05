import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compiledDevModules } from './compiled-dev-modules.mjs';

// Exercise the running watcher's output; HTTP is isolated and no user chat is created.
const compiled = compiledDevModules(process.argv[2]);
const HttpChats = await compiled.symbol('HttpChatsService');
const Announcements = await compiled.symbol('CommunityAnnouncementsStore');
const Activities = await compiled.symbol('ActivitiesPopupStore');
const signal = await compiled.symbol('signal');
const userId = signal('group:homes:resident');
const requests = [];
const chat = {
  id: 'c-moderation-group-group:homes:resident', channelType: 'groupSupport',
  title: 'Homes', avatar: 'C', memberIds: ['group:homes:resident', 'group:homes:admin'],
  unread: 0, lastMessage: '', lastSenderId: ''
};
let respond = async () => chat;
const http = Object.create(HttpChats.prototype);
Object.assign(http, {
  userProfileStore: { activeUserId: userId, getUserProfile: () => null }, apiBaseUrl: '/api',
  http: { post(url, body, options) {
    requests.push({ url, body, userId: options.params.get('userId') });
    return { toPromise: () => respond() };
  } }
});
const activities = Object.create(Activities.prototype);
Object.assign(activities, {
  _eventChatSession: signal(null), _eventChatHeader: signal(null),
  _stackedEventChatSession: signal(null), _stackedEventChatHeader: signal(null)
});
const store = Object.create(Announcements.prototype);
Object.assign(store, {
  chats: http, activities, userId, groupId: signal('homes'), generation: 0,
  popup: signal(false), error: signal(''), editor: signal(null), unitRows: signal(null),
  unitEditor: signal(null), busy: signal(false)
});
const announcement = { id: 'notice', communityId: 'homes' };

await store.feedback(announcement);
assert.equal(requests.length, 1, 'Ask the group admin must reach HTTP without event/target IDs');
assert.equal(requests[0].url, '/api/activities/chats/service');
assert.equal(requests[0].body.serviceContext, 'groupSupport');
assert.equal(requests[0].body.announcementId, 'notice');
assert.equal(requests[0].userId, 'group:homes:resident');
assert.equal(activities._eventChatSession()?.request.chatId, chat.id);
assert.equal(activities._eventChatSession()?.request.channelType, 'groupSupport');
assert.deepEqual(activities._eventChatHeader().memberIds, chat.memberIds);

store.popup.set(true);
await store.feedback(announcement);
assert.equal(activities._eventChatSession()?.request.parentZIndex, 14000, 'Chat must open above the announcement popup');
activities.closeEventChat();
respond = async () => null;
await store.feedback(announcement);
assert.equal(store.error(), 'announcement.feedback.failed', 'An empty HTTP result must be visible, not a silent no-op');
assert.equal(activities._eventChatSession(), null);
respond = async () => { throw Error('Unavailable'); };
await store.feedback(announcement);
assert.equal(store.error(), 'announcement.feedback.failed');
respond = async () => chat;
await store.feedback(announcement);
assert.equal(store.error(), '', 'A successful retry clears the previous failure');
assert.equal(activities._eventChatSession()?.request.chatId, chat.id);

activities.closeEventChat();
let finish;
respond = () => new Promise(resolve => { finish = resolve; });
const pending = store.feedback(announcement);
userId.set('group:other:resident');
finish(chat);
await pending;
assert.equal(activities._eventChatSession(), null, 'Late results must not open in a different profile');
userId.set('group:homes:resident');
const closing = store.feedback(announcement);
store.close();
finish(chat);
await closing;
assert.equal(activities._eventChatSession(), null, 'Closing the source cancels a late open');

const count = requests.length;
for (const context of ['event', 'asset']) {
  assert.equal(await http.ensureServiceChat({ serviceContext: context, targetUserId: '', title: '', lastMessage: '' }), null);
}
assert.equal(requests.length, count, 'Event/asset validation remains unchanged');
store.changed=signal(null);
store.service={action:async(id,request)=>({id,myBallot:request.choice})};
store.viewVoting({id:'vote',version:0});
store.dialogs={open:config=>store.confirmVote=config.onConfirm};
await store.command({id:'vote',version:0},'vote','yes','green');
await store.confirmVote();
assert.equal(store.editor().view,'voting','Casting keeps the voting popup open rather than returning to details');
assert.equal(store.editor().value.myBallot,'yes');
console.log('PASS announcement HTTP dispatch, existing group-admin chat/session, popup layering, visible failures, retry and stale-result isolation');

const seedJson=name=>JSON.parse(readFileSync(new URL('../../server/docker/conf/mongodb/demo_db/'+name+'.json',import.meta.url),'utf8'));
const accounts=seedJson('users');
const admin=accounts.find(u=>u.name==='Alex Turner'&&!u.workspaceGroupId).userId;
const resident=accounts.find(u=>u.name==='Evan Reed'&&!u.workspaceGroupId).userId;
const seeded={announcements:seedJson('communityAnnouncements').map(({_id,...a})=>({id:_id,...a}))};
const vote=seeded.announcements.find(a=>a.id==='park-meter-vote');
assert.ok(vote?.voting);assert.equal(vote.status,'published');
assert.ok(Date.parse(vote.deadlineIso)>Date.now(),'Seed vote must be open for this checkpoint');
const roster=seedJson('activityMembers').filter(m=>m.ownerType==='community'&&m.ownerId==='community-park-court'&&m.status==='accepted');
assert.deepEqual(roster.filter(m=>m.votingEligible).map(m=>m.userId).sort(),[admin,resident].sort());
const LocalAnnouncements=await compiled.symbol('LocalCommunityAnnouncementsService');
let data={communityAnnouncements:{ids:seeded.announcements.map(a=>a.id),byId:Object.fromEntries(seeded.announcements.map(a=>[a.id,a]))}};
let disk;
const db={whenReady:async()=>{},read:()=>data,write:mutate=>{data=mutate(data);},flushToIndexedDb:async()=>{disk=JSON.stringify(data);}};
const access={roster:()=>roster,member:(_,id)=>roster.find(m=>m.userId===id),actor:id=>id,requireMember(){},admin:(_group,id)=>id===admin,requireAdmin(_group,id){assert.equal(id,admin);}};
const runInInjectionContext=await compiled.symbol('runInInjectionContext');
const announcements=runInInjectionContext({get(token){
  const name=token.name.replace(/^_/,'');
  if(name==='LocalMemoryDb')return db;
  if(name==='LocalCommunityAnnouncementsRepository')return new token();
  if(name==='LocalCommunityAccessService')return access;
  if(['RouteDelayService','LocalCommunityGroupsRepository','LocalUsersRepository','LocalNotificationsRepository'].includes(name))return {};
  throw Error('Unexpected provider '+name);
}},()=>new LocalAnnouncements());
announcements.waitForRouteDelay=async()=>{};
const filters={communityId:'community-park-court',status:'published',voting:true};
const voting=await announcements.page(resident,{pageSize:1,filters});
assert.equal(voting.total,1);assert.equal(voting.items[0].id,'park-meter-vote');assert.equal(voting.nextCursor,null);
assert.equal(voting.items[0].canVote,true);
const home=await announcements.page(resident,{pageSize:20,filters:{communityId:filters.communityId,status:'published'}});
assert.deepEqual(new Set(home.items.map(a=>a.id)),new Set(['park-meter-notice','park-meter-vote']));
const document={name:'Details.txt',mimeType:'text/plain',sizeBytes:14,url:'data:text/plain;base64,U2F2ZWQgZG9jdW1lbnQ='};
const draft=await announcements.save({userId:admin,communityId:filters.communityId,title:'Document',body:'Details',voting:false,deadlineIso:null,attachments:[document]});
data=JSON.parse(disk);
assert.deepEqual((await announcements.detail(admin,draft.id)).attachments,[document]);
const LocalMedia=await compiled.symbol('LocalMediaService');
assert.equal(await (await LocalMedia.prototype.loadDocument(document.url)).text(),'Saved document');
const cleared=await announcements.save({...draft,userId:admin,attachments:[]});data=JSON.parse(disk);
assert.deepEqual((await announcements.detail(admin,cleared.id)).attachments,[]);
console.log('PASS Park Court vote and Evan entitlement, voting-only paging/totals, Home notices, attachment persisted reload/download/clear');
