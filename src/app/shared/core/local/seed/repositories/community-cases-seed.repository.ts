import { LocalChatsRepository } from '../../source/repositories/chats.repository';
import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import { COMMUNITY_CASES_TABLE_NAME, COMMUNITY_TASKS_TABLE_NAME } from '../../source/entity/community-case.entity';
import { SeedCommunityCasesBuilder } from '../builders/community-cases-seed.builder';

@Injectable({ providedIn: 'root' })
export class SeedCommunityCasesRepository {
  private readonly db = inject(LocalMemoryDb);
  private readonly chats = inject(LocalChatsRepository);
  seedDefaults(): boolean {
    const state = this.db.read(), records = SeedCommunityCasesBuilder.build(state.users.ids.map(id => state.users.byId[id]));
    const cases = records.cases.filter(c => !state[COMMUNITY_CASES_TABLE_NAME].byId[c.id]);
    const tasks = records.tasks.filter(t => !state[COMMUNITY_TASKS_TABLE_NAME].byId[t.id]);
    if (!cases.length && !tasks.length) return false;
    this.db.write(current => ({ ...current,
      [COMMUNITY_CASES_TABLE_NAME]: { byId: { ...current[COMMUNITY_CASES_TABLE_NAME].byId, ...Object.fromEntries(cases.map(c => [c.id, c])) }, ids: [...current[COMMUNITY_CASES_TABLE_NAME].ids, ...cases.map(c => c.id)] },
      [COMMUNITY_TASKS_TABLE_NAME]: { byId: { ...current[COMMUNITY_TASKS_TABLE_NAME].byId, ...Object.fromEntries(tasks.map(t => [t.id, t])) }, ids: [...current[COMMUNITY_TASKS_TABLE_NAME].ids, ...tasks.map(t => t.id)] }
    }));
    for (const c of cases) this.chats.syncCaseChat(c);
    return true;
  }
}
