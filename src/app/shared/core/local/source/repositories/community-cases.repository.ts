import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import { COMMUNITY_BASE_GROUP_ID } from '../../../contracts/group-type';
import { COMMUNITY_CASES_TABLE_NAME, COMMUNITY_TASKS_TABLE_NAME, caseMembershipStatus, type CommunityCaseRecord, type CommunityTaskRecord } from '../entity/community-case.entity';

@Injectable({ providedIn: 'root' })
export class LocalCommunityCasesRepository {
  private readonly db = inject(LocalMemoryDb);
  ready(): Promise<void> { return this.db.whenReady(); }
  flush(): Promise<void> { return this.db.flushToIndexedDb(); }
  cases(): CommunityCaseRecord[] { const table = this.db.read()[COMMUNITY_CASES_TABLE_NAME]; return table.ids.map(id => table.byId[id]); }
  tasks(): CommunityTaskRecord[] { const table = this.db.read()[COMMUNITY_TASKS_TABLE_NAME]; return table.ids.map(id => table.byId[id]); }
  visibleCases(accountId: string, managedGroups: ReadonlySet<string>): CommunityCaseRecord[] {
    return this.cases().filter(c => c.baseGroupId === COMMUNITY_BASE_GROUP_ID
      && (c.participantAccountIds.includes(accountId) && caseMembershipStatus(c, accountId) !== 'removed'
        || !!c.communityId && managedGroups.has(c.communityId)));
  }
  countVisible(accountId: string, managedGroups: ReadonlySet<string>): number {
    return this.visibleCases(accountId, managedGroups).filter(c => c.status !== 'trash').length;
  }
  saveFeedback(id:string,feedback:NonNullable<CommunityCaseRecord['feedback']>,feedbackWork:CommunityCaseRecord['feedbackWork']):void {
    this.db.write(state=>{const table=state[COMMUNITY_CASES_TABLE_NAME],current=table.byId[id];if(!current)return state;
      return {...state,[COMMUNITY_CASES_TABLE_NAME]:{...table,byId:{...table.byId,[id]:{...current,feedback:structuredClone(feedback),feedbackWork:structuredClone(feedbackWork)}}}};
    });
  }
  countFeedback(accountId:string):number {return this.cases().filter(c=>c.baseGroupId==='myscoutee-community').reduce((n,c)=>n+(c.feedback??[]).filter(r=>r.viewerAccountId===accountId&&r.status==='pending').length,0);}
  findCase(id: string): CommunityCaseRecord | null { return this.db.read()[COMMUNITY_CASES_TABLE_NAME].byId[id] ?? null; }
  findTask(id: string): CommunityTaskRecord | null { return this.db.read()[COMMUNITY_TASKS_TABLE_NAME].byId[id] ?? null; }
  saveCase(record: CommunityCaseRecord, expectedVersion?: number): CommunityCaseRecord {
    this.db.write(state => {
      const table = state[COMMUNITY_CASES_TABLE_NAME];
      if (table.byId[record.id]?.version !== expectedVersion) throw new Error('case.changed');
      return { ...state, [COMMUNITY_CASES_TABLE_NAME]: { byId: { ...table.byId, [record.id]: structuredClone(record) },
        ids: table.byId[record.id] ? table.ids : [...table.ids, record.id] } };
    }); return record;
  }
  saveTask(record: CommunityTaskRecord, expectedVersion?: number): CommunityTaskRecord {
    this.db.write(state => {
      const table = state[COMMUNITY_TASKS_TABLE_NAME];
      if (table.byId[record.id]?.version !== expectedVersion) throw new Error('case.changed');
      return { ...state, [COMMUNITY_TASKS_TABLE_NAME]: { byId: { ...table.byId, [record.id]: structuredClone(record) },
        ids: table.byId[record.id] ? table.ids : [...table.ids, record.id] } };
    }); return record;
  }

}
