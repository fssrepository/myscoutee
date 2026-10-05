import { baseGroupId, groupType, isBaseGroupId } from '../../../contracts/group-type';
import { HELP_CENTER_TABLE_NAME } from '../entity/content.entity';
import type { HelpCenterTable } from '../entity/content.entity';
import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';


@Injectable({
  providedIn: 'root'
})
export class LocalHelpCenterRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  accountForUser(userId: string): string {
    return this.memoryDb.read().users.byId[userId]?.accountUserId || userId.trim();
  }

  groupForUser(userId: string): string | null {
    const workspaceId = this.memoryDb.read().users.byId[userId]?.workspaceGroupId;
    if (!workspaceId) return null;
    const group = this.memoryDb.read().communityGroups.byId[workspaceId];
    return isBaseGroupId(workspaceId) ? workspaceId! : baseGroupId(groupType(group?.groupType));
  }

  readTable(groupId: string | null = null): HelpCenterTable {
    const root = this.memoryDb.read()[HELP_CENTER_TABLE_NAME];
    if (!groupId) { const { baseGroups: _groups, ...table } = root; return table; }
    const table = root.baseGroups?.[groupId];
    if (!table) throw new Error('Demo group content is not bootstrapped.');
    return table;
  }

  updateTable(mutator: (table: HelpCenterTable) => HelpCenterTable, groupId: string | null = null): void {
    this.memoryDb.write(state => ({
      ...state,
      [HELP_CENTER_TABLE_NAME]: groupId
        ? { ...state[HELP_CENTER_TABLE_NAME], baseGroups: { ...state[HELP_CENTER_TABLE_NAME].baseGroups,
            [groupId]: mutator(this.readTable(groupId)) } }
        : { ...mutator(this.readTable()), baseGroups: state[HELP_CENTER_TABLE_NAME].baseGroups }
    }));
  }

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }
}
