import assert from 'node:assert/strict';
import { compiledDevModules } from './compiled-dev-modules.mjs';
const compiled=compiledDevModules(process.argv[2]);
const copy=x=>JSON.parse(JSON.stringify(x));
const [Groups,Announcements,runInInjectionContext,Converter,Members,Store,DialogStore,signal]=await Promise.all([
 'LocalCommunityGroupsService','LocalCommunityAnnouncementsService','runInInjectionContext','ActivityMemberImageCardConverter',
 'EventMembersPopupComponent','CommunityAnnouncementsStore','DialogStore','signal'].map(name=>compiled.symbol(name)));
let roster=[{id:'admin',userId:'admin',name:'Admin',role:'Admin',status:'accepted'},
 {id:'resident',userId:'resident',name:'Resident',role:'Member',status:'accepted',votingEligible:false},
 {id:'pending',userId:'pending',name:'Pending',role:'Member',status:'pending'}];
let group={id:'homes',ownerUserId:'admin',version:0,groupType:'community'};
let data={communityAnnouncements:{ids:[],byId:{}}},disk;
const db={read:()=>data,write:fn=>data=fn(data),whenReady:async()=>{},flushToIndexedDb:async()=>{disk=JSON.stringify({data,roster,group});}};
let repository;
runInInjectionContext({get(token){
 const name=token.name.replace(/^_/,'');
 if(name==='LocalMemoryDb')return db;
 if(name==='LocalCommunityAnnouncementsRepository'){repository=new token();return repository;}
 return {};
}},()=>new Announcements());
const groups=Object.create(Groups.prototype);
Object.assign(groups,{
 groups:{find:()=>group,save:g=>group=copy(g)},
 members:{peekRecordsByOwner:()=>copy(roster),replaceRecordsByOwner:(_,rows)=>roster=copy(rows)},
 visible:()=>group,dto:()=>copy(group),member:(_,id)=>roster.find(m=>m.userId===id),
 records:()=>roster,roster:()=>copy(roster),notifyMemberTransition(){},
});
const service=Object.create(Announcements.prototype);
Object.assign(service,{repository,actor:async id=>id,notify(){},access:{
 roster:()=>roster.filter(m=>m.status==='accepted'),member:(_,id)=>roster.find(m=>m.userId===id&&m.status==='accepted'),
 admin:(_,id)=>id==='admin',requireAdmin:(_,id)=>{if(id!=='admin')throw Error('Forbidden');},
 requireMember:(_,id)=>{if(!roster.some(m=>m.userId===id&&m.status==='accepted'))throw Error('Forbidden');}
}});
const create=async title=>{
 const a=await service.save({userId:'admin',communityId:'homes',title,body:'Member vote',attachments:[],voting:true,deadlineIso:'2099-01-01T18:00:00Z'});
 return service.action(a.id,{userId:'admin',version:a.version,action:'publish'});
};
let a=await create('First'),b=await create('Second');
const cast=async(id,user,choice)=>service.action(id,{userId:user,version:(await service.detail(user,id)).version,action:'vote',choice});
await assert.rejects(()=>cast(a.id,'resident','yes'),/Forbidden/);
await assert.rejects(()=>groups.action('resident','homes','resident','grant-vote'),/Forbidden/);
await assert.rejects(()=>groups.action('admin','homes','pending','grant-vote'),/Forbidden/);
const grant=await groups.action('admin','homes','resident','grant-vote');
assert.equal(grant.members.find(m=>m.userId==='resident').votingEligible,true);
assert.equal((await service.detail('resident',a.id)).canVote,true,'A grant applies to an existing open vote');
a=await cast(a.id,'resident','yes');assert.equal(a.myBallot,'yes');assert.equal(a.results.yes,1);assert.equal(a.castVotes,1);
assert.equal(a.eligibleMembers,1);assert.ok(!('eligibleWeight' in a));
await assert.rejects(()=>cast(a.id,'resident','no'),/changed/);
await groups.action('admin','homes','resident','revoke-vote');
await assert.rejects(()=>cast(b.id,'resident','yes'),/Forbidden/);
a=await service.detail('resident',a.id);assert.equal(a.canVote,false);assert.equal(a.myBallot,'yes');assert.equal(a.results.yes,1);
assert.equal(a.eligibleMembers,1,'A cast vote is retained when the member loses the right');
await repository.flush();({data,roster,group}=JSON.parse(disk));
assert.equal((await service.detail('resident',a.id)).myBallot,'yes');assert.equal(roster[1].votingEligible,false);
await groups.action('admin','homes','resident','grant-vote');await groups.action('admin','homes','resident','grant-vote');
await assert.rejects(()=>cast(a.id,'resident','no'),/changed/,'Regrant does not allow another ballot');
a=await service.action(a.id,{userId:'admin',version:a.version,action:'unpublish'});
await assert.rejects(()=>cast(a.id,'resident','yes'),/not found/);
a=await service.save({...a,userId:'admin',deadlineIso:'2099-02-01T18:00:00Z'});
assert.equal(a.myBallot,null);
a=await service.action(a.id,{userId:'admin',version:a.version,action:'publish'});
assert.equal((await service.detail('resident',a.id)).myBallot,'yes');
console.log('PASS member right grant/revoke, admin/accepted-member gates, live eligibility, one final vote, persistence and unchanged cast ballots');
const dialogs=new DialogStore();let shown=roster[1];
const members=Object.create(Members.prototype);
Object.assign(members,{ownerRef:{ownerType:'community',ownerId:'homes'},viewOnlyMode:false,canManageMembers:true,communityUnderReview:false,
 dialogStore:dialogs,i18n:{translateParams:(key,{name})=>`${key}: ${name}`},
 confirmMemberAction:async(entry,action)=>{shown=(await groups.action('admin','homes',entry.userId,action)).members.find(m=>m.id===entry.id);}
});
for(const predicate of ['canLeaveScopedAssetBorrower','canShowMemberInvolvement','canToggleOrganizerParticipation','canPromoteAdmin','canRevokeAssetManager','canLeaveAssetOwner','canTakeOverAsset','canStepDownAdmin','canLeaveEvent','canApproveMember','canDeleteMember','canDisqualifyMember','canReinstateMember','canReportMember'])members[predicate]=()=>false;
for(const grantRight of [false,true]){
 const action=grantRight?'grantVote':'revokeVote';
 const item=members.memberActionMenuItems(shown).find(i=>i.context?.action===action);assert.ok(item);
 const before=shown.votingEligible;members.requestVotingRight(shown,grantRight);
 assert.equal(dialogs.dialog().confirmPalette,item.palette);assert.equal(shown.votingEligible,before);
 dialogs.cancel();assert.equal(shown.votingEligible,before);
 members.requestVotingRight(shown,grantRight);await dialogs.confirm();assert.equal(shown.votingEligible,grantRight);
 const card=Converter.convert(shown,{ownerType:'community',voterLabel:'Szavazó'});
 assert.equal(card.statusChip.icon,grantRight?'how_to_vote':'person');assert.equal(card.statusChip.label,grantRight?'Szavazó':null);
 assert.equal(card.statusChip.palette,grantRight?'violet':'green');
}
members.canManageMembers=false;assert.equal(members.memberActionMenuItems(shown).some(i=>['grantVote','revokeVote'].includes(i.context?.action)),false);
assert.equal(Converter.convert(shown,{ownerType:'event'}).statusChip.icon,'person','Other member types keep their existing badge');
console.log('PASS existing member menu, matching confirmation colors, cancellation, immediate localized Voter badge and unchanged unrelated roles');
const store=Object.create(Store.prototype);let changes=0,fail=false;
Object.assign(store,{dialogs,generation:0,userId:signal('admin'),groupId:signal('homes'),busy:signal(false),error:signal(''),changed:signal(null),editor:signal(null),
 service:{action:async(id,r)=>{if(fail)throw Error('announcement.changed');changes++;return {id,version:r.version+1,myBallot:r.choice};}}});
for(const [action,palette,choice] of [['unpublish','gold'],['trash','danger'],['close','red'],['vote','green','yes']]){
 const item={id:'confirm',version:0,title:'Confirm'},before=changes;
 await store.command(item,action,choice,palette);assert.equal(dialogs.dialog().confirmPalette,palette);assert.equal(changes,before);
 dialogs.cancel();assert.equal(changes,before);
 await store.command(item,action,choice,palette);await dialogs.confirm();assert.equal(changes,before+1);
}
fail=true;await store.command({id:'retry',version:0},'trash',undefined,'danger');await dialogs.confirm();assert.ok(dialogs.dialog()?.errorMessage);
fail=false;await dialogs.confirm();assert.equal(dialogs.dialog(),null,'A failed confirmation remains retryable');
const before=changes;await store.command({id:'stale',version:0},'trash',undefined,'danger');store.groupId.set('another');await dialogs.confirm();assert.equal(changes,before);
console.log('PASS critical announcement/vote confirmations, palette parity, cancel, failed-request retry and workspace-change guard');
