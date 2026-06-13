import { IDEA_POSTS_TABLE_NAME } from '../entity/content.entity';
import type { IdeaPostsTable } from '../entity/content.entity';
import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';


@Injectable({
  providedIn: 'root'
})
export class LocalIdeaPostsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  readTable(): IdeaPostsTable {
    return this.memoryDb.read()[IDEA_POSTS_TABLE_NAME];
  }

  updateTable(mutator: (table: IdeaPostsTable) => IdeaPostsTable): void {
    this.memoryDb.write(state => ({
      ...state,
      [IDEA_POSTS_TABLE_NAME]: mutator(state[IDEA_POSTS_TABLE_NAME])
    }));
  }

  async updateTableAndPersist(mutator: (table: IdeaPostsTable) => IdeaPostsTable): Promise<void> {
    this.updateTable(mutator);
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }
}
