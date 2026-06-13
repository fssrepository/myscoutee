import { IDEA_POSTS_TABLE_NAME } from '../../source/entity/content.entity';
import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import type { IdeaPostDto } from '../../../contracts/content.interface';

import { SeedIdeaPostsBuilder } from '../builders';

@Injectable({
  providedIn: 'root'
})
export class SeedIdeaPostsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async seedDefaults(): Promise<boolean> {
    await this.memoryDb.whenReady();
    const table = this.memoryDb.read()[IDEA_POSTS_TABLE_NAME];
    const defaultPosts = SeedIdeaPostsBuilder.buildDefaultPosts();
    const missingPosts = defaultPosts.filter(post => !table.byId[post.id]);
    if (missingPosts.length === 0 && table.seeded === true) {
      return false;
    }

    this.memoryDb.write(state => ({
      ...state,
      [IDEA_POSTS_TABLE_NAME]: {
        seeded: true,
        byId: {
          ...state[IDEA_POSTS_TABLE_NAME].byId,
          ...Object.fromEntries(missingPosts.map(post => [post.id, this.clonePost(post)]))
        },
        ids: [...new Set([
          ...state[IDEA_POSTS_TABLE_NAME].ids,
          ...missingPosts.map(post => post.id)
        ])]
      }
    }));
    await this.memoryDb.flushToIndexedDb();
    return true;
  }

  private clonePost(post: IdeaPostDto): IdeaPostDto {
    return {
      ...post,
      imageUrls: [...post.imageUrls]
    };
  }
}
