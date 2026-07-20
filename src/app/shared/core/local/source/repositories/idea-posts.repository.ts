import { IDEA_POSTS_TABLE_NAME } from '../entity/content.entity';
import type { IdeaPostsTable } from '../entity/content.entity';
import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import type {
  IdeaPostDto,
  IdeaPostPublicPageQueryDto
} from '../../../contracts/content.interface';
import type { LocalIdeaPostRecordPage } from '../mappers';


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
    const normalizedLang = this.normalizeLang(lang);
    const table = this.readTable();
    return table.ids
      .map(id => table.byId[id])
      .filter((post): post is IdeaPostDto => Boolean(post))
      .filter(post => post.published === true && post.trashed !== true)
      .filter(post => `${post.lang ?? ''}`.trim().toLowerCase().split('-')[0] === normalizedLang)
      .sort((left, right) => this.comparePublishedPosts(left, right));
  }

  private comparePublishedPosts(left: IdeaPostDto, right: IdeaPostDto): number {
    const dateOrder = this.sortValue(right) - this.sortValue(left);
    return dateOrder || right.id.localeCompare(left.id);
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
