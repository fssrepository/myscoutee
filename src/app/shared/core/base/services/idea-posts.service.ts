import { Injectable, inject, signal } from '@angular/core';

import { DemoIdeaPostsService } from '../../demo/services/idea-posts.service';
import { HttpIdeaPostsService } from '../../http/services/idea-posts.service';
import type { IdeaPost, IdeaPostSaveRequest } from '../models';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class IdeaPostsService extends BaseRouteModeService {
  private readonly demoIdeaPostsService = inject(DemoIdeaPostsService);
  private readonly httpIdeaPostsService = inject(HttpIdeaPostsService);
  private readonly postsRef = signal<IdeaPost[]>([]);
  private readonly adminPostsRef = signal<IdeaPost[]>([]);

  readonly posts = this.postsRef.asReadonly();
  readonly adminPosts = this.adminPostsRef.asReadonly();

  applyPublishedPosts(posts: readonly IdeaPost[]): void {
    this.postsRef.set(this.clonePosts(posts)
      .filter(post => post.published && !post.trashed)
      .sort((left, right) => this.sortValue(right) - this.sortValue(left)));
  }

  async loadPublishedPosts(): Promise<IdeaPost[]> {
    const posts = await this.ideaService().loadPublishedPosts();
    this.applyPublishedPosts(posts);
    return this.clonePosts(this.postsRef());
  }

  async loadAdminPosts(adminUserId: string): Promise<IdeaPost[]> {
    const posts = await this.ideaService().loadAdminPosts(adminUserId);
    const cloned = this.clonePosts(posts).sort((left, right) => this.sortValue(right) - this.sortValue(left));
    this.adminPostsRef.set(cloned);
    this.applyPublishedPosts(cloned.filter(post => post.published));
    return this.clonePosts(cloned);
  }

  async savePost(request: IdeaPostSaveRequest): Promise<IdeaPost> {
    const post = await this.ideaService().savePost(request);
    this.mergeAdminPost(post);
    return { ...post, imageUrls: [...post.imageUrls] };
  }

  async deletePost(postId: string, actorUserId: string): Promise<IdeaPost[]> {
    const posts = await this.ideaService().deletePost(postId, actorUserId);
    const cloned = this.clonePosts(posts).sort((left, right) => this.sortValue(right) - this.sortValue(left));
    this.adminPostsRef.set(cloned);
    this.applyPublishedPosts(cloned.filter(post => post.published));
    return this.clonePosts(cloned);
  }

  async restorePost(postId: string, actorUserId: string): Promise<IdeaPost> {
    const post = await this.ideaService().restorePost(postId, actorUserId);
    this.mergeAdminPost(post);
    return { ...post, imageUrls: [...post.imageUrls] };
  }

  async uploadImage(ownerId: string, entityId: string, file: File): Promise<{ uploaded: boolean; imageUrl: string | null }> {
    return this.ideaService().uploadImage(ownerId, entityId, file);
  }

  private mergeAdminPost(post: IdeaPost): void {
    const merged = this.clonePosts([
      ...this.adminPostsRef().filter(current => current.id !== post.id),
      post
    ]).sort((left, right) => this.sortValue(right) - this.sortValue(left));
    this.adminPostsRef.set(merged);
    this.applyPublishedPosts(merged.filter(current => current.published));
  }

  private ideaService(): DemoIdeaPostsService | HttpIdeaPostsService {
    return this.resolveRouteService('/ideas', this.demoIdeaPostsService, this.httpIdeaPostsService);
  }

  private clonePosts(posts: readonly IdeaPost[]): IdeaPost[] {
    return posts.map(post => ({ ...post, imageUrls: [...post.imageUrls] }));
  }

  private sortValue(post: Pick<IdeaPost, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'>): number {
    const parsed = Date.parse(post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
