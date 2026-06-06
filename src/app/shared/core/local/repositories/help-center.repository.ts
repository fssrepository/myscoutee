import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../base/db';
import { HELP_CENTER_TABLE_NAME, type HelpCenterTable } from '../../base/models/help-center.model';

@Injectable({
  providedIn: 'root'
})
export class LocalHelpCenterRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  readTable(): HelpCenterTable {
    return this.memoryDb.read()[HELP_CENTER_TABLE_NAME];
  }

  updateTable(mutator: (table: HelpCenterTable) => HelpCenterTable): void {
    this.memoryDb.write(state => ({
      ...state,
      [HELP_CENTER_TABLE_NAME]: mutator(state[HELP_CENTER_TABLE_NAME])
    }));
  }

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }
}
