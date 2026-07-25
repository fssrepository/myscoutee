import { IDEA_POSTS_TABLE_NAME } from '../entity/content.entity';
import type { IdeaPostsTable } from '../entity/content.entity';
import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import type {
  IdeaPostAdminCountsDto,
  IdeaPostAdminPageQueryDto,
  IdeaPostDto,
  IdeaPostPublicPageQueryDto
} from '../../../contracts/content.interface';
import type {
  LocalIdeaPostAdminRecordPage,
  LocalIdeaPostRecordPage
} from '../mappers';

interface IdeaPostAdminCursor {
  id: string;
  submittedAtMs: number;
}


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

  createPostId(): string {
    return `idea-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  savePostSnapshot(record: IdeaPostDto): IdeaPostDto {
    let saved = record;
    this.updateTable(table => {
      const existing = table.byId[record.id];
      saved = existing
        ? {
            ...record,
            submittedAtIso: record.submittedAtIso || existing.submittedAtIso || record.updatedAtIso,
            createdAtIso: existing.createdAtIso || record.createdAtIso,
            createdByUserId: existing.createdByUserId || record.createdByUserId
          }
        : {
            ...record,
            submittedAtIso: record.submittedAtIso || record.updatedAtIso
          };
      return {
        ...table,
        seeded: true,
        byId: {
          ...table.byId,
          [saved.id]: saved
        },
        ids: [...new Set([...table.ids.filter(id => id !== saved.id), saved.id])]
      };
    });
    return saved;
  }

  async flushToIndexedDb(): Promise<void> {
    await this.persist();
  }

  queryPublishedPostPage(
    lang: string,
    query: IdeaPostPublicPageQueryDto = {}
  ): LocalIdeaPostRecordPage {
    const requestedLang = this.normalizeLang(lang);
    const cursor = this.pageCursor(query.cursor, requestedLang);
    const effectiveLang = cursor?.lang ?? requestedLang;
    const records = this.publishedPosts(effectiveLang);
    const pageSize = Math.max(1, Math.min(50, Math.trunc(Number(query.pageSize) || 10)));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const startIndex = Math.min(records.length, cursor?.offset ?? page * pageSize);
    const endIndex = Math.min(records.length, startIndex + pageSize);
    return {
      records: records.slice(startIndex, endIndex),
      total: records.length,
      nextCursor: endIndex < records.length ? `${effectiveLang}:${endIndex}` : null
    };
  }

  queryAdminPostPage(
    lang: string,
    query: IdeaPostAdminPageQueryDto = {}
  ): LocalIdeaPostAdminRecordPage {
    const normalizedLang = this.normalizeLang(lang);
    const status = this.normalizeAdminStatus(query.status);
    const allPosts = this.posts(normalizedLang);
    const filtered = allPosts.filter(post => this.matchesAdminStatus(post, status));
    const cursor = this.parseAdminCursor(query.cursor);
    const remaining = cursor
      ? filtered.filter(post => this.compareAdminPostToCursor(post, cursor) > 0)
      : filtered;
    const limit = Math.max(1, Math.trunc(Number(query.pageSize) || 10));
    const records = remaining.slice(0, limit);
    const nextCursor = remaining.length > limit && records.length > 0
      ? this.serializeAdminCursor(this.buildAdminCursor(records[records.length - 1]))
      : null;
    return {
      records,
      total: filtered.length,
      nextCursor,
      counts: this.countAdminPosts(allPosts)
    };
  }

  queryPublishedFeaturedPostPreview(
    lang: string,
    limit = 8
  ): LocalIdeaPostRecordPage {
    const published = this.publishedPosts(lang);
    const normalizedLimit = Math.max(1, Math.trunc(Number(limit) || 8));
    return {
      records: published
        .filter(post => post.featured === true)
        .slice(0, normalizedLimit),
      total: published.length,
      nextCursor: null
    };
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

  private publishedPosts(lang: string): IdeaPostDto[] {
    return this.posts(lang)
      .filter(post => post.published === true && post.trashed !== true)
      .sort((left, right) => this.compareAdminPosts(left, right));
  }

  private posts(lang: string): IdeaPostDto[] {
    const normalizedLang = this.normalizeLang(lang);
    const table = this.readTable();
    return table.ids
      .map(id => table.byId[id])
      .filter((post): post is IdeaPostDto => Boolean(post))
      .filter(post => `${post.lang ?? ''}`.trim().toLowerCase().split('-')[0] === normalizedLang)
      .sort((left, right) => this.compareAdminPosts(left, right));
  }

  private compareAdminPosts(left: IdeaPostDto, right: IdeaPostDto): number {
    const dateOrder = this.sortValue(right) - this.sortValue(left);
    return dateOrder || right.id.localeCompare(left.id);
  }

  private compareAdminPostToCursor(post: IdeaPostDto, cursor: IdeaPostAdminCursor): number {
    const dateOrder = cursor.submittedAtMs - this.sortValue(post);
    return dateOrder || cursor.id.localeCompare(post.id);
  }

  private buildAdminCursor(post: IdeaPostDto): IdeaPostAdminCursor {
    return {
      id: post.id,
      submittedAtMs: this.sortValue(post)
    };
  }

  private serializeAdminCursor(cursor: IdeaPostAdminCursor): string {
    return JSON.stringify(cursor);
  }

  private parseAdminCursor(value: string | null | undefined): IdeaPostAdminCursor | null {
    const normalized = value?.trim() ?? '';
    if (!normalized) {
      return null;
    }
    try {
      const parsed = JSON.parse(normalized) as Partial<IdeaPostAdminCursor>;
      if (typeof parsed.id !== 'string' || !parsed.id.trim() || !Number.isFinite(parsed.submittedAtMs)) {
        return null;
      }
      return {
        id: parsed.id.trim(),
        submittedAtMs: Math.trunc(Number(parsed.submittedAtMs))
      };
    } catch {
      return null;
    }
  }

  private matchesAdminStatus(post: IdeaPostDto, status: string): boolean {
    if (status === 'trashed') {
      return post.trashed === true;
    }
    if (post.trashed) {
      return false;
    }
    if (status === 'featured') {
      return post.featured === true;
    }
    if (status === 'published') {
      return post.published === true;
    }
    if (status === 'drafts') {
      return post.published === false;
    }
    return true;
  }

  private countAdminPosts(posts: readonly IdeaPostDto[]): IdeaPostAdminCountsDto {
    return posts.reduce<IdeaPostAdminCountsDto>((counts, post) => {
      if (post.trashed) {
        counts.trashed += 1;
        return counts;
      }
      counts.all += 1;
      if (post.featured) {
        counts.featured += 1;
      }
      if (post.published) {
        counts.published += 1;
      } else {
        counts.drafts += 1;
      }
      return counts;
    }, {
      all: 0,
      featured: 0,
      published: 0,
      drafts: 0,
      trashed: 0
    });
  }

  private normalizeAdminStatus(value: string | null | undefined): string {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    switch (normalized) {
      case 'featured':
      case 'published':
      case 'drafts':
      case 'trashed':
        return normalized;
      case 'draft':
        return 'drafts';
      case 'trash':
        return 'trashed';
      default:
        return 'all';
    }
  }

  private sortValue(post: Pick<IdeaPostDto, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'>): number {
    const parsed = Date.parse(post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private pageCursor(
    cursor: string | null | undefined,
    requestedLang: string
  ): { lang: string; offset: number } | null {
    const normalized = `${cursor ?? ''}`.trim();
    if (!normalized) {
      return null;
    }
    const separatorIndex = normalized.indexOf(':');
    const cursorLang = separatorIndex > 0
      ? this.supportedLang(normalized.slice(0, separatorIndex))
      : requestedLang;
    if (!cursorLang) {
      return null;
    }
    const offsetValue = separatorIndex > 0 ? normalized.slice(separatorIndex + 1) : normalized;
    const offset = Math.trunc(Number(offsetValue));
    const sameLanguage = cursorLang === requestedLang;
    const englishFallback = requestedLang !== 'en' && cursorLang === 'en';
    if (!Number.isFinite(offset) || offset < 0 || (!sameLanguage && !englishFallback)) {
      return null;
    }
    return { lang: cursorLang, offset };
  }

  private normalizeLang(lang: string | null | undefined): string {
    return this.supportedLang(lang) ?? 'en';
  }

  private supportedLang(lang: string | null | undefined): string | null {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return normalized === 'hu' || normalized === 'en' ? normalized : null;
  }
}
