import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import { COMMUNITY_GROUPS_TABLE_NAME, CommunityGroupRecord } from '../entity/community-group.entity';
@Injectable({ providedIn: 'root' })
export class LocalCommunityGroupsRepository {
  private readonly db = inject(LocalMemoryDb);
  async ready(): Promise<void> { await this.db.whenReady(); }
  records(): CommunityGroupRecord[] {
    const table = this.db.read()[COMMUNITY_GROUPS_TABLE_NAME];
    return table.ids.map(id => table.byId[id]).filter(Boolean);
  }
  find(id: string): CommunityGroupRecord | null { return this.db.read()[COMMUNITY_GROUPS_TABLE_NAME].byId[id] ?? null; }
  save(record: CommunityGroupRecord): void {
    this.db.write(state => {
      const table = state[COMMUNITY_GROUPS_TABLE_NAME];
      return { ...state, [COMMUNITY_GROUPS_TABLE_NAME]: {
        byId: { ...table.byId, [record.id]: structuredClone(record) },
        ids: table.byId[record.id] ? table.ids : [...table.ids, record.id]
      } };
    });
  }
}
