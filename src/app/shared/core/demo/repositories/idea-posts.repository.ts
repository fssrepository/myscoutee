import { Injectable, inject } from '@angular/core';

import { DemoMemoryDb } from '../../base/db';
import type { IdeaPost } from '../../base/models';
import { DemoIdeaPostsSeedBuilder } from '../builders';
import { IDEA_POSTS_TABLE_NAME, type DemoIdeaPostsTable } from '../models/idea-posts.model';

@Injectable({
  providedIn: 'root'
})
export class DemoIdeaPostsRepository {
  private readonly memoryDb = inject(DemoMemoryDb);

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

  async seedDefaults(): Promise<boolean> {
    const table = this.readTable();
    const defaultPosts = DemoIdeaPostsSeedBuilder.buildDefaultPosts();
    const missingPosts = defaultPosts.filter(post => !table.byId[post.id]);
    if (missingPosts.length === 0 && table.seeded === true) {
      return false;
    }
    this.updateTable(current => ({
      seeded: true,
      byId: {
        ...current.byId,
        ...Object.fromEntries(missingPosts.map(post => [post.id, this.clonePost(post)]))
      },
      ids: [...new Set([...current.ids, ...missingPosts.map(post => post.id)])]
    }));
    await this.persist();
    return true;
  }

  assertSeeded(): void {
    if (this.readTable().seeded !== true) {
      throw new Error('Demo idea posts are not bootstrapped.');
    }
  }

  async updateTableAndPersist(mutator: (table: DemoIdeaPostsTable) => DemoIdeaPostsTable): Promise<void> {
    this.updateTable(mutator);
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  private clonePost(post: IdeaPost): IdeaPost {
    return {
      ...post,
      imageUrls: [...post.imageUrls]
    };
  }
}
