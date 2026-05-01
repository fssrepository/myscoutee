import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { IdeaPost, IdeaPostSaveRequest } from '../../base/models';
import { HttpMediaService } from './media.service';

@Injectable({
  providedIn: 'root'
})
export class HttpIdeaPostsService {
  private readonly http = inject(HttpClient);
  private readonly media = inject(HttpMediaService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadPublishedPosts(): Promise<IdeaPost[]> {
    const response = await this.http
      .get<{ ideas?: Array<Partial<IdeaPost>> | null } | null>(`${this.apiBaseUrl}/landing/content`)
      .toPromise();
    return this.normalizePosts(response?.ideas);
  }

  async loadAdminPosts(adminUserId: string): Promise<IdeaPost[]> {
    const response = await this.http
      .get<Array<Partial<IdeaPost>> | null>(`${this.apiBaseUrl}/admin/ideas`, {
        params: adminUserId.trim() ? { adminUserId: adminUserId.trim() } : {}
      })
      .toPromise();
    return this.normalizePosts(response);
  }

  async savePost(request: IdeaPostSaveRequest): Promise<IdeaPost> {
    const response = await this.http
      .post<Partial<IdeaPost> | null>(`${this.apiBaseUrl}/admin/ideas`, request)
      .toPromise();
    const post = this.normalizePost(response);
    if (!post) {
      throw new Error('Idea post could not be saved.');
    }
    return post;
  }

  async deletePost(postId: string, actorUserId: string): Promise<IdeaPost[]> {
    const response = await this.http
      .request<Array<Partial<IdeaPost>> | null>(
        'delete',
        `${this.apiBaseUrl}/admin/ideas/${encodeURIComponent(postId)}`,
        { body: { actorUserId } }
      )
      .toPromise();
    return this.normalizePosts(response);
  }

  async uploadImage(ownerId: string, entityId: string, file: File): Promise<{ uploaded: boolean; imageUrl: string | null }> {
    return this.media.uploadImage('idea', ownerId, entityId, file);
  }

  normalizePosts(value: Array<Partial<IdeaPost>> | null | undefined): IdeaPost[] {
    return (Array.isArray(value) ? value : [])
      .map(post => this.normalizePost(post))
      .filter((post): post is IdeaPost => Boolean(post))
      .sort((left, right) => this.sortValue(right) - this.sortValue(left));
  }

  normalizePost(value: Partial<IdeaPost> | null | undefined): IdeaPost | null {
    const id = `${value?.id ?? ''}`.trim();
    const title = `${value?.title ?? ''}`.trim();
    const contentHtml = `${value?.contentHtml ?? ''}`.trim();
    if (!id || !title || !contentHtml) {
      return null;
    }
    const imageUrls = Array.from(new Set(
      (Array.isArray(value?.imageUrls) ? value.imageUrls : [])
        .map(imageUrl => `${imageUrl ?? ''}`.trim())
        .filter(Boolean)
    ));
    const imageUrl = `${value?.imageUrl ?? ''}`.trim() || imageUrls[0] || '';
    if (imageUrl && !imageUrls.includes(imageUrl)) {
      imageUrls.unshift(imageUrl);
    }
    return {
      id,
      title,
      excerpt: `${value?.excerpt ?? ''}`.trim() || this.excerptFromHtml(contentHtml),
      contentHtml,
      imageUrl,
      imageUrls,
      featured: value?.featured === true,
      published: value?.published !== false,
      submittedAtIso: `${value?.submittedAtIso ?? value?.updatedAtIso ?? value?.createdAtIso ?? ''}`.trim(),
      createdAtIso: `${value?.createdAtIso ?? ''}`.trim(),
      createdByUserId: `${value?.createdByUserId ?? ''}`.trim(),
      updatedAtIso: `${value?.updatedAtIso ?? value?.createdAtIso ?? ''}`.trim(),
      updatedByUserId: `${value?.updatedByUserId ?? value?.createdByUserId ?? ''}`.trim()
    };
  }

  private excerptFromHtml(value: string): string {
    const text = `${value ?? ''}`.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length <= 180 ? text : `${text.slice(0, 179).trim()}...`;
  }

  private sortValue(post: Pick<IdeaPost, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'>): number {
    const parsed = Date.parse(post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
