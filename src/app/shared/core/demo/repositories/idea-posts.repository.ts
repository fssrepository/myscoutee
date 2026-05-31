import { Injectable, inject } from '@angular/core';

import { AppMemoryDb } from '../../base/db';
import type { IdeaPost } from '../../base/models';
import { DemoIdeaPostsSeedBuilder } from '../builders';
import { IDEA_POSTS_TABLE_NAME, type DemoIdeaPostsTable } from '../models/idea-posts.model';

@Injectable({
  providedIn: 'root'
})
export class DemoIdeaPostsRepository {
  private static readonly PERSIST_TIMEOUT_MS = 1500;
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

  seedDefaults(): boolean {
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
    return true;
  }

  assertSeeded(): void {
    if (this.readTable().seeded !== true) {
      throw new Error('Demo idea posts are not bootstrapped.');
    }
  }

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  async persistBestEffort(timeoutMs = DemoIdeaPostsRepository.PERSIST_TIMEOUT_MS): Promise<void> {
    try {
      await Promise.race([
        this.flushToIndexedDb(),
        new Promise<void>(resolve => globalThis.setTimeout(resolve, timeoutMs))
      ]);
    } catch {
      // Demo content still exists in memory even when browser storage is temporarily unavailable.
    }
  }

  private clonePost(post: IdeaPost): IdeaPost {
    return {
      ...post,
      imageUrls: [...post.imageUrls]
    };
  }
}
