import SUPPORTED_CONTENT_LANGUAGES from '../../../../common/content-languages.json';
import { sanitizeHtml } from '../../../../base/html-sanitizer';
import { normalizeImageDetails } from '../../../../contracts/media/image-gallery.interface';
import type {
  IdeaPostAdminCountsDto,
  IdeaPostAdminPageResultDto,
  IdeaPostDto,
  IdeaPostPublicPageResultDto,
  IdeaPostSaveRequestDto
} from '../../../../contracts/content/content.interface';

export interface LocalIdeaPostRecordPage {
  records: readonly IdeaPostDto[];
  total: number;
  nextCursor: string | null;
}

export interface LocalIdeaPostAdminRecordPage extends LocalIdeaPostRecordPage {
  counts: IdeaPostAdminCountsDto;
}

export class LocalIdeaPostsMapper {

  static countPosts(posts: readonly IdeaPostDto[]): IdeaPostAdminCountsDto {
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
      }
      else {
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

  private static readonly IMAGE_LIMIT = 24;

  static toDto(record: IdeaPostDto): IdeaPostDto {
    const contentHtml = this.normalizeHtml(record.contentHtml);
    const imageUrls = this.imageUrls(record.imageUrls, record.imageUrl);
    return {
      ...record,
      id: `${record.id ?? ''}`.trim(),
      contentKey: this.contentKey(record.contentKey, record.id),
      lang: this.normalizeLang(record.lang),
      languageLabel: this.languageLabel(record.lang),
      title: `${record.title ?? ''}`.trim() || 'Untitled idea',
      excerpt: this.excerpt(record.excerpt, contentHtml),
      contentHtml,
      imageUrl: `${record.imageUrl ?? ''}`.trim() || imageUrls[0] || '',
      imageUrls,
      imageDetails: normalizeImageDetails(record.imageDetails, imageUrls),
      featured: record.featured === true,
      published: record.published !== false,
      trashed: record.trashed === true,
      trashedAtIso: `${record.trashedAtIso ?? ''}`.trim(),
      trashedByUserId: `${record.trashedByUserId ?? ''}`.trim(),
      submittedAtIso: `${record.submittedAtIso ?? ''}`.trim()
        || `${record.updatedAtIso ?? ''}`.trim()
        || new Date().toISOString(),
      createdAtIso: `${record.createdAtIso ?? ''}`.trim(),
      createdByUserId: `${record.createdByUserId ?? ''}`.trim(),
      updatedAtIso: `${record.updatedAtIso ?? record.createdAtIso ?? ''}`.trim(),
      updatedByUserId: `${record.updatedByUserId ?? record.createdByUserId ?? ''}`.trim()
    };
  }

  static toDtoList(records: readonly IdeaPostDto[]): IdeaPostDto[] {
    return records.map(record => this.toDto(record));
  }

  static toDtoPage(page: LocalIdeaPostRecordPage): IdeaPostPublicPageResultDto {
    return {
      records: this.toDtoList(page.records),
      total: Math.max(0, Math.trunc(Number(page.total) || 0)),
      nextCursor: `${page.nextCursor ?? ''}`.trim() || null
    };
  }

  static toAdminDtoPage(page: LocalIdeaPostAdminRecordPage): IdeaPostAdminPageResultDto {
    return {
      records: this.toDtoList(page.records),
      total: Math.max(0, Math.trunc(Number(page.total) || 0)),
      nextCursor: `${page.nextCursor ?? ''}`.trim() || null,
      counts: {
        all: Math.max(0, Math.trunc(Number(page.counts.all) || 0)),
        featured: Math.max(0, Math.trunc(Number(page.counts.featured) || 0)),
        published: Math.max(0, Math.trunc(Number(page.counts.published) || 0)),
        drafts: Math.max(0, Math.trunc(Number(page.counts.drafts) || 0)),
        trashed: Math.max(0, Math.trunc(Number(page.counts.trashed) || 0))
      }
    };
  }

  static toRecord(
    request: IdeaPostSaveRequestDto,
    options: { id: string; nowIso: string }
  ): IdeaPostDto {
    const lang = this.normalizeLang(request.lang);
    const contentHtml = this.normalizeHtml(request.contentHtml);
    const imageUrls = this.imageUrls(request.imageUrls, request.imageUrl);
    const actorUserId = `${request.actorUserId ?? ''}`.trim() || 'admin';
    return {
      id: options.id,
      contentKey: this.contentKey(request.contentKey, options.id),
      lang,
      languageLabel: this.languageLabel(lang),
      title: `${request.title ?? ''}`.trim() || 'Untitled idea',
      excerpt: this.excerpt(request.excerpt, contentHtml),
      contentHtml,
      imageUrl: `${request.imageUrl ?? ''}`.trim() || imageUrls[0] || '',
      imageUrls,
      imageDetails: normalizeImageDetails(request.imageDetails, imageUrls),
      featured: request.featured === true,
      published: request.published !== false,
      trashed: false,
      trashedAtIso: '',
      trashedByUserId: '',
      submittedAtIso: this.submittedAtIso(request.submittedAtIso),
      createdAtIso: options.nowIso,
      createdByUserId: actorUserId,
      updatedAtIso: options.nowIso,
      updatedByUserId: actorUserId
    };
  }

  private static normalizeHtml(value: string | null | undefined): string {
    return sanitizeHtml(value);
  }

  private static excerpt(explicitExcerpt: string | null | undefined, contentHtml: string): string {
    const value = `${explicitExcerpt ?? ''}`.trim() || this.htmlToText(contentHtml);
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length <= 180 ? normalized : `${normalized.slice(0, 179).trim()}...`;
  }

  private static htmlToText(value: string): string {
    if (typeof document === 'undefined') {
      return value.replace(/<[^<>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const template = document.createElement('template');
    template.innerHTML = value;
    return `${template.content.textContent ?? ''}`.replace(/\s+/g, ' ').trim();
  }

  private static normalizeLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return SUPPORTED_CONTENT_LANGUAGES.some(item => item.lang === normalized) ? normalized : 'en';
  }

  private static languageLabel(lang: string | null | undefined): string {
    return SUPPORTED_CONTENT_LANGUAGES.find(item => item.lang === this.normalizeLang(lang))?.label ?? 'English';
  }

  private static contentKey(value: string | null | undefined, fallbackId: string): string {
    const normalized = `${value ?? ''}`.trim() || fallbackId.trim();
    return normalized.replace(/-(?:hu|de|es)$/, '');
  }

  private static imageUrls(
    imageUrls: readonly string[] | null | undefined,
    primaryImageUrl: string | null | undefined
  ): string[] {
    const urls = new Set<string>();
    const primary = `${primaryImageUrl ?? ''}`.trim();
    if (primary) {
      urls.add(primary);
    }
    for (const value of imageUrls ?? []) {
      const normalized = `${value ?? ''}`.trim();
      if (normalized) {
        urls.add(normalized);
      }
      if (urls.size >= this.IMAGE_LIMIT) {
        break;
      }
    }
    return [...urls];
  }

  private static submittedAtIso(requested: string | null | undefined): string {
    const normalized = `${requested ?? ''}`.trim();
    if (!normalized) {
      return '';
    }
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : normalized;
  }
}
