import type {
  IdeaPostAdminCountsDto,
  IdeaPostAdminPageResultDto,
  IdeaPostDto,
  IdeaPostPublicPageResultDto,
  IdeaPostSaveRequestDto
} from '../../../contracts/content.interface';

export interface LocalIdeaPostRecordPage {
  records: readonly IdeaPostDto[];
  total: number;
  nextCursor: string | null;
}

export interface LocalIdeaPostAdminRecordPage extends LocalIdeaPostRecordPage {
  counts: IdeaPostAdminCountsDto;
}

export class LocalIdeaPostsMapper {
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
    return `${value ?? ''}`
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\s(?:href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, '')
      .trim();
  }

  private static excerpt(explicitExcerpt: string | null | undefined, contentHtml: string): string {
    const value = `${explicitExcerpt ?? ''}`.trim() || this.htmlToText(contentHtml);
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length <= 180 ? normalized : `${normalized.slice(0, 179).trim()}...`;
  }

  private static htmlToText(value: string): string {
    if (typeof document === 'undefined') {
      return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const template = document.createElement('template');
    template.innerHTML = value;
    return `${template.content.textContent ?? ''}`.replace(/\s+/g, ' ').trim();
  }

  private static normalizeLang(lang: string | null | undefined): string {
    return `${lang ?? ''}`.trim().toLowerCase().split('-')[0] === 'hu' ? 'hu' : 'en';
  }

  private static languageLabel(lang: string | null | undefined): string {
    return this.normalizeLang(lang) === 'hu' ? 'Magyar' : 'English';
  }

  private static contentKey(value: string | null | undefined, fallbackId: string): string {
    const normalized = `${value ?? ''}`.trim() || fallbackId.trim();
    return normalized.endsWith('-hu') ? normalized.slice(0, -3) : normalized;
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
