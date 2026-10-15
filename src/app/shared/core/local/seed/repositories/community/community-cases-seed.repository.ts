import { LocalCommunityCasesRepository } from '../../../source/repositories/community/community-cases.repository';
import { LocalChatsRepository } from '../../../source/repositories/chat/chats.repository';
import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../../common/app.db';
import { COMMUNITY_CASES_TABLE_NAME, COMMUNITY_TASKS_TABLE_NAME } from '../../../source/entity/community/community-case.entity';
import { SeedCommunityCasesBuilder } from '../../builders/community/community-cases-seed.builder';

@Injectable({ providedIn: 'root' })
export class SeedCommunityCasesRepository {
  private readonly db = inject(LocalMemoryDb);
  private readonly chats = inject(LocalChatsRepository);
  seedDefaults(): boolean {
    const state = this.db.read(), records = SeedCommunityCasesBuilder.build(state.users.ids.map(id => state.users.byId[id]));
    const cases = records.cases.filter(c => !state[COMMUNITY_CASES_TABLE_NAME].byId[c.id]);
    const tasks = records.tasks.filter(t => !state[COMMUNITY_TASKS_TABLE_NAME].byId[t.id]);
    const retained = state[COMMUNITY_CASES_TABLE_NAME].ids.map(id => state[COMMUNITY_CASES_TABLE_NAME].byId[id]).filter(c => !c.counterOwners || !c.feedbackCounterBuckets);
    const retainedTasks = state[COMMUNITY_TASKS_TABLE_NAME].ids.map(id => state[COMMUNITY_TASKS_TABLE_NAME].byId[id]).filter(t => !t.counterOwners);
    if (!cases.length && !tasks.length && !retained.length && !retainedTasks.length) return false;
    this.db.write(current => {
      const next = [...retained, ...cases].reduce((value, c) => LocalCommunityCasesRepository.withCounterWrite(value, c), current);
      return [...retainedTasks, ...tasks].reduce((value, t) => LocalCommunityCasesRepository.withTaskCounterWrite(value, t), next);
    });
    for (const c of cases) this.chats.syncCaseChat(c);
    return true;
  }
}
