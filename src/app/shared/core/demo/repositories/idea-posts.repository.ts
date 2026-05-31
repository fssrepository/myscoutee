import { Injectable, inject } from '@angular/core';

import { AppMemoryDb } from '../../base/db';
import { IDEA_POSTS_TABLE_NAME, type DemoIdeaPostsTable } from '../models/idea-posts.model';

@Injectable({
  providedIn: 'root'
})
export class DemoIdeaPostsRepository {
  private readonly memoryDb = inject(AppMemoryDb);

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  readTable(): DemoIdeaPostsTable {
    return this.memoryDb.read()[IDEA_POSTS_TABLE_NAME];
  }

  updateTable(mutator: (table: DemoIdeaPostsTable) => DemoIdeaPostsTable): void {
    this.memoryDb.write(state => ({
      ...state,
      [IDEA_POSTS_TABLE_NAME]: mutator(state[IDEA_POSTS_TABLE_NAME])
    }));
  }

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }
}
