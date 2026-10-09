import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../common/app.db';
import { RouteDelayService } from '../../../base/services/route-delay.service';
import { SeedUsersRepository } from '../../seed/repositories/users-seed.repository';
import { SeedCommunityGroupsRepository } from '../../seed/repositories/community-groups-seed.repository';
import { SeedCommunityAnnouncementsRepository } from '../../seed/repositories/community-announcements-seed.repository';
import { LocalCommunityAnnouncementsService } from './community-announcements.service';
import { LocalCommunityGroupsService } from './community-groups.service';
import { LocalChatsService } from './chats.service';
import { UserProfileStore } from '../../../../ui/context/stores/user-profile.store';
import { COMMUNITY_BASE_GROUP_ID } from '../../../contracts/group-type';

describe('Community announcements, member voting and notifications', () => {
  let db:LocalMemoryDb, service:LocalCommunityAnnouncementsService, alex:string, maya:string, provider:string;
  const group='community-riverside', vote='riverside-roof-vote';
  const notices=()=>Object.values(db.read().notifications.byId);
  beforeEach(async()=>{
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-05T10:00:00Z'));
    TestBed.configureTestingModule({providers:[{provide:RouteDelayService,useValue:{waitForRouteDelay:async()=>undefined}}]});
    db=TestBed.inject(LocalMemoryDb);await db.resetStorage();
    const users=TestBed.inject(SeedUsersRepository).seedDefaults();TestBed.inject(SeedCommunityGroupsRepository).seedDefaults(users);
    TestBed.inject(SeedCommunityAnnouncementsRepository).seedDefaults();
    const id=(name:string)=>users.find(u=>u.name===name&&!u.workspaceGroupId)!.id;
    alex=id('Alex Turner');maya=id('Maya Stone');provider=id('Farkas Anna');service=TestBed.inject(LocalCommunityAnnouncementsService);
  });
  afterEach(()=>{TestBed.resetTestingModule();vi.useRealTimers();});
  it('keeps private drafts and voting rights admin-only and denies external providers',async()=>{
    const query={page:0,pageSize:20,filters:{communityId:group,status:'draft' as const}};
    expect((await service.page(alex,query)).items).toHaveLength(1);
    await expect(service.page(maya,query)).rejects.toThrow();
    await expect(service.detail(provider,vote)).rejects.toThrow();
    await expect(TestBed.inject(LocalCommunityGroupsService).action(maya,group,maya,'grant-vote')).rejects.toThrow();
  });
  it('records one final vote per eligible member and notifies only other managers',async()=>{
    const a=await service.detail(maya,vote);
    const result=await service.action(a.id,{userId:maya,version:a.version,action:'vote',choice:'yes'});
    expect(result.results).toEqual({yes:1,no:0,abstain:0});expect(result.castVotes).toBe(1);expect(result.eligibleMembers).toBe(3);
    expect(result.canVote).toBe(true);expect(result.myBallot).toBe('yes');
    expect(notices().filter(n=>n.kind==='announcement-voted').map(n=>n.recipientUserId)).toEqual([alex]);
    expect(notices()[0].payload?.['workspaceGroupId']).toBe(group);
    await expect(service.action(a.id,{userId:maya,version:result.version,action:'vote',choice:'no'})).rejects.toThrow();
    await expect(service.action(a.id,{userId:maya,version:result.version,action:'vote',choice:'yes'})).rejects.toThrow();
  });
  it('preserves final ballots after revocation and reopening, and sends one automatic closure notification per recipient',async()=>{
    let a=await service.detail(maya,vote);
    a=await service.action(a.id,{userId:maya,version:a.version,action:'vote',choice:'yes'});
    await TestBed.inject(LocalCommunityGroupsService).action(alex,group,maya,'revoke-vote');
    expect((await service.detail(maya,vote)).canVote).toBe(false);
    expect(await service.closeDue('myscoutee-work',new Date('2026-11-02'))).toBe(0);
    expect(await service.closeDue(COMMUNITY_BASE_GROUP_ID,new Date('2026-11-02'))).toBe(2);
    expect([...new Set(notices().filter(n=>n.kind==='announcement-closed').map(n=>n.sourceId))].sort())
      .toEqual(['park-meter-vote', vote].sort());
    expect(notices().filter(n=>n.kind==='announcement-closed'&&n.sourceId===vote)).toHaveLength(4);
    expect(notices().filter(n=>n.kind==='announcement-closed').some(n=>n.recipientUserId===alex)).toBe(true);
    expect(await service.closeDue(COMMUNITY_BASE_GROUP_ID,new Date('2026-11-02'))).toBe(0);
    const closed=await service.detail(alex,vote);
    const reopened=await service.save({...closed,userId:alex,deadlineIso:'2099-01-01T18:00:00Z'});
    expect(reopened.closed).toBe(false);expect(reopened.results.yes).toBe(1);expect(reopened.eligibleMembers).toBe(3);
    expect(notices().filter(n=>n.kind==='announcement-reopened').some(n=>n.recipientUserId===alex)).toBe(false);
    await expect(service.save({...reopened,userId:alex,voting:false})).rejects.toThrow();
  });
  it('publishes to accepted members only and does not notify the publishing admin',async()=>{
    const a=await service.detail(alex,'riverside-draft');
    await service.action(a.id,{userId:alex,version:a.version,action:'publish'});
    const recipients=notices().filter(n=>n.sourceId===a.id).map(n=>n.recipientUserId);
    expect(recipients).toHaveLength(3);expect(recipients).toContain(maya);expect(recipients).not.toContain(alex);expect(recipients).not.toContain(provider);
  });
  it('opens the existing group support conversation without creating app support or a notification until a message is sent',async()=>{
    const profile=TestBed.inject(UserProfileStore),chats=TestBed.inject(LocalChatsService);
    const user=`group:${group}:${maya}`,admin=`group:${group}:${alex}`;profile.setActiveUserId(user);
    const chat=(await chats.ensureServiceChat({serviceContext:'groupSupport',announcementId:vote,targetUserId:'',title:'',lastMessage:''}))!;
    expect(chat.id).toBe(`c-moderation-group-${user}`);expect(chat.memberIds).toEqual([user,admin]);expect(chat.channelType).toBe('groupSupport');expect(notices()).toHaveLength(0);
    await chats.sendChatMessage(chat,'Could you explain the roof proposal?','feedback-1');
    expect(notices().filter(n=>n.kind==='chat-message').map(n=>n.recipientUserId)).toEqual([alex]);
    expect(notices()[0].payload?.['workspaceGroupId']).toBe(group);
  });
  it('persists final ballots without overwriting them during demo reseeding',async()=>{
    const a=await service.detail(maya,vote);
    await service.action(a.id,{userId:maya,version:a.version,action:'vote',choice:'abstain'});
    await db.flushToIndexedDb();
    const snapshot=db.read();expect(snapshot.communityAnnouncements.byId[vote].ballots).toHaveLength(1);
    // Re-seeding never replaces an edited or voted record.
    TestBed.inject(SeedCommunityAnnouncementsRepository).seedDefaults();
    expect((await service.detail(maya,vote)).myBallot).toBe('abstain');
  });
});
