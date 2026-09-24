import '@angular/compiler';
import { createEnvironmentInjector, runInInjectionContext, type EnvironmentInjector } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { LocalMemoryDb } from '../../../common/app.db';
import { LocalEventsRepository } from './events.repository';
import { LocalActivityMembersRepository } from './activity-members.repository';
import { LocalUsersRepository } from './users.repository';
import { EVENTS_TABLE_NAME } from '../entity/event.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import { ACTIVITY_MEMBERS_TABLE_NAME } from '../entity/activity.entity';
import { renderCalendarExport } from '../../../common/calendar-export';
import type { ActivityEventRecord, ActivityEventDTO } from '../../../contracts/activity.interface';

describe('Local calendar occurrence memberships', () => {
  it.each(['One-time', 'Daily', 'Weekly'] as const)('exports concrete %s occurrences without inheriting parent attendance', frequency => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2030-04-18T10:00:00Z'));
    const start = frequency === 'One-time' ? '2030-04-18T12:00:00Z' : '2030-04-17T12:00:00Z';
    const occurrence = frequency === 'Weekly' ? '2030-04-24T12:00:00Z' : '2030-04-18T12:00:00Z';
    const slotId = `parent:slot:first:${new Date(occurrence).toISOString()}`;
    const parent = { id:'parent',userId:'owner',creatorUserId:'owner',organizerUserId:'owner',type:'hosting',
      status:'A',title:'Calendar slots',location:'Austin',mode:'Casual',frequency,
      startAtIso:start,endAtIso:frequency==='One-time'?'2030-04-18T18:00:00Z':'2030-07-10T18:00:00Z',
      slotsEnabled:true,subEventsEnabled:true,acceptedMemberUserIds:['owner','viewer'],
      slotTemplates:[{id:'first',startAt:start,subEventDefinitions:[{id:'stage',name:'Activity',durationMinutes:60}]},
        {id:'second',startAt:start.replace('12:','14:'),subEventDefinitions:[{id:'stage',name:'Activity',durationMinutes:60}]}]
    } as ActivityEventRecord;
    const members = ['parent',slotId].map((ownerId,i)=>({id:`member-${i}`,ownerId,ownerType:'event',ownerKey:`event:${ownerId}`,userId:'viewer',status:'accepted'}));
    const state = {
      [EVENTS_TABLE_NAME]:{ids:['owner:hosting:parent'],byId:{'owner:hosting:parent':parent}},
      [USERS_TABLE_NAME]:{ids:[],byId:{}},
      [ACTIVITY_MEMBERS_TABLE_NAME]:{ids:members.map(m=>m.id),byId:Object.fromEntries(members.map(m=>[m.id,m])),idsByOwnerKey:Object.fromEntries(members.map(m=>[m.ownerKey,[m.id]]))}
    };
    const injector=createEnvironmentInjector([
      {provide:LocalMemoryDb,useValue:{read:()=>state}},
      {provide:LocalUsersRepository,useValue:{}},LocalActivityMembersRepository,LocalEventsRepository
    ],null as unknown as EnvironmentInjector);
    try {
      const repository=runInInjectionContext(injector,()=>new LocalEventsRepository());
      const records=repository.queryCalendarItemsByUser('viewer');
      expect(records.some(r=>r.id==='parent')).toBe(false);
      expect(records.filter(r=>r.currentUserMembershipStatus==='accepted').map(r=>r.id)).toEqual([slotId]);
      const text=renderCalendarExport('viewer',records as unknown as ActivityEventDTO[],new Date('2030-04-18T10:00:00Z'));
      expect(text.match(/\r\nBEGIN:VEVENT\r\n/g)).toHaveLength(1);
      expect(text).toContain(`DTSTART:${occurrence.replace(/[-:]/g,'')}`);
      expect(repository.queryCalendarItemsByUser('owner').length).toBeGreaterThan(1);
      expect(Object.keys(state[EVENTS_TABLE_NAME].byId)).toHaveLength(1);
      const again = renderCalendarExport('viewer',repository.queryCalendarItemsByUser('viewer') as unknown as ActivityEventDTO[],new Date('2030-04-18T10:00:00Z'));
      expect(again).toBe(text);
      if (frequency === 'Daily') expect(records.some(r=>r.startAtIso.startsWith('2030-07-10'))).toBe(true);
      members[1].status = 'pending';
      expect(repository.queryCalendarItemsByUser('viewer').some(r=>r.currentUserMembershipStatus==='accepted')).toBe(false);
      members[1].status = 'accepted';
      const secondId = slotId.replace(':first:', ':second:').replace('T12:', 'T14:');
      const second = { ...members[1], id:'member-second',ownerId:secondId,ownerKey:`event:${secondId}` };
      Object.assign(state[ACTIVITY_MEMBERS_TABLE_NAME].byId,{[second.id]:second});
      state[ACTIVITY_MEMBERS_TABLE_NAME].ids.push(second.id);
      state[ACTIVITY_MEMBERS_TABLE_NAME].idsByOwnerKey[second.ownerKey]=[second.id];
      expect(repository.queryCalendarItemsByUser('viewer').filter(r=>r.currentUserMembershipStatus==='accepted')).toHaveLength(2);
      members[1].status = 'deleted';
      expect(repository.queryCalendarItemsByUser('viewer').filter(r=>r.currentUserMembershipStatus==='accepted').map(r=>r.id)).toEqual([secondId]);
      parent.cancelled = true;
      expect(repository.queryCalendarItemsByUser('owner')).toEqual([]);
    } finally { injector.destroy();vi.restoreAllMocks(); }
  });
});
